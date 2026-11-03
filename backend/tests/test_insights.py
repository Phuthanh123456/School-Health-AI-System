import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services import insights

STATS = dict(total_students=480, checkups_completed=420, followups_pending=36, vision_flags=84, dental_flags=63)
SELECTION = dict(highlights=["checkups_completed", "vision_flags"], recommendations=["vision_education", "data_review"])


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(settings, "insights_admin_token", "test-admin")
    monkeypatch.setattr(settings, "llm_base_url", "https://provider.invalid/v1")
    monkeypatch.setattr(settings, "llm_api_key", "test-server-key")
    monkeypatch.setattr(settings, "llm_model", "test-model")
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(SELECTION)}}]})
    original = httpx.AsyncClient
    def factory(**kwargs):
        return original(**kwargs, transport=httpx.MockTransport(handler))
    monkeypatch.setattr(insights.httpx, "AsyncClient", factory)
    with TestClient(app, headers={"Authorization": "Bearer test-admin"}) as client:
        yield client, calls, monkeypatch


def test_success_and_exact_outbound_allowlist(api):
    client, calls, _ = api
    response = client.post('/api/admin/ai-insights', json=STATS)
    assert response.status_code == 200
    data = response.json()
    assert "420/480" in data['summary'] and "84/480" in data['summary']
    assert data['aggregates'] == STATS
    assert 'không phải chẩn đoán' in data['disclaimer']
    payload = json.loads(calls[0].content)
    assert json.loads(payload['messages'][1]['content']) == STATS
    assert calls[0].url == 'https://provider.invalid/v1/chat/completions'
    assert calls[0].headers['Authorization'] == 'Bearer test-server-key'
    assert 'test-server-key' not in response.text


@pytest.mark.parametrize('extra', [dict(name='PRIVATE'), dict(student_id='PRIVATE'), dict(notes='PRIVATE'), dict(records=[{'name':'PRIVATE'}]), dict(prompt='PRIVATE'), dict(school='PRIVATE')])
def test_pii_and_extra_fields_never_reach_provider(api, extra):
    client, calls, _ = api
    response = client.post('/api/admin/ai-insights', json={**STATS, **extra})
    assert response.status_code == 422
    assert 'PRIVATE' not in response.text
    assert not calls


@pytest.mark.parametrize('patch', [dict(total_students='480'), dict(total_students=True), dict(total_students=-1), dict(total_students=1.5), dict(total_students=1_000_001), dict(checkups_completed=481), dict(vision_flags=421), dict(followups_pending=None), dict(total_students=19,checkups_completed=19,followups_pending=0,vision_flags=0,dental_flags=0)])
def test_invalid_counts_blocked(api, patch):
    client, calls, _ = api
    assert client.post('/api/admin/ai-insights', json={**STATS, **patch}).status_code == 422
    assert not calls


def test_required_counts(api):
    client, calls, _ = api
    assert client.post('/api/admin/ai-insights', json={}).status_code == 422
    assert not calls


def test_small_cell_not_sent(api):
    client, calls, _ = api
    assert client.post('/api/admin/ai-insights', json={**STATS,'dental_flags':3}).status_code == 200
    assert 'dental_flags' not in json.loads(json.loads(calls[0].content)['messages'][1]['content'])


@pytest.mark.parametrize('token', ['', 'Bearer invalid'])
def test_admin_gate(api, token):
    client, calls, _ = api
    assert client.post('/api/admin/ai-insights', json=STATS, headers={'Authorization':token}).status_code == 403
    assert not calls


@pytest.mark.parametrize('config', ['insights_admin_token','llm_api_key','llm_base_url','llm_model'])
def test_missing_configuration_fails_closed(api, config):
    client, calls, monkeypatch = api
    monkeypatch.setattr(settings,config,'')
    assert client.post('/api/admin/ai-insights',json=STATS).status_code == 503
    assert not calls


@pytest.mark.parametrize('output', ['not json', '{"highlights":["diagnose_student"],"recommendations":["data_review"]}', json.dumps({**SELECTION,'prescription':'PRIVATE'}), json.dumps({**SELECTION,'highlights':['vision_flags','vision_flags']}), json.dumps({**SELECTION,'recommendations':['prescribe_medication']})])
def test_unsafe_and_malformed_output_hidden(api, output):
    client, _, monkeypatch = api
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,*args,**kwargs):
            return httpx.Response(200, request=httpx.Request('POST','https://provider.invalid'), json={'choices':[{'message':{'content':output}}]})
    monkeypatch.setattr(insights.httpx,'AsyncClient',lambda **kwargs:FakeClient())
    response=client.post('/api/admin/ai-insights',json=STATS)
    assert response.status_code == 502
    assert 'PRIVATE' not in response.text


@pytest.mark.parametrize('failure,expected', [(httpx.ReadTimeout('secret'),504),(httpx.ConnectError('secret'),502)])
def test_failed_api_fallback(api, failure, expected):
    client, _, monkeypatch = api
    class FailedClient:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,*args,**kwargs): raise failure
    monkeypatch.setattr(insights.httpx,'AsyncClient',lambda **kwargs:FailedClient())
    response=client.post('/api/admin/ai-insights',json=STATS)
    assert response.status_code == expected
    assert 'secret' not in response.text
    assert client.get('/health').status_code == 200
