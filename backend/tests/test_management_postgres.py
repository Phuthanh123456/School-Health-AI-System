"""Opt-in real PostgreSQL coverage; all writes use a disposable schema."""

import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from app import seed_demo
from app.config import settings
from app.database import engine as application_engine, get_db
from app.main import app
from app.models.checkup import Account
from app.models.student import HealthProfile, Student, parent_students
from app.schemas.auth import AuthenticatedUser
from app.services.auth import create_access_token


@pytest.mark.skipif(os.getenv('RUN_POSTGRES_TESTS') != '1', reason='Set RUN_POSTGRES_TESTS=1 with PostgreSQL')
def test_postgres_csv_roles_concurrent_writes_and_seed_preserves_admin_removals(monkeypatch):
    assert application_engine is not None
    schema = 'management_test_' + uuid4().hex
    with application_engine.begin() as connection:
        connection.execute(CreateSchema(schema))
    engine = application_engine.execution_options(schema_translate_map={'schoolhealth_demo': schema})
    monkeypatch.setattr(seed_demo, 'engine', engine)
    monkeypatch.setattr(settings, 'auth_token_secret', 'temporary-test-signing-secret-at-least-32-characters')
    folder = Path(seed_demo.__file__).resolve().parent.parent / 'data'
    password = 'FictionalIntegration2026'

    def test_db():
        with Session(engine) as db:
            yield db

    try:
        seed_demo.seed(folder, password)
        app.dependency_overrides[get_db] = test_db
        def auth(id, role):
            token = create_access_token(AuthenticatedUser(id=id, email=f'{id}@schoolhealth.example', role=role))
            return {'Authorization': f'Bearer {token}'}
        admin = auth('admin', 'admin')
        with TestClient(app) as client:
            data = client.get('/api/admin/health-records?pageSize=100', headers=admin)
            assert data.status_code == 200 and data.json()['total'] == 24
            assert client.get('/api/admin/health-records', headers=auth('PARENT001', 'parent')).status_code == 403
            family = client.get('/api/parent/dashboard', headers=auth('PARENT001', 'parent')).json()
            assert [row['id'] for row in family['children']] == ['DEMO001']
            assert client.get('/api/parent/children/DEMO002', headers=auth('PARENT001', 'parent')).status_code == 404
            # A Parent request waiting behind an Admin unlink must recheck
            # the link after obtaining its shared row lock, not use old joins.
            with Session(engine) as locked:
                locked.scalar(select(Student.id).where(Student.id == 'DEMO002').with_for_update())
                def parent_read():
                    with TestClient(app) as reader:
                        return reader.get('/api/parent/children/DEMO002', headers=auth('PARENT002', 'parent')).status_code
                with ThreadPoolExecutor(max_workers=1) as readers:
                    pending = readers.submit(parent_read)
                    waiting = False
                    try:
                        for _ in range(60):
                            with engine.connect() as connection:
                                waiting = bool(connection.scalar(text(
                                    "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE :schema"
                                ), {'schema': '%' + schema + '%'}))
                            if waiting:
                                break
                            time.sleep(0.05)
                        locked.execute(delete(parent_students).where(
                            parent_students.c.student_id == 'DEMO002', parent_students.c.parent_id == 'PARENT002'
                        ))
                    finally:
                        locked.commit()
                    assert waiting, 'The Parent request did not reach the expected row-lock wait'
                    assert pending.result(timeout=10) == 404
            row = next(row for row in data.json()['items'] if row['id'] == 'DEMO024')
            path = '/api/admin/students/DEMO024'
            removed = client.delete(path + '/parent', headers={**admin, 'If-Match': row['assignment_version']})
            assert removed.status_code == 200
            removed = client.delete(path + '/nurse', headers={**admin, 'If-Match': removed.json()['assignment_version']})
            assert removed.status_code == 200
            with Session(engine) as db:
                profile = db.get(HealthProfile, 'DEMO024'); profile.medical_notes = 'Preserve saved synthetic edit'
                password_hash = db.get(Account, 'PARENT024').password_hash
                db.commit()
            seed_demo.seed(folder, password)
            row = next(row for row in client.get('/api/admin/health-records?pageSize=100', headers=admin).json()['items'] if row['id'] == 'DEMO024')
            assert row['parents'] == [] and row['nurse'] is None
            assert row['medical_notes'] == 'Preserve saved synthetic edit'
            with Session(engine) as db:
                assert db.get(Account, 'PARENT024').password_hash == password_hash
            # Two administrators with the same snapshot cannot both overwrite it.
            def assign(parent_id):
                with TestClient(app) as other:
                    return other.put(path + '/parent', json={'account_id': parent_id}, headers={**admin, 'If-Match': row['assignment_version']}).status_code
            with ThreadPoolExecutor(max_workers=2) as pool:
                statuses = list(pool.map(assign, ['PARENT002', 'PARENT003']))
            assert sorted(statuses) == [200, 409]
    finally:
        app.dependency_overrides.pop(get_db, None)
        with application_engine.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
