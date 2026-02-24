"""
Test new features: Delete Diploma and Clear Scan Logs
Tests for iteration 4 of ORVITI Academy testing
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@orviti.com"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestLogin:
    """Test login functionality"""
    
    def test_login_success(self):
        """Test successful login with test credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestDeleteDiploma:
    """Test delete diploma functionality (DELETE /api/diplomas/{diploma_id})"""
    
    def test_delete_diploma_flow(self, auth_headers):
        """Test creating a diploma and then deleting it permanently"""
        # Step 1: Create a test course
        course_data = {
            "name": f"TEST_Course_{uuid.uuid4().hex[:8]}",
            "description": "Test course for delete testing",
            "instructor": "Test Instructor",
            "duration_hours": 10
        }
        course_response = requests.post(
            f"{BASE_URL}/api/courses",
            json=course_data,
            headers=auth_headers
        )
        assert course_response.status_code == 200
        course_id = course_response.json()["id"]
        
        # Step 2: Create a test recipient
        recipient_data = {
            "full_name": f"TEST_Recipient_{uuid.uuid4().hex[:8]}",
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "course_id": course_id
        }
        recipient_response = requests.post(
            f"{BASE_URL}/api/recipients",
            json=recipient_data,
            headers=auth_headers
        )
        assert recipient_response.status_code == 200
        recipient_id = recipient_response.json()["id"]
        
        # Step 3: Get a template (assuming one exists)
        templates_response = requests.get(
            f"{BASE_URL}/api/templates",
            headers=auth_headers
        )
        assert templates_response.status_code == 200
        templates = templates_response.json()
        if not templates:
            # Create a basic template if none exists
            template_data = {
                "name": "TEST_Template",
                "background_image_url": "https://example.com/bg.png",
                "fields_config": [],
                "canvas_width": 1123,
                "canvas_height": 794
            }
            template_response = requests.post(
                f"{BASE_URL}/api/templates",
                json=template_data,
                headers=auth_headers
            )
            assert template_response.status_code == 200
            template_id = template_response.json()["id"]
        else:
            template_id = templates[0]["id"]
        
        # Step 4: Generate a diploma
        diploma_data = {
            "course_id": course_id,
            "template_id": template_id,
            "recipient_ids": [recipient_id]
        }
        generate_response = requests.post(
            f"{BASE_URL}/api/diplomas/generate",
            json=diploma_data,
            headers=auth_headers
        )
        assert generate_response.status_code == 200
        data = generate_response.json()
        assert data["generated"] == 1
        diploma_id = data["diplomas"][0]["id"]
        
        # Step 5: Verify diploma exists
        get_response = requests.get(
            f"{BASE_URL}/api/diplomas/{diploma_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        
        # Step 6: DELETE the diploma
        delete_response = requests.delete(
            f"{BASE_URL}/api/diplomas/{diploma_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Diploma deleted"
        
        # Step 7: Verify diploma no longer exists
        verify_response = requests.get(
            f"{BASE_URL}/api/diplomas/{diploma_id}",
            headers=auth_headers
        )
        assert verify_response.status_code == 404
        
        # Cleanup: Delete test course (which also deletes recipients)
        requests.delete(f"{BASE_URL}/api/courses/{course_id}", headers=auth_headers)
    
    def test_delete_diploma_not_found(self, auth_headers):
        """Test deleting a non-existent diploma returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/diplomas/{fake_id}",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestClearScanLogs:
    """Test clear scan logs functionality (DELETE /api/scan-logs/clear)"""
    
    def test_clear_scan_logs(self, auth_headers):
        """Test clearing all scan logs"""
        # Get current scan logs count
        initial_response = requests.get(
            f"{BASE_URL}/api/scan-logs",
            headers=auth_headers
        )
        assert initial_response.status_code == 200
        
        # Clear all scan logs
        clear_response = requests.delete(
            f"{BASE_URL}/api/scan-logs/clear",
            headers=auth_headers
        )
        assert clear_response.status_code == 200
        assert "message" in clear_response.json()
        assert "Cleared" in clear_response.json()["message"]
        
        # Verify logs are cleared
        verify_response = requests.get(
            f"{BASE_URL}/api/scan-logs",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        assert len(verify_response.json()) == 0
    
    def test_get_scan_logs(self, auth_headers):
        """Test getting scan logs returns list"""
        response = requests.get(
            f"{BASE_URL}/api/scan-logs",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestDiplomasAPI:
    """Test diplomas API endpoints"""
    
    def test_get_all_diplomas(self, auth_headers):
        """Test getting all diplomas"""
        response = requests.get(
            f"{BASE_URL}/api/diplomas",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_revoke_diploma_and_reactivate(self, auth_headers):
        """Test revoking and reactivating a diploma"""
        # Get diplomas
        diplomas_response = requests.get(
            f"{BASE_URL}/api/diplomas",
            headers=auth_headers
        )
        assert diplomas_response.status_code == 200
        diplomas = diplomas_response.json()
        
        if not diplomas:
            pytest.skip("No diplomas available for revoke/reactivate test")
        
        diploma_id = diplomas[0]["id"]
        original_status = diplomas[0]["status"]
        
        # Test based on current status
        if original_status == "valid":
            # Revoke
            revoke_response = requests.post(
                f"{BASE_URL}/api/diplomas/{diploma_id}/revoke",
                headers=auth_headers
            )
            assert revoke_response.status_code == 200
            
            # Reactivate back
            reactivate_response = requests.post(
                f"{BASE_URL}/api/diplomas/{diploma_id}/reactivate",
                headers=auth_headers
            )
            assert reactivate_response.status_code == 200
        else:
            # Reactivate
            reactivate_response = requests.post(
                f"{BASE_URL}/api/diplomas/{diploma_id}/reactivate",
                headers=auth_headers
            )
            assert reactivate_response.status_code == 200
            
            # Revoke back
            revoke_response = requests.post(
                f"{BASE_URL}/api/diplomas/{diploma_id}/revoke",
                headers=auth_headers
            )
            assert revoke_response.status_code == 200
            
            # Reactivate to original
            requests.post(f"{BASE_URL}/api/diplomas/{diploma_id}/reactivate", headers=auth_headers)
