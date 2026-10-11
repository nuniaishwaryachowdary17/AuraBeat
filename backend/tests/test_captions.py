"""Live speech captions: the backend mints ElevenLabs single-use tokens for the laptop only."""
import io
import json
import urllib.error

import pytest
from fastapi.testclient import TestClient

import app.main as main


@pytest.fixture
def local(monkeypatch):
    # TestClient connects as "testclient"; treat it as the laptop itself.
    monkeypatch.setattr(main, "_LOCAL_HOSTS", main._LOCAL_HOSTS | {"testclient"})
    monkeypatch.setattr(main, "_caption_last_token", 0.0)


def test_no_key_says_how_to_fix(local, monkeypatch):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    with TestClient(main.app) as c:
        assert c.get("/captions/status").json() == {"configured": False, "allowed_here": True}
        r = c.post("/captions/token")
        assert r.status_code == 503 and "start.sh" in r.json()["detail"]


def test_phones_cannot_mint_tokens(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "sk-test")
    with TestClient(main.app) as c:  # client host "testclient" is not the laptop
        assert c.get("/captions/status").json()["allowed_here"] is False
        assert c.post("/captions/token").status_code == 403


def test_token_is_minted_and_key_never_returned(local, monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "sk-secret-key")
    seen = {}

    def fake_urlopen(req, timeout):
        seen["key"] = req.headers.get("Xi-api-key")
        seen["url"] = req.full_url
        return io.BytesIO(json.dumps({"token": "single-use-123"}).encode())

    monkeypatch.setattr(main.urllib.request, "urlopen", fake_urlopen)
    with TestClient(main.app) as c:
        r = c.post("/captions/token", headers={"Origin": "http://localhost:5173"})
        assert r.status_code == 200 and r.json() == {"token": "single-use-123"}
        assert "sk-secret-key" not in r.text
        assert seen == {"key": "sk-secret-key", "url": main.ELEVEN_TOKEN_URL}
        # a page from another machine on the network is refused even through the laptop
        assert c.post("/captions/token", headers={"Origin": "http://10.0.0.50:5173"}).status_code == 403
        # rate limit: one new session per 5 s
        assert c.post("/captions/token").status_code == 429


def test_bad_key_is_explained(local, monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "sk-wrong")

    def fake_urlopen(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)

    monkeypatch.setattr(main.urllib.request, "urlopen", fake_urlopen)
    with TestClient(main.app) as c:
        r = c.post("/captions/token")
        assert r.status_code == 502 and r.json()["detail"] == "ElevenLabs rejected the API key."
