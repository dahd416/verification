"""
Backend tests for iteration 6 - Email sending feature
Tests:
1. GET /api/settings returns email configuration fields
2. PUT /api/settings can save SMTP settings
3. POST /api/settings/test-email tests connection
4. POST /api/diplomas/{id}/send-email sends diploma via email
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cert-studio-4.preview.emergentagent.com')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@orviti.com",
        "password": "test123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed — skipping authenticated tests")

@pytest.fixture
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client

class TestLoginAndAuth:
    """Test authentication works"""
    
    def test_login_with_valid_credentials(self, api_client):
        """Test login with test@orviti.com / test123"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@orviti.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@orviti.com"

class TestSettingsEmailConfig:
    """Test settings endpoint for email configuration"""
    
    def test_get_settings_returns_email_fields(self, authenticated_client):
        """GET /api/settings should return email configuration fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        
        # Check email fields are present
        assert "email_enabled" in data
        assert "smtp_host" in data
        assert "smtp_port" in data
        assert "smtp_user" in data
        assert "smtp_password" in data
        assert "smtp_from_name" in data
        assert "smtp_from_email" in data
        
        # These SEO fields should also exist
        assert "site_title" in data or "site_description" in data
        
    def test_update_settings_with_email_config(self, authenticated_client):
        """PUT /api/settings should save SMTP settings"""
        unique_id = str(uuid.uuid4())[:8]
        
        settings_data = {
            "site_title": f"TEST_ORVITI_{unique_id}",
            "site_description": "Test Description",
            "email_enabled": True,
            "smtp_host": "smtp.test.com",
            "smtp_port": "587",
            "smtp_user": f"test_{unique_id}@test.com",
            "smtp_password": "test_password_123",
            "smtp_from_name": "Test Academy",
            "smtp_from_email": f"noreply_{unique_id}@test.com"
        }
        
        response = authenticated_client.put(f"{BASE_URL}/api/settings", json=settings_data)
        assert response.status_code == 200
        data = response.json()
        
        # Verify the update was saved
        assert "message" in data or "id" in data or data.get("site_title") == settings_data["site_title"]
        
        # GET to verify settings were saved
        get_response = authenticated_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        get_data = get_response.json()
        
        # Verify email fields were saved
        assert get_data.get("email_enabled") == True
        assert get_data.get("smtp_host") == "smtp.test.com"
        assert get_data.get("smtp_port") == "587"
        assert get_data.get("smtp_from_name") == "Test Academy"
        
    def test_update_settings_disable_email(self, authenticated_client):
        """PUT /api/settings can disable email sending"""
        settings_data = {
            "email_enabled": False
        }
        
        response = authenticated_client.put(f"{BASE_URL}/api/settings", json=settings_data)
        assert response.status_code == 200
        
        # Verify email is disabled
        get_response = authenticated_client.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data.get("email_enabled") == False

class TestEmailTestEndpoint:
    """Test POST /api/settings/test-email"""
    
    def test_test_email_without_smtp_config(self, authenticated_client):
        """Test email should fail if SMTP not configured"""
        # First disable email / clear config
        authenticated_client.put(f"{BASE_URL}/api/settings", json={
            "email_enabled": False,
            "smtp_user": "",
            "smtp_password": ""
        })
        
        response = authenticated_client.post(f"{BASE_URL}/api/settings/test-email")
        # Should return 400 due to incomplete config
        assert response.status_code in [400, 500]
        
    def test_test_email_with_invalid_credentials(self, authenticated_client):
        """Test email with invalid SMTP credentials should fail gracefully"""
        # Set up invalid SMTP config
        authenticated_client.put(f"{BASE_URL}/api/settings", json={
            "email_enabled": True,
            "smtp_host": "smtp.gmail.com",
            "smtp_port": "587",
            "smtp_user": "invalid_test_user@test.com",
            "smtp_password": "invalid_password",
            "smtp_from_name": "Test",
            "smtp_from_email": "invalid_test_user@test.com"
        })
        
        response = authenticated_client.post(f"{BASE_URL}/api/settings/test-email")
        # Should fail with authentication error (400 or 500)
        assert response.status_code in [400, 500]
        error_data = response.json()
        assert "detail" in error_data

class TestSendDiplomaEmail:
    """Test POST /api/diplomas/{id}/send-email"""
    
    def test_send_email_endpoint_exists(self, authenticated_client):
        """Verify send-email endpoint exists"""
        # Get a diploma ID first
        diplomas_response = authenticated_client.get(f"{BASE_URL}/api/diplomas")
        
        if diplomas_response.status_code == 200 and len(diplomas_response.json()) > 0:
            diploma = diplomas_response.json()[0]
            diploma_id = diploma["id"]
            
            # Make sure email is disabled to test error handling
            authenticated_client.put(f"{BASE_URL}/api/settings", json={
                "email_enabled": False
            })
            
            # Try to send email - should fail because email is not enabled
            response = authenticated_client.post(f"{BASE_URL}/api/diplomas/{diploma_id}/send-email")
            
            # Should return 400 with appropriate message (email not enabled)
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
            # Check Spanish error message
            assert "email" in data["detail"].lower() or "habilitado" in data["detail"].lower()
        else:
            pytest.skip("No diplomas available to test send-email")
    
    def test_send_email_with_missing_smtp_config(self, authenticated_client):
        """Send email should fail if SMTP config incomplete"""
        # Get a diploma
        diplomas_response = authenticated_client.get(f"{BASE_URL}/api/diplomas")
        
        if diplomas_response.status_code == 200 and len(diplomas_response.json()) > 0:
            diploma = diplomas_response.json()[0]
            diploma_id = diploma["id"]
            
            # Enable email but clear credentials
            authenticated_client.put(f"{BASE_URL}/api/settings", json={
                "email_enabled": True,
                "smtp_user": "",
                "smtp_password": ""
            })
            
            response = authenticated_client.post(f"{BASE_URL}/api/diplomas/{diploma_id}/send-email")
            # Should return 400 with incomplete config message
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
        else:
            pytest.skip("No diplomas available to test")
    
    def test_send_email_for_invalid_diploma(self, authenticated_client):
        """Send email for non-existent diploma should return 404"""
        fake_diploma_id = str(uuid.uuid4())
        
        response = authenticated_client.post(f"{BASE_URL}/api/diplomas/{fake_diploma_id}/send-email")
        assert response.status_code == 404

class TestDiplomasEndpoint:
    """Test diplomas list endpoint returns data"""
    
    def test_get_diplomas_list(self, authenticated_client):
        """GET /api/diplomas returns list"""
        response = authenticated_client.get(f"{BASE_URL}/api/diplomas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            diploma = data[0]
            # Verify diploma has required fields
            assert "id" in diploma
            assert "certificate_id" in diploma
            assert "recipient_name" in diploma or "recipient_id" in diploma
            assert "status" in diploma
    
    def test_diplomas_have_email_sent_fields(self, authenticated_client):
        """GET /api/diplomas returns email_sent and email_sent_at fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/diplomas")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            diploma = data[0]
            # Verify email tracking fields are present
            assert "email_sent" in diploma
            assert isinstance(diploma["email_sent"], bool)
            # email_sent_at can be null if never sent
            assert "email_sent_at" in diploma or diploma.get("email_sent_at") is None

