"""
Backend tests for Theme Management and SteamGridDB Asset Engine APIs.
Tests theme CRUD operations, swap mechanism, and SteamGridDB integration.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Store test theme filenames for cleanup
created_theme_filenames = []


class TestThemeAPI:
    """Theme Management API tests - CRUD and swap logic"""

    def test_get_themes_list(self):
        """GET /api/themes - should return active and disabled themes"""
        response = requests.get(f"{BASE_URL}/api/themes")
        assert response.status_code == 200
        
        data = response.json()
        assert "active" in data
        assert "disabled" in data
        assert isinstance(data["active"], list)
        assert isinstance(data["disabled"], list)
        
        # Should have at least one theme in total (seeded defaults)
        total_themes = len(data["active"]) + len(data["disabled"])
        assert total_themes >= 1, "Should have at least one seeded theme"
        
        # Verify theme structure
        all_themes = data["active"] + data["disabled"]
        for theme in all_themes:
            assert "name" in theme
            assert "accent_color" in theme
            assert "_filename" in theme
            assert "_status" in theme

    def test_get_active_theme(self):
        """GET /api/themes/active - should return currently active theme"""
        response = requests.get(f"{BASE_URL}/api/themes/active")
        assert response.status_code == 200
        
        data = response.json()
        assert "theme" in data
        
        # Theme can be null if none active, or an object
        if data["theme"]:
            theme = data["theme"]
            assert "name" in theme
            assert "accent_color" in theme
            assert "_status" in theme
            assert theme["_status"] == "active"

    def test_create_theme(self):
        """POST /api/themes/create - should create theme in Disabled folder"""
        global created_theme_filenames
        
        payload = {
            "name": "TEST_Theme_PyTest",
            "description": "Created by pytest for testing",
            "accent_color": "#ff5500",
            "background_value": "#121212",
            "background_type": "color"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/themes/create",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == payload["name"]
        assert data["description"] == payload["description"]
        assert data["accent_color"] == payload["accent_color"]
        assert data["_status"] == "disabled", "New themes should be in Disabled folder"
        assert "_filename" in data
        
        # Store for cleanup
        created_theme_filenames.append(data["_filename"])
        
        # Verify theme appears in themes list
        list_response = requests.get(f"{BASE_URL}/api/themes")
        list_data = list_response.json()
        disabled_names = [t["name"] for t in list_data["disabled"]]
        assert payload["name"] in disabled_names

    def test_activate_theme(self):
        """POST /api/themes/activate - should swap themes (only 1 active at a time)"""
        # First get a disabled theme to activate
        list_response = requests.get(f"{BASE_URL}/api/themes")
        list_data = list_response.json()
        
        if not list_data["disabled"]:
            pytest.skip("No disabled themes to activate")
        
        disabled_theme = list_data["disabled"][0]
        old_active = list_data["active"][0] if list_data["active"] else None
        
        payload = {"filename": disabled_theme["_filename"]}
        response = requests.post(
            f"{BASE_URL}/api/themes/activate",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["_status"] == "active"
        assert data["_filename"] == disabled_theme["_filename"]
        
        # Verify only ONE theme is now active (swap mechanism)
        verify_response = requests.get(f"{BASE_URL}/api/themes")
        verify_data = verify_response.json()
        
        assert len(verify_data["active"]) == 1, "Should have exactly 1 active theme after activate"
        assert verify_data["active"][0]["_filename"] == disabled_theme["_filename"]
        
        # Old active should now be in disabled
        if old_active:
            disabled_filenames = [t["_filename"] for t in verify_data["disabled"]]
            assert old_active["_filename"] in disabled_filenames, "Old active theme should be moved to Disabled"

    def test_deactivate_theme(self):
        """POST /api/themes/deactivate - should move active theme to Disabled"""
        # Get active theme
        active_response = requests.get(f"{BASE_URL}/api/themes/active")
        active_data = active_response.json()
        
        if not active_data.get("theme"):
            pytest.skip("No active theme to deactivate")
        
        active_theme = active_data["theme"]
        
        payload = {"filename": active_theme["_filename"]}
        response = requests.post(
            f"{BASE_URL}/api/themes/deactivate",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["_status"] == "disabled"
        
        # Verify no active themes now
        verify_response = requests.get(f"{BASE_URL}/api/themes")
        verify_data = verify_response.json()
        
        # Re-activate a theme to restore state for other tests
        if verify_data["disabled"]:
            requests.post(
                f"{BASE_URL}/api/themes/activate",
                json={"filename": verify_data["disabled"][0]["_filename"]},
                headers={"Content-Type": "application/json"}
            )

    def test_activate_nonexistent_theme(self):
        """POST /api/themes/activate - should return 404 for nonexistent theme"""
        payload = {"filename": "nonexistent_theme_12345.json"}
        response = requests.post(
            f"{BASE_URL}/api/themes/activate",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 404

    def test_delete_theme(self):
        """DELETE /api/themes/{filename} - should remove theme"""
        # Create a theme to delete
        create_payload = {
            "name": "TEST_ToDelete",
            "description": "Will be deleted",
            "accent_color": "#999999"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/themes/create",
            json=create_payload,
            headers={"Content-Type": "application/json"}
        )
        assert create_response.status_code == 200
        
        filename = create_response.json()["_filename"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/themes/{filename}")
        assert delete_response.status_code == 200
        assert delete_response.json()["status"] == "deleted"
        
        # Verify it's gone
        list_response = requests.get(f"{BASE_URL}/api/themes")
        list_data = list_response.json()
        all_filenames = [t["_filename"] for t in list_data["active"] + list_data["disabled"]]
        assert filename not in all_filenames

    def test_delete_nonexistent_theme(self):
        """DELETE /api/themes/{filename} - should return 404 for nonexistent"""
        response = requests.delete(f"{BASE_URL}/api/themes/nonexistent_abc123.json")
        assert response.status_code == 404


class TestSteamGridDBAPI:
    """SteamGridDB Asset Engine API tests"""

    def test_search_games(self):
        """GET /api/steamgriddb/search/{term} - should search games"""
        response = requests.get(f"{BASE_URL}/api/steamgriddb/search/Halo")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert isinstance(data["results"], list)
        assert len(data["results"]) > 0, "Should find Halo games"
        
        # Verify game structure
        game = data["results"][0]
        assert "id" in game
        assert "name" in game
        assert "Halo" in game["name"] or "halo" in game["name"].lower()

    def test_search_games_halo3(self):
        """GET /api/steamgriddb/search/Halo 3 - specific search"""
        response = requests.get(f"{BASE_URL}/api/steamgriddb/search/Halo%203")
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        
        # Find Halo 3 specifically
        halo3_ids = [g for g in data["results"] if g.get("id") == 37017]
        # Halo 3 should be in results
        assert any("Halo 3" in g["name"] for g in data["results"])

    def test_get_all_assets(self):
        """GET /api/steamgriddb/assets/{game_id} - should return grids, heroes, logos"""
        # Halo 3 game_id = 37017
        response = requests.get(f"{BASE_URL}/api/steamgriddb/assets/37017")
        assert response.status_code == 200
        
        data = response.json()
        assert "grids" in data
        assert "heroes" in data
        assert "logos" in data
        
        assert isinstance(data["grids"], list)
        assert isinstance(data["heroes"], list)
        assert isinstance(data["logos"], list)
        
        # Should have some assets
        assert len(data["grids"]) > 0, "Should have grid art for Halo 3"
        assert len(data["heroes"]) > 0, "Should have hero art for Halo 3"
        assert len(data["logos"]) > 0, "Should have logo art for Halo 3"

    def test_get_grids(self):
        """GET /api/steamgriddb/grids/{game_id} - should return grid covers"""
        response = requests.get(f"{BASE_URL}/api/steamgriddb/grids/37017?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        
        if data["data"]:
            grid = data["data"][0]
            assert "id" in grid
            assert "url" in grid
            assert "thumb" in grid

    def test_get_heroes(self):
        """GET /api/steamgriddb/heroes/{game_id} - should return hero banners"""
        response = requests.get(f"{BASE_URL}/api/steamgriddb/heroes/37017?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        
        if data["data"]:
            hero = data["data"][0]
            assert "id" in hero
            assert "url" in hero
            assert "thumb" in hero

    def test_get_logos(self):
        """GET /api/steamgriddb/logos/{game_id} - should return game logos"""
        response = requests.get(f"{BASE_URL}/api/steamgriddb/logos/37017?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        
        if data["data"]:
            logo = data["data"][0]
            assert "id" in logo
            assert "url" in logo
            assert "thumb" in logo


class TestThemeSwapMechanism:
    """Tests to verify only 1 active theme at a time (swap mechanism)"""

    def test_swap_enforces_single_active(self):
        """Activating a theme should deactivate the current one"""
        # Get themes
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        if len(data["disabled"]) < 1:
            pytest.skip("Need at least 1 disabled theme for swap test")
        
        # Get initial state
        initial_active_count = len(data["active"])
        
        # Activate a disabled theme
        disabled_theme = data["disabled"][0]
        activate_response = requests.post(
            f"{BASE_URL}/api/themes/activate",
            json={"filename": disabled_theme["_filename"]},
            headers={"Content-Type": "application/json"}
        )
        assert activate_response.status_code == 200
        
        # Check there's still only 1 active
        verify_response = requests.get(f"{BASE_URL}/api/themes")
        verify_data = verify_response.json()
        
        assert len(verify_data["active"]) == 1, "Should always have exactly 1 active theme after swap"

    def test_multiple_activations_keep_single_active(self):
        """Multiple consecutive activations should always result in 1 active"""
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        if len(data["disabled"]) < 2:
            pytest.skip("Need at least 2 disabled themes")
        
        # Activate first
        requests.post(
            f"{BASE_URL}/api/themes/activate",
            json={"filename": data["disabled"][0]["_filename"]},
            headers={"Content-Type": "application/json"}
        )
        
        # Get updated list
        mid_response = requests.get(f"{BASE_URL}/api/themes")
        mid_data = mid_response.json()
        assert len(mid_data["active"]) == 1
        
        # Activate second
        if mid_data["disabled"]:
            requests.post(
                f"{BASE_URL}/api/themes/activate",
                json={"filename": mid_data["disabled"][0]["_filename"]},
                headers={"Content-Type": "application/json"}
            )
        
        # Final check
        final_response = requests.get(f"{BASE_URL}/api/themes")
        final_data = final_response.json()
        assert len(final_data["active"]) == 1, "Should still have exactly 1 active"


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_themes():
    """Cleanup test-created themes after all tests"""
    yield
    
    # Cleanup TEST_ prefixed themes
    try:
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        for theme in data["disabled"] + data["active"]:
            if theme["name"].startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/themes/{theme['_filename']}")
    except Exception:
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
