import os
import subprocess
import sys

import pytest

from app.config import Settings


@pytest.mark.parametrize("prefix", ["postgres://", "postgresql://", "postgresql+psycopg://"])
def test_render_database_url_uses_installed_driver(monkeypatch, prefix):
    monkeypatch.setenv("DATABASE_URL", prefix + "demo:demo@localhost/demo")
    assert Settings().database_url == "postgresql+psycopg://demo:demo@localhost/demo"


def test_render_serves_spa_routes_and_preserves_api_routes(tmp_path):
    (tmp_path / "index.html").write_text("<html>SchoolHealth deployment test</html>")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('demo')")
    environment = {**os.environ, "FRONTEND_DIST": str(tmp_path)}
    script = '''
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as client:
    for path in ('/', '/home', '/login', '/nurse', '/admin', '/admin/overview', '/admin/insights', '/parent'):
        response = client.get(path)
        assert response.status_code == 200, path
        assert 'SchoolHealth deployment test' in response.text
    assert client.get('/assets/app.js').status_code == 200
    assert client.get('/health').json()['status'] == 'healthy'
    assert client.get('/students').status_code == 401
    assert client.get('/api/not-a-route').status_code == 404
'''
    result = subprocess.run([sys.executable, "-c", script], env=environment, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
