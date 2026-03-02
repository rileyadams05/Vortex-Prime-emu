"""
Backend API tests for Xbox 360 Dashboard Restructure
Tests theme APIs, startup/wallpaper management

Test coverage:
- Theme listing API (active/disabled separation)
- Theme activation/deactivation
- Startup videos API
- Wallpapers API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestThemeAPIs:
    """Tests for layout-based theme system APIs"""
    
    def test_get_themes_returns_active_disabled_structure(self):
        """GET /api/themes returns both active and disabled theme arrays"""
        response = requests.get(f"{BASE_URL}/api/themes")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "active" in data, "Response should have 'active' key"
        assert "disabled" in data, "Response should have 'disabled' key"
        assert isinstance(data["active"], list), "active should be a list"
        assert isinstance(data["disabled"], list), "disabled should be a list"
        print(f"✓ Themes API returns {len(data['active'])} active, {len(data['disabled'])} disabled themes")
    
    def test_get_active_theme(self):
        """GET /api/themes/active returns current active theme or null"""
        response = requests.get(f"{BASE_URL}/api/themes/active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "theme" in data, "Response should have 'theme' key"
        # theme can be null or an object
        if data["theme"]:
            assert "layout" in data["theme"], "Active theme should have layout"
            assert "folder_name" in data["theme"], "Active theme should have folder_name"
        print(f"✓ Active theme: {data['theme']['name'] if data['theme'] else 'None'}")

    def test_theme_has_layout_properties(self):
        """Themes should have layout-based properties, not color properties"""
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        all_themes = data["active"] + data["disabled"]
        assert len(all_themes) > 0, "Should have at least one theme"
        
        theme = all_themes[0]
        # Should have layout
        assert "layout" in theme, "Theme should have layout"
        layout = theme["layout"]
        
        # Layout should have grid structure
        assert "main_cards" in layout, "Layout should have main_cards"
        assert "grid_columns" in layout, "Layout should have grid_columns"
        
        # Should NOT have color fields
        assert "accentColor" not in theme, "Should not have accentColor"
        assert "colors" not in theme, "Should not have colors"
        
        print(f"✓ Theme '{theme['name']}' has layout-based structure")

    def test_theme_activation(self):
        """POST /api/themes/activate works for disabled themes"""
        # First get a disabled theme
        response = requests.get(f"{BASE_URL}/api/themes")
        data = response.json()
        
        if len(data["disabled"]) == 0:
            pytest.skip("No disabled themes available for activation test")
        
        theme_to_activate = data["disabled"][0]["folder_name"]
        
        # Activate it
        response = requests.post(f"{BASE_URL}/api/themes/activate", json={
            "folder_name": theme_to_activate
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Theme '{theme_to_activate}' activated successfully")
        
        # Verify it's now active
        active_response = requests.get(f"{BASE_URL}/api/themes/active")
        active_data = active_response.json()
        assert active_data["theme"] is not None, "Should have an active theme now"
        assert active_data["theme"]["folder_name"] == theme_to_activate, "Activated theme should be the active one"
        print(f"✓ Theme '{theme_to_activate}' is now active")

    def test_theme_deactivation(self):
        """POST /api/themes/deactivate works for active themes"""
        # First ensure we have an active theme
        active_response = requests.get(f"{BASE_URL}/api/themes/active")
        active_data = active_response.json()
        
        if active_data["theme"] is None:
            # Activate one first
            themes_response = requests.get(f"{BASE_URL}/api/themes")
            themes_data = themes_response.json()
            if len(themes_data["disabled"]) == 0:
                pytest.skip("No themes available for deactivation test")
            requests.post(f"{BASE_URL}/api/themes/activate", json={
                "folder_name": themes_data["disabled"][0]["folder_name"]
            })
            active_response = requests.get(f"{BASE_URL}/api/themes/active")
            active_data = active_response.json()
        
        theme_to_deactivate = active_data["theme"]["folder_name"]
        
        # Deactivate it
        response = requests.post(f"{BASE_URL}/api/themes/deactivate", json={
            "folder_name": theme_to_deactivate
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Theme '{theme_to_deactivate}' deactivated successfully")


class TestStartupVideosAPI:
    """Tests for startup video management API"""
    
    def test_get_startup_videos(self):
        """GET /api/startup/videos returns list of videos"""
        response = requests.get(f"{BASE_URL}/api/startup/videos")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "videos" in data, "Response should have 'videos' key"
        assert isinstance(data["videos"], list), "videos should be a list"
        
        # Each video should have name, status, path
        for video in data["videos"]:
            assert "name" in video, "Video should have name"
            assert "status" in video, "Video should have status"
            assert video["status"] in ["active", "disabled"], f"Invalid status: {video['status']}"
        
        print(f"✓ Startup videos API returns {len(data['videos'])} videos")


class TestWallpapersAPI:
    """Tests for wallpaper management API"""
    
    def test_get_wallpapers(self):
        """GET /api/wallpapers returns list of wallpapers"""
        response = requests.get(f"{BASE_URL}/api/wallpapers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "wallpapers" in data, "Response should have 'wallpapers' key"
        assert isinstance(data["wallpapers"], list), "wallpapers should be a list"
        
        # Each wallpaper should have name, status, path
        for wallpaper in data["wallpapers"]:
            assert "name" in wallpaper, "Wallpaper should have name"
            assert "status" in wallpaper, "Wallpaper should have status"
            assert wallpaper["status"] in ["active", "disabled"], f"Invalid status: {wallpaper['status']}"
        
        print(f"✓ Wallpapers API returns {len(data['wallpapers'])} wallpapers")


class TestVibeDesignAPI:
    """Tests for Vibe-Design AI API (uses mock fallback in preview)"""
    
    def test_generate_layout_from_prompt(self):
        """POST /api/vibe-design/generate returns layout from prompt"""
        response = requests.post(f"{BASE_URL}/api/vibe-design/generate", json={
            "prompt": "minimal clean layout"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "layout" in data, "Response should have 'layout' key"
        assert "source" in data, "Response should have 'source' key"
        
        layout = data["layout"]
        assert "main_cards" in layout, "Layout should have main_cards"
        assert len(layout["main_cards"]) >= 5, "Layout should have at least 5 main cards"
        
        print(f"✓ Vibe-Design API generated layout with source: {data['source']}")


class TestHealthcheck:
    """Basic API healthcheck tests"""
    
    def test_api_root(self):
        """GET /api/ returns successful response"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ API root endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
