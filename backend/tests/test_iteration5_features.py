"""
Backend API Tests for Iteration 5 - New Features Testing
- Login condicional "Crear Cuenta" (check-first-user API)
- CRUD Usuarios con protección del admin base
- Configuración de branding/SEO
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cert-studio-4.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@orviti.com"
TEST_PASSWORD = "test123"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture
def auth_headers(auth_token):
    """Return auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestCheckFirstUser:
    """Tests for check-first-user endpoint - conditional register button"""
    
    def test_check_first_user_returns_has_users(self):
        """GET /api/check-first-user should return has_users flag"""
        response = requests.get(f"{BASE_URL}/api/check-first-user")
        assert response.status_code == 200
        data = response.json()
        assert "has_users" in data
        assert isinstance(data["has_users"], bool)
        # Since we have a test user, should be True
        assert data["has_users"] == True
    

class TestPublicSettings:
    """Tests for public settings endpoint - login branding"""
    
    def test_get_public_settings(self):
        """GET /api/settings/public should return settings without auth"""
        response = requests.get(f"{BASE_URL}/api/settings/public")
        assert response.status_code == 200
        data = response.json()
        # Should have expected fields
        assert "login_logo_url" in data
        assert "site_title" in data
        assert "site_description" in data


class TestUsersEndpoints:
    """Tests for Users CRUD module with base admin protection"""
    
    def test_get_users_list(self, auth_headers):
        """GET /api/users should return user list with is_base_admin flag"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) >= 1
        # Check that users have the is_base_admin flag
        base_admin_found = False
        for user in users:
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "is_base_admin" in user
            if user["is_base_admin"]:
                base_admin_found = True
        assert base_admin_found, "Should have at least one base admin"
    
    def test_create_user(self, auth_headers):
        """POST /api/users should create new user"""
        unique_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "email": unique_email,
                "password": "testpass123",
                "name": "TEST User Created"
            }
        )
        assert response.status_code == 200, f"Create user failed: {response.text}"
        user = response.json()
        assert user["email"] == unique_email
        assert user["name"] == "TEST User Created"
        assert "id" in user
        
        # Verify user appears in list
        list_response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = list_response.json()
        user_ids = [u["id"] for u in users]
        assert user["id"] in user_ids
        
        # Cleanup: delete the test user
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{user['id']}", 
            headers=auth_headers
        )
        assert delete_response.status_code == 200
    
    def test_create_user_duplicate_email_fails(self, auth_headers):
        """POST /api/users with existing email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "email": TEST_EMAIL,  # Existing email
                "password": "testpass123",
                "name": "Duplicate User"
            }
        )
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
    
    def test_update_user(self, auth_headers):
        """PUT /api/users/{id} should update user"""
        # First create a user to update
        unique_email = f"TEST_update_{uuid.uuid4().hex[:8]}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "email": unique_email,
                "password": "testpass123",
                "name": "TEST Original Name"
            }
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update the user
        new_email = f"TEST_updated_{uuid.uuid4().hex[:8]}@test.com"
        update_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            headers=auth_headers,
            json={
                "email": new_email,
                "name": "TEST Updated Name"
            }
        )
        assert update_response.status_code == 200
        
        # Verify update
        list_response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = list_response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        assert updated_user is not None
        assert updated_user["email"] == new_email
        assert updated_user["name"] == "TEST Updated Name"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_cannot_delete_base_admin(self, auth_headers):
        """DELETE /api/users/{base_admin_id} should fail"""
        # Get the base admin
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        users = response.json()
        base_admin = next((u for u in users if u.get("is_base_admin")), None)
        assert base_admin is not None
        
        # Try to delete base admin
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{base_admin['id']}",
            headers=auth_headers
        )
        # Should fail with 400 (cannot delete self) or 403 (cannot delete base admin)
        assert delete_response.status_code in [400, 403]
    
    def test_delete_user(self, auth_headers):
        """DELETE /api/users/{id} should delete non-base-admin user"""
        # Create a user to delete
        unique_email = f"TEST_delete_{uuid.uuid4().hex[:8]}@test.com"
        create_response = requests.post(
            f"{BASE_URL}/api/users",
            headers=auth_headers,
            json={
                "email": unique_email,
                "password": "testpass123",
                "name": "TEST User To Delete"
            }
        )
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Delete the user
        delete_response = requests.delete(
            f"{BASE_URL}/api/users/{user_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        
        # Verify deleted
        list_response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        user_ids = [u["id"] for u in list_response.json()]
        assert user_id not in user_ids


class TestSettingsEndpoints:
    """Tests for Settings/Configuration module"""
    
    def test_get_settings(self, auth_headers):
        """GET /api/settings should return organization settings"""
        response = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Check all expected fields
        assert "organization_id" in data
        assert "login_logo_url" in data
        assert "sidebar_logo_url" in data
        assert "favicon_url" in data
        assert "site_title" in data
        assert "site_description" in data
    
    def test_update_settings(self, auth_headers):
        """PUT /api/settings should update settings"""
        # First get current settings
        current = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers).json()
        
        # Update with new values
        update_data = {
            "site_title": "TEST ORVITI Academy Updated",
            "site_description": "TEST Description Updated"
        }
        response = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify update
        verify = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers).json()
        assert verify["site_title"] == "TEST ORVITI Academy Updated"
        assert verify["site_description"] == "TEST Description Updated"
        
        # Restore original values
        restore_data = {
            "site_title": current.get("site_title") or "ORVITI Academy",
            "site_description": current.get("site_description") or "Sistema de Gestión de Diplomas Digitales"
        }
        requests.put(f"{BASE_URL}/api/settings", headers=auth_headers, json=restore_data)
    
    def test_update_logo_urls(self, auth_headers):
        """PUT /api/settings should update logo URLs"""
        # First get current
        current = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers).json()
        
        # Update logos
        update_data = {
            "login_logo_url": "https://example.com/test-login-logo.png",
            "sidebar_logo_url": "https://example.com/test-sidebar-logo.png",
            "favicon_url": "https://example.com/test-favicon.ico"
        }
        response = requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200
        
        # Verify update
        verify = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers).json()
        assert verify["login_logo_url"] == update_data["login_logo_url"]
        assert verify["sidebar_logo_url"] == update_data["sidebar_logo_url"]
        assert verify["favicon_url"] == update_data["favicon_url"]
        
        # Restore original values (null if not set)
        restore_data = {
            "login_logo_url": current.get("login_logo_url"),
            "sidebar_logo_url": current.get("sidebar_logo_url"),
            "favicon_url": current.get("favicon_url")
        }
        requests.put(f"{BASE_URL}/api/settings", headers=auth_headers, json=restore_data)
    
    def test_public_settings_reflects_changes(self, auth_headers):
        """GET /api/settings/public should reflect updated settings"""
        # Update settings
        test_title = f"TEST_Title_{uuid.uuid4().hex[:6]}"
        requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"site_title": test_title}
        )
        
        # Check public endpoint
        public = requests.get(f"{BASE_URL}/api/settings/public").json()
        assert public["site_title"] == test_title
        
        # Restore
        requests.put(
            f"{BASE_URL}/api/settings",
            headers=auth_headers,
            json={"site_title": "ORVITI Academy"}
        )


class TestTemplatesAndPDFGeneration:
    """Tests related to templates and custom PDF generation"""
    
    def test_get_templates(self, auth_headers):
        """GET /api/templates should return templates list"""
        response = requests.get(f"{BASE_URL}/api/templates", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()
        assert isinstance(templates, list)
    
    def test_template_has_fields_config(self, auth_headers):
        """Templates should have fields_config and background_image_url"""
        response = requests.get(f"{BASE_URL}/api/templates", headers=auth_headers)
        templates = response.json()
        if len(templates) > 0:
            template = templates[0]
            assert "fields_config" in template
            assert "background_image_url" in template
            assert "canvas_width" in template
            assert "canvas_height" in template
            assert isinstance(template["fields_config"], list)
    
    def test_get_diplomas(self, auth_headers):
        """GET /api/diplomas should return diplomas list"""
        response = requests.get(f"{BASE_URL}/api/diplomas", headers=auth_headers)
        assert response.status_code == 200
        diplomas = response.json()
        assert isinstance(diplomas, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
