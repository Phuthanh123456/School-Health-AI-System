import json
from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, event, update
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.student import CheckupResult, CheckupSession, Student
from app.schemas.auth import AuthenticatedUser
from app.services.auth import create_access_token
from app.services import insights

STATS = dict(total_students=30, checkups_completed=26, followups_pending=5)
SELECTION = dict(highlights=["checkups_completed", "followups_pending"], recommendations=["followup_capacity", "data_review"])


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(settings, "auth_token_secret", "test-only-auth-signing-secret-32-bytes-long")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.invalid/v1")
    monkeypatch.setattr(settings, "llm_api_key", "test-server-key")
    monkeypatch.setattr(settings, "llm_model", "test-model")
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
                           execution_options={"schema_translate_map": {"schoolhealth_demo": None}})
    Base.metadata.create_all(engine, tables=[Student.__table__, CheckupSession.__table__, CheckupResult.__table__])
    with Session(engine) as db:
        db.add_all(Student(id=f"PRIVATE{i}", full_name=f"PRIVATE NAME {i}", class_name="PRIVATE CLASS") for i in range(30))
        db.add_all([CheckupSession(id="old",title="PRIVATE OLD",checkup_date=date(2026,9,1)),
                    CheckupSession(id="latest",title="PRIVATE SESSION",checkup_date=date(2026,11,1))])
        db.flush()
        db.add_all(CheckupResult(session_id="old",student_id=f"PRIVATE{i}",status="follow_up") for i in range(30))
        db.add_all(CheckupResult(session_id="latest",student_id=f"PRIVATE{i}",status="follow_up" if i<5 else "completed",notes="PRIVATE NOTES") for i in range(26))
        db.commit()
    def test_db():
        with Session(engine) as db:
            yield db
    old_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = test_db
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(SELECTION)}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(insights.httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    token = create_access_token(AuthenticatedUser(id="admin", email="admin@example.test", role="admin"))
    try:
        with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as client:
            yield client, calls, monkeypatch, engine
    finally:
        if old_override is None: app.dependency_overrides.pop(get_db, None)
        else: app.dependency_overrides[get_db] = old_override
        engine.dispose()


def test_signed_in_admin_and_exact_database_aggregates(api):
    client, calls, _, engine = api
    assert client.get('/auth/me').status_code == 200
    queries = []
    def record_sql(conn, cursor, statement, parameters, context, executemany): queries.append(statement)
    event.listen(engine, 'before_cursor_execute', record_sql)
    stats = client.get('/api/admin/dashboard-statistics')
    event.remove(engine, 'before_cursor_execute', record_sql)
    assert len(queries) == 1
    assert stats.status_code == 200 and stats.json()['aggregates'] == STATS
    assert stats.json()['session_date'] == '2026-11-01'
    response = client.post('/api/admin/ai-insights', json=STATS)
    assert response.status_code == 200
    assert response.headers['Cache-Control'] == 'no-store'
    assert '26/30' in response.json()['summary'] and '5/30' in response.json()['summary']
    assert 'không phải chẩn đoán' in response.json()['disclaimer']
    payload = json.loads(calls[0].content)
    assert json.loads(payload['messages'][1]['content']) == STATS
    assert 'PRIVATE' not in calls[0].content.decode()
    assert 'test-server-key' not in response.text
    assert calls[0].headers['Authorization'] == 'Bearer test-server-key'


@pytest.mark.parametrize('role', ['nurse','parent'])
def test_non_admin_roles_cannot_access_stats_or_ai(api, role):
    client, calls, _, _ = api
    token=create_access_token(AuthenticatedUser(id=role,email=f'{role}@example.test',role=role))
    headers={'Authorization':'Bearer '+token}
    assert client.get('/api/admin/dashboard-statistics',headers=headers).status_code == 403
    assert client.post('/api/admin/ai-insights',headers=headers,json=STATS).status_code == 403
    assert not calls


@pytest.mark.parametrize('token', ['', 'Bearer invalid', 'Bearer review-only-preview-token'])
def test_anonymous_invalid_and_legacy_credentials_are_rejected(api, token):
    client, calls, _, _ = api
    assert client.get('/api/admin/dashboard-statistics',headers={'Authorization':token}).status_code == 401
    assert client.post('/api/admin/ai-insights',headers={'Authorization':token},json=STATS).status_code == 401
    assert not calls


def test_expired_session_rejected(api):
    import jwt
    client, calls, _, _ = api
    token=jwt.encode({'sub':'admin','email':'admin@example.test','role':'admin','iss':settings.auth_token_issuer,'iat':1,'exp':2},settings.auth_token_secret,algorithm='HS256')
    assert client.post('/api/admin/ai-insights',headers={'Authorization':'Bearer '+token},json=STATS).status_code == 401
    assert not calls


@pytest.mark.parametrize('extra', [dict(name='PRIVATE'),dict(student_id='PRIVATE'),dict(notes='PRIVATE'),dict(records=[{'name':'PRIVATE'}]),dict(prompt='PRIVATE'),dict(school='PRIVATE'),dict(vision_flags=0)])
def test_extra_or_identifying_fields_rejected(api, extra):
    client, calls, _, _ = api
    response=client.post('/api/admin/ai-insights',json={**STATS,**extra})
    assert response.status_code == 422
    assert 'PRIVATE' not in response.text and not calls


@pytest.mark.parametrize('patch', [dict(total_students='30'),dict(total_students=True),dict(total_students=-1),dict(total_students=1.5),dict(total_students=1_000_001),dict(checkups_completed=31),dict(followups_pending=27),dict(followups_pending=None)])
def test_invalid_counts_rejected(api, patch):
    client, calls, _, _ = api
    assert client.post('/api/admin/ai-insights',json={**STATS,**patch}).status_code == 422
    assert not calls


def test_missing_counts_rejected(api):
    client, calls, _, _ = api
    assert client.post('/api/admin/ai-insights',json={}).status_code == 422
    assert not calls


def test_forged_or_stale_counts_never_reach_provider(api):
    client, calls, _, engine = api
    assert client.post('/api/admin/ai-insights',json={**STATS,'total_students':480}).status_code == 409
    with Session(engine) as db:
        db.execute(update(CheckupResult).where(CheckupResult.session_id=='latest',CheckupResult.student_id=='PRIVATE0').values(status='pending'))
        db.commit()
    assert client.post('/api/admin/ai-insights',json=STATS).status_code == 409
    assert client.get('/api/admin/dashboard-statistics').json()['aggregates']['checkups_completed'] == 25
    assert not calls


def test_small_school_or_examined_cohort_blocks_ai(api):
    client, calls, _, engine = api
    with Session(engine) as db:
        db.execute(update(CheckupResult).where(CheckupResult.session_id=='latest').values(status='pending'))
        db.commit()
    actual=client.get('/api/admin/dashboard-statistics').json()['aggregates']
    assert actual['checkups_completed'] == 0
    assert client.post('/api/admin/ai-insights',json=actual).status_code == 422
    assert not calls


def test_small_followup_cell_omitted(api):
    client, calls, monkeypatch, engine = api
    with Session(engine) as db:
        db.execute(update(CheckupResult).where(CheckupResult.session_id=='latest',CheckupResult.student_id.in_(['PRIVATE0','PRIVATE1'])).values(status='completed'))
        db.commit()
    monkeypatch.setitem(SELECTION,'highlights',['checkups_completed'])
    monkeypatch.setitem(SELECTION,'recommendations',['data_review'])
    stats=client.get('/api/admin/dashboard-statistics').json()['aggregates']
    assert stats['followups_pending']==3
    assert client.post('/api/admin/ai-insights',json=stats).status_code==200
    assert 'followups_pending' not in json.loads(json.loads(calls[0].content)['messages'][1]['content'])


def test_absent_pending_and_missing_results_not_counted_as_examined(api):
    client, _, _, engine = api
    with Session(engine) as db:
        db.add(CheckupResult(session_id='latest',student_id='PRIVATE26',status='absent'))
        db.add(CheckupResult(session_id='latest',student_id='PRIVATE27',status='pending'))
        db.commit()
    assert client.get('/api/admin/dashboard-statistics').json()['aggregates']==STATS


def test_no_sessions_and_empty_school_are_valid_empty_states(api):
    client, _, _, engine = api
    with Session(engine) as db:
        db.execute(delete(CheckupResult)); db.execute(delete(CheckupSession)); db.commit()
    data=client.get('/api/admin/dashboard-statistics').json()
    assert data=={'aggregates':{'total_students':30,'checkups_completed':0,'followups_pending':0},'session_title':None,'session_date':None}
    with Session(engine) as db:
        db.execute(delete(Student)); db.commit()
    assert client.get('/api/admin/dashboard-statistics').json()['aggregates']['total_students']==0


@pytest.mark.parametrize('config',['auth_token_secret','llm_api_key','llm_base_url','llm_model'])
def test_missing_configuration_fails_closed(api,config):
    client,calls,monkeypatch,_=api
    monkeypatch.setattr(settings,config,'')
    assert client.post('/api/admin/ai-insights',json=STATS).status_code==503
    assert not calls


@pytest.mark.parametrize('output',['not json',json.dumps({**SELECTION,'prescription':'PRIVATE'}),json.dumps({**SELECTION,'highlights':['checkups_completed','checkups_completed']}),json.dumps({**SELECTION,'recommendations':['prescribe_medication']}),'null','{}'])
def test_unsafe_or_malformed_output_hidden(api,output):
    client,_,monkeypatch,_=api
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,*args,**kwargs): return httpx.Response(200,request=httpx.Request('POST','https://provider.invalid'),json={'choices':[{'message':{'content':output}}]})
    monkeypatch.setattr(insights.httpx,'AsyncClient',lambda **kwargs:FakeClient())
    response=client.post('/api/admin/ai-insights',json=STATS)
    assert response.status_code==502 and 'PRIVATE' not in response.text


