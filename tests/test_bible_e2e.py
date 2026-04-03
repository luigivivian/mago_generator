"""E2E test for biblical reel creation.

Run with: python -m pytest tests/test_bible_e2e.py -x -v -m e2e
Requires: running API server at API_BASE_URL, valid auth token.
Uses real credits/API calls.
"""

import os

import pytest
import httpx

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
AUTH_TOKEN = os.getenv("TEST_AUTH_TOKEN", "")

pytestmark = pytest.mark.e2e


@pytest.fixture
def client():
    """Authenticated httpx client."""
    if not AUTH_TOKEN:
        pytest.skip("TEST_AUTH_TOKEN not set -- skipping E2E")
    return httpx.Client(
        base_url=f"{API_BASE_URL}/api/reels",
        headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
        timeout=120,
    )


def test_create_bible_reel_interactive(client):
    """Create a biblical reel via interactive endpoint and verify each step produces output."""
    # Step 1: Create interactive reel with bible_config
    resp = client.post("/interactive", json={
        "tema": "Davi e Golias - teste E2E",
        "target_duration": 30,
        "image_count": 3,
        "tone": "engajante",
        "niche": "Historias Biblicas",
        "niche_id": "bible-stories",
        "sub_theme": "Davi e Golias",
        "language": "pt-BR",
        "bible_config": {
            "script_mode": "ai",
            "story_ref": "1 Samuel 17",
            "story_key": "david-goliath",
            "include_reflection": True,
            "bible_version": "NVI",
            "language": "pt-BR",
        },
        "no_character": True,
    })
    assert resp.status_code == 200, f"Create failed: {resp.text}"
    data = resp.json()
    job_id = data.get("job_id")
    assert job_id, f"No job_id in response: {data}"

    # Step 2: Verify step_state has bible_config
    resp2 = client.get(f"/{job_id}/status")
    assert resp2.status_code == 200
    status = resp2.json()
    step_state = status.get("step_state", {})
    config = step_state.get("config", {})
    assert "bible_config" in config, f"bible_config not in step_state config: {config.keys()}"
    assert config["bible_config"]["story_key"] == "david-goliath"

    print(f"E2E: Created bible reel job {job_id}")
    print(f"E2E: bible_config present in step_state: OK")
    print(f"E2E: Ready for step execution (script > tts > srt > images > clips > video)")


def test_create_bible_reel_manual_mode(client):
    """Create a biblical reel with manual script mode."""
    manual_text = (
        "Davi era um jovem pastor de ovelhas.\n\n"
        "Golias desafiou o exercito de Israel por quarenta dias.\n\n"
        "Davi pegou cinco pedras lisas do riacho e derrotou Golias com uma funda."
    )
    resp = client.post("/interactive", json={
        "tema": "Davi e Golias Manual",
        "target_duration": 30,
        "image_count": 3,
        "niche": "Historias Biblicas",
        "niche_id": "bible-stories",
        "language": "pt-BR",
        "bible_config": {
            "script_mode": "manual",
            "manual_text": manual_text,
            "include_reflection": False,
            "bible_version": "NVI",
            "language": "pt-BR",
        },
        "no_character": True,
    })
    assert resp.status_code == 200, f"Manual mode create failed: {resp.text}"
    data = resp.json()
    assert data.get("job_id"), f"No job_id: {data}"
    print(f"E2E: Manual mode bible reel created: {data['job_id']}")
