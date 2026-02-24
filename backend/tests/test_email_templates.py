"""
Email Templates API Integration Tests
Tests the complete CRUD operations for email templates feature
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@orviti.com",
        "password": "test123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture
def created_template(auth_headers):
    """Create a test template and clean up after test"""
    unique_name = f"TEST_Template_{uuid.uuid4().hex[:8]}"
    template_data = {
        "name": unique_name,
        "subject": "Test Subject {{course_name}}",
        "html_content": "<html><body><h1>Test {{recipient_name}}</h1></body></html>",
        "is_default": False
    }
    response = requests.post(f"{BASE_URL}/api/email-templates", 
                           json=template_data, headers=auth_headers)
    assert response.status_code == 200, f"Failed to create template: {response.text}"
    template = response.json()
    
    yield template
    
    # Cleanup - try to delete the template
    try:
        requests.delete(f"{BASE_URL}/api/email-templates/{template['id']}", headers=auth_headers)
    except:
        pass


class TestEmailTemplatesGetList:
    """Tests for GET /api/email-templates endpoint"""
    
    def test_get_templates_returns_list(self, auth_headers):
        """GET /api/email-templates should return a list of templates"""
        response = requests.get(f"{BASE_URL}/api/email-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Should have at least the default template"
    
    def test_default_template_created_automatically(self, auth_headers):
        """A default template should be created automatically if none exist"""
        response = requests.get(f"{BASE_URL}/api/email-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Find default template
        default_templates = [t for t in data if t.get("is_default")]
        assert len(default_templates) >= 1, "Should have at least one default template"
    
    def test_template_response_structure(self, auth_headers):
        """Template response should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/email-templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        template = data[0]
        
        required_fields = ["id", "name", "subject", "html_content", "is_default", "created_at", "updated_at"]
        for field in required_fields:
            assert field in template, f"Missing field: {field}"
    
    def test_get_templates_requires_auth(self):
        """GET /api/email-templates should require authentication"""
        response = requests.get(f"{BASE_URL}/api/email-templates")
        assert response.status_code == 401