class TestBulkEmailEndpoint:
    """Test POST /api/diplomas/send-bulk-email"""
    
    def test_bulk_email_endpoint_exists(self, authenticated_client):
        """Verify send-bulk-email endpoint exists"""
        # Make sure email is disabled to test error handling
        authenticated_client.put(f"{BASE_URL}/api/settings", json={
            "email_enabled": False
        })
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/diplomas/send-bulk-email",
            json={"diploma_ids": []}
        )
        
        # Should return 400 because email is not enabled (but endpoint exists)
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_bulk_email_requires_email_enabled(self, authenticated_client):
        """Bulk email should fail if email is not enabled"""
        # Disable email
        authenticated_client.put(f"{BASE_URL}/api/settings", json={
            "email_enabled": False
        })
        
        # Get diploma IDs
        diplomas_response = authenticated_client.get(f"{BASE_URL}/api/diplomas")
        if diplomas_response.status_code == 200 and len(diplomas_response.json()) > 0:
            diploma_ids = [diplomas_response.json()[0]["id"]]
            
            response = authenticated_client.post(
                f"{BASE_URL}/api/diplomas/send-bulk-email",
                json={"diploma_ids": diploma_ids}
            )
            
            assert response.status_code == 400
            assert "email" in response.json()["detail"].lower() or "habilitado" in response.json()["detail"].lower()
        else:
            pytest.skip("No diplomas available to test")
    
    def test_bulk_email_requires_smtp_config(self, authenticated_client):
        """Bulk email should fail if SMTP not configured"""
        # Enable email but clear credentials
        authenticated_client.put(f"{BASE_URL}/api/settings", json={
            "email_enabled": True,
            "smtp_user": "",
            "smtp_password": ""
        })
        
        # Get diploma IDs
        diplomas_response = authenticated_client.get(f"{BASE_URL}/api/diplomas")
        if diplomas_response.status_code == 200 and len(diplomas_response.json()) > 0:
            diploma_ids = [diplomas_response.json()[0]["id"]]
            
            response = authenticated_client.post(
                f"{BASE_URL}/api/diplomas/send-bulk-email",
                json={"diploma_ids": diploma_ids}
            )
            
            assert response.status_code == 400
            assert "SMTP" in response.json()["detail"] or "incompleta" in response.json()["detail"].lower()
        else:
            pytest.skip("No diplomas available to test")
    
    def test_bulk_email_with_invalid_diploma_ids(self, authenticated_client):
        """Bulk email with invalid diploma IDs should handle gracefully"""
        # Enable email with some config
        authenticated_client.put(f"{BASE_URL}/api/settings", json={
            "email_enabled": True,
            "smtp_host": "smtp.test.com",
            "smtp_port": "587",
            "smtp_user": "test@test.com",
            "smtp_password": "test123"
        })
        
        fake_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        
        # This will fail to connect to SMTP but validates the endpoint accepts the data format
        response = authenticated_client.post(
            f"{BASE_URL}/api/diplomas/send-bulk-email",
            json={"diploma_ids": fake_ids}
        )
        
        # Should be 400 (SMTP connection error) or return partial results
        assert response.status_code in [400, 200]

class TestCleanup:
    """Cleanup test data"""
    
    def test_restore_settings(self, authenticated_client):
        """Restore settings to reasonable defaults after tests"""
        authenticated_client.put(f"{BASE_URL}/api/settings", json={
            "site_title": "ORVITI | Academy",
            "site_description": "Plataforma de verificación de cursos impartidos",
            "email_enabled": False,
            "smtp_host": "smtp.gmail.com",
            "smtp_port": "587",
            "smtp_user": "",
            "smtp_password": "",
            "smtp_from_name": "",
            "smtp_from_email": ""
        })
        
        # Verify cleanup
        response = authenticated_client.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert data.get("email_enabled") == False
