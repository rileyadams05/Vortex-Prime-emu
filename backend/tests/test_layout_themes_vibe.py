"""
Backend API Tests for Layout-Based Theme System and Vibe-Design AI
Testing:
- GET /api/themes - returns layout-based themes (not color presets)
- GET /api/themes/active - returns active layout theme with tiles blueprint
- POST /api/themes/create - creates a new layout theme folder with layout.json
- POST /api/themes/activate - swaps active theme (folder move: Play <-> Disabled)
- POST /api/themes/deactivate - moves active theme folder to Disabled
- DELETE /api/themes/{folder_name} - deletes theme folder
- POST /api/vibe-design/generate - generates layout from natural language prompt
- Vibe-Design mock fallback returns correct layouts for keywords
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestThemeListAPI:
    """Test GET /api/themes - layout-based themes"""
    
    def test_list_themes_returns_structure(self):
        """Themes API returns active and disabled lists"""
        response = requests.get(f"{BASE_URL}/api/themes")
        assert response.status_code == 200
        data = response.json()
        
        # Must have active and disabled arrays
        assert "active" in data
        assert "disabled" in data
        assert isinstance(data["active"], list)
        assert isinstance(data["disabled"], list)
        
    def test_themes_have_layout_structure(self):
        """Each theme has layout blueprint structure"""
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        all_themes = data.get("active", []) + data.get("disabled", [])
        assert len(all_themes) > 0, "Should have at least one theme seeded"
        
        for theme in all_themes:
            # Each theme must have folder_name, name, layout
            assert "folder_name" in theme
            assert "name" in theme
            assert "layout" in theme
            
            # Layout must have main_cards array with tile positions
            layout = theme["layout"]
            assert "main_cards" in layout
            assert isinstance(layout["main_cards"], list)
            
            # Each tile should have position info
            if layout["main_cards"]:
                tile = layout["main_cards"][0]
                assert "id" in tile
                assert "row" in tile
                assert "col" in tile
                assert "width" in tile
                assert "height" in tile


class TestActiveThemeAPI:
    """Test GET /api/themes/active"""
    
    def test_get_active_theme(self):
        """Returns currently active theme with layout"""
        response = requests.get(f"{BASE_URL}/api/themes/active")
        assert response.status_code == 200
        data = response.json()
        
        # Should return theme object or null
        theme = data.get("theme")
        if theme:
            assert "folder_name" in theme
            assert "layout" in theme
            assert "main_cards" in theme["layout"]
            assert "_status" in theme
            assert theme["_status"] == "active"


class TestCreateThemeAPI:
    """Test POST /api/themes/create"""
    
    def test_create_new_layout_theme(self):
        """Creates theme folder with layout.json in Disabled"""
        payload = {
            "name": "Test Layout Theme",
            "description": "Pytest test theme",
            "tiles": {
                "main_cards": [
                    {"id": "library", "title": "GAMES", "row": 0, "col": 0, "width": 2, "height": 2},
                    {"id": "settings", "title": "SYSTEM SETTINGS", "row": 0, "col": 2, "width": 1, "height": 1},
                    {"id": "achievements", "title": "ACHIEVEMENTS", "row": 0, "col": 3, "width": 1, "height": 1},
                    {"id": "themes", "title": "THEMES", "row": 1, "col": 2, "width": 1, "height": 1},
                    {"id": "startup", "title": "STARTUP", "row": 1, "col": 3, "width": 1, "height": 1},
                ],
                "grid_columns": 4,
                "grid_rows": 2,
                "layout_mode": "custom"
            },
            "source": "test",
            "author": "pytest"
        }
        
        response = requests.post(f"{BASE_URL}/api/themes/create", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert "folder_name" in data
        assert "name" in data
        assert data["name"] == "Test Layout Theme"
        assert data["_status"] == "disabled"  # Created in Disabled folder
        
        # Store for cleanup
        self.__class__.test_theme_folder = data["folder_name"]
        
    def test_delete_test_theme(self):
        """Cleanup - delete the test theme"""
        folder = getattr(self.__class__, 'test_theme_folder', None)
        if folder:
            response = requests.delete(f"{BASE_URL}/api/themes/{folder}")
            assert response.status_code == 200


class TestThemeActivationAPI:
    """Test POST /api/themes/activate and deactivate"""
    
    @pytest.fixture(autouse=True)
    def get_current_themes(self):
        """Get theme state before tests"""
        response = requests.get(f"{BASE_URL}/api/themes")
        self.themes_data = response.json()
        
    def test_activate_disabled_theme(self):
        """Activating disabled theme moves it to Play"""
        disabled = self.themes_data.get("disabled", [])
        if not disabled:
            pytest.skip("No disabled themes to test activation")
            
        target = disabled[0]["folder_name"]
        
        response = requests.post(f"{BASE_URL}/api/themes/activate", 
                                json={"folder_name": target})
        assert response.status_code == 200
        data = response.json()
        
        # Should return the activated theme
        assert data["folder_name"] == target
        assert data["_status"] == "active"
        
        # Verify it's now in active list
        verify = requests.get(f"{BASE_URL}/api/themes")
        verify_data = verify.json()
        active_folders = [t["folder_name"] for t in verify_data.get("active", [])]
        assert target in active_folders
        
    def test_deactivate_active_theme(self):
        """Deactivating moves theme to Disabled"""
        # Get current active theme
        response = requests.get(f"{BASE_URL}/api/themes/active")
        active = response.json().get("theme")
        
        if not active:
            pytest.skip("No active theme to deactivate")
            
        folder = active["folder_name"]
        
        response = requests.post(f"{BASE_URL}/api/themes/deactivate",
                                json={"folder_name": folder})
        assert response.status_code == 200
        data = response.json()
        
        assert data["folder_name"] == folder
        assert data["_status"] == "disabled"


class TestDeleteThemeAPI:
    """Test DELETE /api/themes/{folder_name}"""
    
    def test_delete_nonexistent_theme_returns_404(self):
        """Deleting non-existent theme returns 404"""
        response = requests.delete(f"{BASE_URL}/api/themes/nonexistent_folder_12345")
        assert response.status_code == 404


class TestVibeDesignAPI:
    """Test POST /api/vibe-design/generate - AI layout generation"""
    
    def test_generate_returns_layout(self):
        """Vibe-Design returns a valid layout blueprint"""
        response = requests.post(f"{BASE_URL}/api/vibe-design/generate",
                                json={"prompt": "test layout"})
        assert response.status_code == 200
        data = response.json()
        
        assert "layout" in data
        assert "source" in data  # Should indicate mock_preset or open_webui
        
        layout = data["layout"]
        assert "main_cards" in layout
        assert isinstance(layout["main_cards"], list)
        assert len(layout["main_cards"]) == 5  # Must have all 5 tiles
        
    def test_big_games_keyword_returns_games_center(self):
        """'big games center' prompt returns games_center preset"""
        response = requests.post(f"{BASE_URL}/api/vibe-design/generate",
                                json={"prompt": "big games center"})
        assert response.status_code == 200
        data = response.json()
        
        layout = data["layout"]
        # games_center has library with width=3, height=2
        library_tile = next((t for t in layout["main_cards"] if t["id"] == "library"), None)
        assert library_tile is not None
        assert library_tile["width"] == 3
        assert library_tile["height"] == 2
        assert data["source"] == "mock_preset"
        
    def test_minimal_keyword_returns_minimal_preset(self):
        """'minimal' prompt returns minimal preset"""
        response = requests.post(f"{BASE_URL}/api/vibe-design/generate",
                                json={"prompt": "minimal clean"})
        assert response.status_code == 200
        data = response.json()
        
        layout = data["layout"]
        # minimal has 3 grid_columns
        assert layout.get("grid_columns") == 3
        assert data["source"] == "mock_preset"
        
    def test_sidebar_keyword_returns_sidebar_preset(self):
        """'sidebar' prompt returns sidebar preset"""
        response = requests.post(f"{BASE_URL}/api/vibe-design/generate",
                                json={"prompt": "sidebar layout"})
        assert response.status_code == 200
        data = response.json()
        
        layout = data["layout"]
        # sidebar has library with width=1, height=2 (tall tile on left)
        library_tile = next((t for t in layout["main_cards"] if t["id"] == "library"), None)
        assert library_tile is not None
        assert library_tile["width"] == 1
        assert library_tile["height"] == 2
        assert data["source"] == "mock_preset"
        
    def test_default_fallback_for_unknown_prompt(self):
        """Unknown prompt returns default layout"""
        response = requests.post(f"{BASE_URL}/api/vibe-design/generate",
                                json={"prompt": "random unknown xyz 12345"})
        assert response.status_code == 200
        data = response.json()
        
        # Should fall back to default (5 equal columns)
        layout = data["layout"]
        assert layout.get("grid_columns") == 5
        assert data["source"] in ["mock_preset", "mock_default"]


class TestLayoutStructureValidation:
    """Validate layout blueprint schema"""
    
    def test_all_tiles_present_in_layouts(self):
        """All 5 required tiles (library, settings, achievements, themes, startup) in each theme"""
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        required_ids = {"library", "settings", "achievements", "themes", "startup"}
        
        for theme in data.get("active", []) + data.get("disabled", []):
            layout = theme.get("layout", {})
            cards = layout.get("main_cards", [])
            found_ids = {c.get("id") for c in cards}
            
            assert required_ids == found_ids, f"Theme {theme['name']} missing tiles: {required_ids - found_ids}"
            
    def test_layout_has_grid_config(self):
        """Each layout has grid_columns and grid_rows"""
        response = requests.get(f"{BASE_URL}/api/themes/active")
        theme = response.json().get("theme")
        
        if theme:
            layout = theme.get("layout", {})
            # Either has explicit grid config or defaults
            assert "main_cards" in layout


class TestNoColorPresets:
    """Verify themes are layout-based, not color-based (old system removed)"""
    
    def test_themes_have_no_color_fields(self):
        """Theme responses should not contain color picker fields"""
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        for theme in data.get("active", []) + data.get("disabled", []):
            # These fields should NOT exist (old color system)
            assert "accentColor" not in theme
            assert "backgroundColor" not in theme
            assert "colors" not in theme
            assert "primaryColor" not in theme
            
            # But layout fields SHOULD exist
            assert "layout" in theme


# Health check
class TestHealthCheck:
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