class TestEmailTemplatesCreate:
    """Tests for POST /api/email-templates endpoint"""
    
    def test_create_template_success(self, auth_headers):
        """POST /api/email-templates should create a new template"""
        unique_name = f"TEST_Create_{uuid.uuid4().hex[:8]}"
        template_data = {
            "name": unique_name,
            "subject": "Test Subject",
            "html_content": "<html><body>Test</body></html>",
            "is_default": False
        }
        response = requests.post(f"{BASE_URL}/api/email-templates", 
                               json=template_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        
        assert created["name"] == unique_name
        assert created["subject"] == "Test Subject"
        assert "id" in created
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/email-templates/{created['id']}", headers=auth_headers)
    
    def test_create_template_with_variables(self, auth_headers):
        """Should be able to create template with variable placeholders"""
        unique_name = f"TEST_Vars_{uuid.uuid4().hex[:8]}"
        template_data = {
            "name": unique_name,
            "subject": "Diploma de {{course_name}} para {{recipient_name}}",
            "html_content": "<html><body><h1>Hola {{recipient_name}}</h1><p>Curso: {{course_name}}</p></body></html>",
            "is_default": False
        }
        response = requests.post(f"{BASE_URL}/api/email-templates", 
                               json=template_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        
        assert "{{course_name}}" in created["subject"]
        assert "{{recipient_name}}" in created["html_content"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/email-templates/{created['id']}", headers=auth_headers)
    
    def test_create_sets_default_updates_others(self, auth_headers):
        """Creating a template as default should unset other defaults"""
        unique_name = f"TEST_Default_{uuid.uuid4().hex[:8]}"
        template_data = {
            "name": unique_name,
            "subject": "New Default",
            "html_content": "<html><body>New Default</body></html>",
            "is_default": True
        }
        response = requests.post(f"{BASE_URL}/api/email-templates", 
                               json=template_data, headers=auth_headers)
        assert response.status_code == 200
        created = response.json()
        assert created["is_default"] == True
        
        # Verify only one default exists
        list_response = requests.get(f"{BASE_URL}/api/email-templates", headers=auth_headers)
        templates = list_response.json()
        default_count = sum(1 for t in templates if t["is_default"])
        assert default_count == 1, "Should have exactly one default template"
        
        # Cleanup - need to reset a different one as default first
        other_template = next((t for t in templates if t["id"] != created["id"]), None)
        if other_template:
            requests.put(f"{BASE_URL}/api/email-templates/{other_template['id']}", 
                        json={"is_default": True}, headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/email-templates/{created['id']}", headers=auth_headers)


class TestEmailTemplatesGet:
    """Tests for GET /api/email-templates/{id} endpoint"""
    
    def test_get_template_by_id(self, auth_headers, created_template):
        """GET /api/email-templates/{id} should return the specific template"""
        response = requests.get(f"{BASE_URL}/api/email-templates/{created_template['id']}", 
                              headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_template["id"]
        assert data["name"] == created_template["name"]
    
    def test_get_template_not_found(self, auth_headers):
        """GET /api/email-templates/{id} should return 404 for non-existent template"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/email-templates/{fake_id}", 
                              headers=auth_headers)
        assert response.status_code == 404


class TestEmailTemplatesUpdate:
    """Tests for PUT /api/email-templates/{id} endpoint"""
    
    def test_update_template_name(self, auth_headers, created_template):
        """PUT /api/email-templates/{id} should update template name"""
        new_name = f"TEST_Updated_{uuid.uuid4().hex[:8]}"
        response = requests.put(f"{BASE_URL}/api/email-templates/{created_template['id']}", 
                              json={"name": new_name}, headers=auth_headers)
        assert response.status_code == 200
        updated = response.json()
        assert updated["name"] == new_name
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/email-templates/{created_template['id']}", 
                                   headers=auth_headers)
        assert get_response.json()["name"] == new_name
    
    def test_update_template_subject(self, auth_headers, created_template):
        """PUT /api/email-templates/{id} should update template subject"""
        new_subject = "Updated Subject {{course_name}}"
        response = requests.put(f"{BASE_URL}/api/email-templates/{created_template['id']}", 
                              json={"subject": new_subject}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["subject"] == new_subject
    
    def test_update_template_html_content(self, auth_headers, created_template):
        """PUT /api/email-templates/{id} should update HTML content"""
        new_content = "<html><body><h1>Updated Content {{recipient_name}}</h1></body></html>"
        response = requests.put(f"{BASE_URL}/api/email-templates/{created_template['id']}", 
                              json={"html_content": new_content}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["html_content"] == new_content
    
    def test_update_template_not_found(self, auth_headers):
        """PUT /api/email-templates/{id} should return 404 for non-existent template"""
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{BASE_URL}/api/email-templates/{fake_id}", 
                              json={"name": "Test"}, headers=auth_headers)
        assert response.status_code == 404


class TestEmailTemplatesDelete:
    """Tests for DELETE /api/email-templates/{id} endpoint"""
    
    def test_delete_template_success(self, auth_headers):
        """DELETE /api/email-templates/{id} should delete a non-default template"""
        # First create a template to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/email-templates", 
                                       json={
                                           "name": unique_name,
                                           "subject": "Test",
                                           "html_content": "<html>Test</html>",
                                           "is_default": False
                                       }, headers=auth_headers)
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/email-templates/{template_id}", 
                                         headers=auth_headers)
        assert delete_response.status_code == 200
        
        # Verify it's deleted
        get_response = requests.get(f"{BASE_URL}/api/email-templates/{template_id}", 
                                   headers=auth_headers)
        assert get_response.status_code == 404
    
    def test_delete_only_default_template_fails(self, auth_headers):
        """DELETE should fail when trying to delete the only default template"""
        # Get current templates
        list_response = requests.get(f"{BASE_URL}/api/email-templates", headers=auth_headers)
        templates = list_response.json()
        
        # Delete all non-default templates first
        for t in templates:
            if not t["is_default"]:
                requests.delete(f"{BASE_URL}/api/email-templates/{t['id']}", headers=auth_headers)
        
        # Now get the remaining default template
        list_response = requests.get(f"{BASE_URL}/api/email-templates", headers=auth_headers)
        templates = list_response.json()
        
        if len(templates) == 1 and templates[0]["is_default"]:
            # Try to delete the only default template
            delete_response = requests.delete(f"{BASE_URL}/api/email-templates/{templates[0]['id']}", 
                                             headers=auth_headers)
            assert delete_response.status_code == 400, "Should not be able to delete the only default template"
    
    def test_delete_template_not_found(self, auth_headers):
        """DELETE /api/email-templates/{id} should return 404 for non-existent template"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/email-templates/{fake_id}", 
                                  headers=auth_headers)
        assert response.status_code == 404


class TestEmailTemplatesDuplicate:
    """Tests for POST /api/email-templates/{id}/duplicate endpoint"""
    
    def test_duplicate_template_success(self, auth_headers, created_template):
        """POST /api/email-templates/{id}/duplicate should create a copy"""
        response = requests.post(f"{BASE_URL}/api/email-templates/{created_template['id']}/duplicate", 
                               headers=auth_headers)
        assert response.status_code == 200
        duplicated = response.json()
        
        assert duplicated["id"] != created_template["id"]
        assert "(copia)" in duplicated["name"]
        assert duplicated["subject"] == created_template["subject"]
        assert duplicated["html_content"] == created_template["html_content"]
        assert duplicated["is_default"] == False, "Duplicated template should not be default"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/email-templates/{duplicated['id']}", headers=auth_headers)
    
    def test_duplicate_template_not_found(self, auth_headers):
        """POST /api/email-templates/{id}/duplicate should return 404 for non-existent template"""
        fake_id = str(uuid.uuid4())
        response = requests.post(f"{BASE_URL}/api/email-templates/{fake_id}/duplicate", 
                               headers=auth_headers)
        assert response.status_code == 404


class TestEmailTemplatesPreview:
    """Tests for POST /api/email-templates/preview endpoint"""
    
    def test_preview_replaces_variables(self, auth_headers):
        """POST /api/email-templates/preview should replace variables with sample data"""
        html_content = "<html><body><h1>Hola {{recipient_name}}</h1><p>Curso: {{course_name}}</p><p>Instructor: {{instructor}}</p></body></html>"
        response = requests.post(f"{BASE_URL}/api/email-templates/preview", 
                               json={"html_content": html_content}, headers=auth_headers)
        assert response.status_code == 200
        preview = response.json()
        
        assert "preview_html" in preview
        preview_html = preview["preview_html"]
        
        # Check that variables are replaced
        assert "{{recipient_name}}" not in preview_html
        assert "{{course_name}}" not in preview_html
        assert "{{instructor}}" not in preview_html
        
        # Check that sample data is present
        assert "Juan Pérez" in preview_html
        assert "Curso de Ejemplo" in preview_html
        assert "Dr. María González" in preview_html
    
    def test_preview_all_variables(self, auth_headers):
        """Preview should replace all available template variables"""
        html_content = """
        <html><body>
            <p>Nombre: {{recipient_name}}</p>
            <p>Curso: {{course_name}}</p>
            <p>Instructor: {{instructor}}</p>
            <p>Duración: {{duration_hours}} horas</p>
            <p>Fecha: {{issue_date}}</p>
            <p>ID: {{certificate_id}}</p>
            <p>Org: {{organization_name}}</p>
        </body></html>
        """
        response = requests.post(f"{BASE_URL}/api/email-templates/preview", 
                               json={"html_content": html_content}, headers=auth_headers)
        assert response.status_code == 200
        preview_html = response.json()["preview_html"]
        
        # None of the variables should remain
        variables = ["{{recipient_name}}", "{{course_name}}", "{{instructor}}", 
                    "{{duration_hours}}", "{{issue_date}}", "{{certificate_id}}", 
                    "{{organization_name}}"]
        for var in variables:
            assert var not in preview_html, f"Variable {var} was not replaced"
    
    def test_preview_empty_content(self, auth_headers):
        """Preview should handle empty content"""
        response = requests.post(f"{BASE_URL}/api/email-templates/preview", 
                               json={"html_content": ""}, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["preview_html"] == ""