@pytest.mark.parametrize('failure,expected',[(httpx.ReadTimeout('secret'),504),(httpx.ConnectError('secret'),502)])
def test_provider_failure_is_safe(api,failure,expected):
    client,_,monkeypatch,_=api
    class FailedClient:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,*args,**kwargs): raise failure
    monkeypatch.setattr(insights.httpx,'AsyncClient',lambda **kwargs:FailedClient())
    response=client.post('/api/admin/ai-insights',json=STATS)
    assert response.status_code==expected and 'secret' not in response.text
    assert client.get('/api/admin/dashboard-statistics').status_code==200


def test_database_failure_is_retryable_without_details(api):
    from sqlalchemy.exc import OperationalError
    client,calls,_,_=api
    class FailedDatabase:
        def execute(self,*args): raise OperationalError('PRIVATE DB',{},Exception('PRIVATE DSN'))
    app.dependency_overrides[get_db]=lambda:FailedDatabase()
    response=client.get('/api/admin/dashboard-statistics')
    assert response.status_code==503 and 'PRIVATE' not in response.text
    assert not calls


def test_missing_database_is_retryable(api):
    import app.database as database
    client,calls,monkeypatch,_=api
    app.dependency_overrides.pop(get_db)
    monkeypatch.setattr(database,'engine',None)
    assert client.get('/api/admin/dashboard-statistics').status_code==503
    assert not calls
