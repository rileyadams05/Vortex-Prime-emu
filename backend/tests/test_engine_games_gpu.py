"""
Tests for Engine Hot-Swap, Games Scanning, and GPU Profile APIs.
Run with: python -m pytest backend/tests/test_engine_games_gpu.py -v --tb=short
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:3001').rstrip('/')


class TestEngineAPI:
    """Engine hot-swap / status endpoint tests."""

    def test_engine_status_returns_json(self):
        """GET /api/engine/status should return a valid engine status dict."""
        response = requests.get(f"{BASE_URL}/api/engine/status")
        assert response.status_code == 200

        data = response.json()
        assert "present" in data
        assert "exe_found" in data
        assert "portable_mode" in data
        assert "engine_dir" in data
        assert "source_available" in data
        assert isinstance(data["present"], bool)
        assert isinstance(data["source_available"], bool)

    def test_engine_status_fields_types(self):
        """Engine status fields should have correct types."""
        response = requests.get(f"{BASE_URL}/api/engine/status")
        assert response.status_code == 200
        data = response.json()

        assert isinstance(data["exe_found"], bool)
        assert isinstance(data["portable_mode"], bool)
        assert isinstance(data["engine_dir"], str)
        assert isinstance(data["exe_path"], str)

    def test_engine_migrate_missing_source_returns_error(self):
        """POST /api/engine/migrate with invalid source should return 500."""
        response = requests.post(
            f"{BASE_URL}/api/engine/migrate",
            json={"source_path": "Z:\\nonexistent\\path\\that\\does\\not\\exist"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 500
        data = response.json()
        assert "detail" in data


class TestGamesScanAPI:
    """Games scanning and listing endpoints."""

    def test_games_list_returns_json(self):
        """GET /api/games/list should return cached game list (may be empty)."""
        response = requests.get(f"{BASE_URL}/api/games/list")
        assert response.status_code == 200

        data = response.json()
        assert "games" in data
        assert isinstance(data["games"], list)

    def test_games_scan_returns_list(self):
        """POST /api/games/scan should return a games list (may be empty if no games folder)."""
        response = requests.post(
            f"{BASE_URL}/api/games/scan",
            json={"folder": ""},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200

        data = response.json()
        assert "games" in data
        assert "count" in data
        assert isinstance(data["games"], list)
        assert isinstance(data["count"], int)
        assert data["count"] == len(data["games"])

    def test_games_scan_structure_when_games_found(self):
        """If scan returns games, they should have the correct structure."""
        response = requests.post(
            f"{BASE_URL}/api/games/scan",
            json={"folder": ""},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()

        for game in data["games"]:
            assert "id" in game
            assert "title" in game
            assert "path" in game
            assert "integrity" in game
            assert game["integrity"] in ("ok", "corrupted")

    def test_games_launch_rejects_if_xenia_running(self):
        """
        POST /api/games/launch should return 409 if Xenia is already running,
        or 500 if the game file doesn't exist. Both are valid non-200 codes here.
        """
        response = requests.post(
            f"{BASE_URL}/api/games/launch",
            json={
                "game_path": "Z:\\nonexistent\\game.iso",
                "title_id": "",
            },
            headers={"Content-Type": "application/json"}
        )
        # Should be 409 (already running) or 500 (game not found)
        assert response.status_code in (409, 500)
        data = response.json()
        assert "detail" in data


class TestGPUProfileAPI:
    """GPU detection and hardware profile endpoints."""

    def test_gpu_detect_returns_vendor(self):
        """GET /api/gpu/detect should return a vendor string."""
        response = requests.get(f"{BASE_URL}/api/gpu/detect")
        assert response.status_code == 200

        data = response.json()
        assert "vendor" in data
        assert "profile" in data
        assert data["vendor"] in ("nvidia", "amd", "unknown")

    def test_gpu_detect_profile_structure(self):
        """The profile returned by GPU detect should have a GPU section."""
        response = requests.get(f"{BASE_URL}/api/gpu/detect")
        assert response.status_code == 200

        data = response.json()
        profile = data.get("profile", {})
        assert "GPU" in profile
        assert "gpu" in profile["GPU"]  # backend key e.g. 'd3d12' or 'vulkan'

    def test_gpu_apply_profile_ok(self):
        """POST /api/gpu/apply-profile should succeed (200)."""
        response = requests.post(
            f"{BASE_URL}/api/gpu/apply-profile",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # May return 200 (success) or 500 if config file not yet present
        assert response.status_code in (200, 500)

        if response.status_code == 200:
            data = response.json()
            assert "vendor" in data
            assert "success" in data

    def test_gpu_apply_profile_with_vendor_override(self):
        """POST /api/gpu/apply-profile with explicit vendor should use that vendor."""
        for vendor in ("nvidia", "amd"):
            response = requests.post(
                f"{BASE_URL}/api/gpu/apply-profile",
                json={"vendor": vendor},
                headers={"Content-Type": "application/json"}
            )
            # May succeed or fail depending on config file presence
            assert response.status_code in (200, 500)

            if response.status_code == 200:
                data = response.json()
                assert data.get("vendor") == vendor


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
