import requests
import sys
from datetime import datetime
import json

class ORVITIAPITester:
    def __init__(self, base_url="https://cert-studio-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []
        self.user_id = None
        self.org_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return success, response_data
                except:
                    return success, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                print(f"❌ Failed - {error_msg}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                    self.errors.append(f"{name}: {error_msg} - {error_detail}")
                except:
                    print(f"   Raw response: {response.text[:200]}")
                    self.errors.append(f"{name}: {error_msg} - {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            self.errors.append(f"{name}: Network error - {str(e)}")
            return False, {}

    def test_seed_database(self):
        """Seed database with test data"""
        print("\n🌱 Seeding database...")
        success, response = self.run_test(
            "Seed Database",
            "POST",
            "seed",
            200
        )
        if success:
            print(f"   Seeded with credentials: {response.get('credentials', {})}")
        return success

    def test_login(self, email="admin@sety.com", password="admin123"):
        """Test login and get token"""
        success, response = self.run_test(
            "Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.org_id = response['user']['organization_id']
            print(f"   Token obtained for user: {response['user']['name']}")
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard",
            200
        )
        if success:
            print(f"   Stats: {response.get('total_diplomas', 0)} diplomas, {response.get('total_courses', 0)} courses")
        return success

    def test_courses_crud(self):
        """Test courses CRUD operations"""
        # Get all courses
        success, courses = self.run_test(
            "Get Courses",
            "GET", 
            "courses",
            200
        )
        if not success:
            return False

        print(f"   Found {len(courses)} courses")

        # Create new course
        course_data = {
            "name": "Test Course API",
            "description": "Test course for API testing", 
            "instructor": "API Tester",
            "duration_hours": 10,
            "start_date": "2024-01-01",
            "end_date": "2024-02-01"
        }
        success, new_course = self.run_test(
            "Create Course",
            "POST",
            "courses",
            200,
            data=course_data
        )
        if not success:
            return False

        course_id = new_course.get('id')
        print(f"   Created course with ID: {course_id}")

        # Get specific course
        success, course_detail = self.run_test(
            "Get Course Detail",
            "GET",
            f"courses/{course_id}",
            200
        )
        if not success:
            return False

        # Update course
        updated_data = {**course_data, "name": "Updated Test Course API"}
        success, updated_course = self.run_test(
            "Update Course", 
            "PUT",
            f"courses/{course_id}",
            200,
            data=updated_data
        )
        if not success:
            return False

        # Delete course
        success, _ = self.run_test(
            "Delete Course",
            "DELETE", 
            f"courses/{course_id}",
            200
        )
        return success

    def test_templates_crud(self):
        """Test templates CRUD operations"""
        # Get all templates
        success, templates = self.run_test(
            "Get Templates",
            "GET",
            "templates", 
            200
        )
        if not success:
            return False

        print(f"   Found {len(templates)} templates")

        # Create new template
        template_data = {
            "name": "Test API Template",
            "background_image_url": "https://images.unsplash.com/photo-1557683316-973673bdar25?w=1200",
            "fields_config": [
                {"id": "1", "type": "variable", "variable": "recipient_name", "x": 400, "y": 280, "fontSize": 36}
            ],
            "canvas_width": 1123,
            "canvas_height": 794
        }
        success, new_template = self.run_test(
            "Create Template",
            "POST",
            "templates",
            200,
            data=template_data
        )
        if not success:
            return False

        template_id = new_template.get('id')
        print(f"   Created template with ID: {template_id}")

        # Get specific template
        success, template_detail = self.run_test(
            "Get Template Detail",
            "GET",
            f"templates/{template_id}",
            200
        )
        if not success:
            return False

        # Duplicate template
        success, duplicated_template = self.run_test(
            "Duplicate Template",
            "POST",
            f"templates/{template_id}/duplicate",
            200
        )
        if not success:
            return False

        # Delete both templates
        self.run_test("Delete Template", "DELETE", f"templates/{template_id}", 200)
        self.run_test("Delete Duplicated Template", "DELETE", f"templates/{duplicated_template.get('id')}", 200)
        return True

    def test_recipients_crud(self):
        """Test recipients CRUD operations"""
        # First, get courses to use for recipient creation
        success, courses = self.run_test("Get Courses for Recipients", "GET", "courses", 200)
        if not success or not courses:
            print("   No courses available for recipient testing")
            return False

        course_id = courses[0]['id']
        print(f"   Using course: {courses[0]['name']}")

        # Get all recipients
        success, recipients = self.run_test(
            "Get Recipients",
            "GET",
            "recipients",
            200
        )
        if not success:
            return False

        print(f"   Found {len(recipients)} recipients")

        # Create new recipient
        recipient_data = {
            "full_name": "Test API Recipient",
            "email": "test.api@example.com",
            "course_id": course_id
        }
        success, new_recipient = self.run_test(
            "Create Recipient",
            "POST",
            "recipients",
            200,
            data=recipient_data
        )
        if not success:
            return False

        recipient_id = new_recipient.get('id')
        print(f"   Created recipient with ID: {recipient_id}")

        # Get recipients by course
        success, course_recipients = self.run_test(
            "Get Recipients by Course",
            "GET",
            "recipients",
            200,
            params={"course_id": course_id}
        )
        if not success:
            return False

        # Delete recipient
        success, _ = self.run_test(
            "Delete Recipient",
            "DELETE",
            f"recipients/{recipient_id}",
            200
        )
        return success

    def test_diplomas_workflow(self):
        """Test diploma generation and management"""
        # Get courses and templates for diploma generation
        success_courses, courses = self.run_test("Get Courses for Diplomas", "GET", "courses", 200)
        success_templates, templates = self.run_test("Get Templates for Diplomas", "GET", "templates", 200)
        success_recipients, recipients = self.run_test("Get Recipients for Diplomas", "GET", "recipients", 200)

        if not (success_courses and success_templates and success_recipients):
            print("   Missing required data for diploma testing")
            return False

        if not (courses and templates and recipients):
            print("   No courses, templates, or recipients available")
            return False

        course_id = courses[0]['id']
        template_id = templates[0]['id']
        recipient_ids = [r['id'] for r in recipients[:2]]  # Use first 2 recipients

        print(f"   Using course: {courses[0]['name']}")
        print(f"   Using template: {templates[0]['name']}")
        print(f"   Using {len(recipient_ids)} recipients")

        # Generate diplomas
        diploma_data = {
            "course_id": course_id,
            "template_id": template_id,
            "recipient_ids": recipient_ids
        }
        success, generation_result = self.run_test(
            "Generate Diplomas",
            "POST",
            "diplomas/generate",
            200,
            data=diploma_data
        )
        if not success:
            return False

        print(f"   Generated {generation_result.get('generated', 0)} diplomas")

        # Get all diplomas
        success, diplomas = self.run_test(
            "Get Diplomas",
            "GET",
            "diplomas",
            200
        )
        if not success:
            return False

        print(f"   Found {len(diplomas)} diplomas")

        if diplomas:
            diploma_id = diplomas[0]['id']
            
            # Get specific diploma
            success, diploma_detail = self.run_test(
                "Get Diploma Detail",
                "GET",
                f"diplomas/{diploma_id}",
                200
            )
            if not success:
                return False

            # Test diploma status operations
            success, _ = self.run_test(
                "Revoke Diploma",
                "POST",
                f"diplomas/{diploma_id}/revoke",
                200
            )
            if success:
                success, _ = self.run_test(
                    "Reactivate Diploma", 
                    "POST",
                    f"diplomas/{diploma_id}/reactivate",
                    200
                )

        return success

    def test_public_verification(self):
        """Test public verification endpoint"""
        # Get diplomas to test verification
        success, diplomas = self.run_test("Get Diplomas for Verification", "GET", "diplomas", 200)
        if not success or not diplomas:
            print("   No diplomas available for verification testing")
            return False

        certificate_id = diplomas[0]['certificate_id']
        print(f"   Testing verification for certificate: {certificate_id}")

        # Test verification (no auth needed for public endpoint)
        temp_token = self.token
        self.token = None  # Remove auth for public endpoint
        
        success, verification_data = self.run_test(
            "Public Certificate Verification",
            "GET",
            f"verify/{certificate_id}",
            200
        )
        
        self.token = temp_token  # Restore auth
        
        if success:
            print(f"   Verified certificate for: {verification_data.get('recipient_name')}")
        
        return success

    def test_file_upload(self):
        """Test file upload functionality"""
        # Create a simple test file
        test_content = b"Test file content for API testing"
        files = {'file': ('test.txt', test_content, 'text/plain')}
        
        url = f"{self.base_url}/api/upload"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        print(f"\n🔍 Testing File Upload...")
        print(f"   URL: {url}")
        
        try:
            response = requests.post(url, files=files, headers=headers)
            success = response.status_code == 200
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                result = response.json()
                print(f"   Uploaded file URL: {result.get('url')}")
                return True, result
            else:
                error_msg = f"Expected 200, got {response.status_code}"
                print(f"❌ Failed - {error_msg}")
                self.errors.append(f"File Upload: {error_msg}")
                return False, {}
                
        except Exception as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            self.errors.append(f"File Upload: Network error - {str(e)}")
            return False, {}
        finally:
            self.tests_run += 1

def main():
    """Run all API tests"""
    tester = ORVITIAPITester()
    
    print("🚀 Starting ORVITI Academy API Tests")
    print(f"Base URL: {tester.base_url}")
    
    # Test sequence
    tests_sequence = [
        ("Seed Database", tester.test_seed_database),
        ("Login", lambda: tester.test_login()),
        ("Auth Me", tester.test_auth_me), 
        ("Dashboard Stats", tester.test_dashboard_stats),
        ("Courses CRUD", tester.test_courses_crud),
        ("Templates CRUD", tester.test_templates_crud),
        ("Recipients CRUD", tester.test_recipients_crud),
        ("Diplomas Workflow", tester.test_diplomas_workflow),
        ("Public Verification", tester.test_public_verification),
        ("File Upload", tester.test_file_upload),
    ]
    
    # Run tests
    for test_name, test_func in tests_sequence:
        print(f"\n{'='*50}")
        print(f"Testing: {test_name}")
        print('='*50)
        
        try:
            result = test_func()
            if not result:
                print(f"❌ {test_name} failed - stopping critical path tests")
                if test_name in ["Login", "Dashboard Stats"]:
                    break
        except Exception as e:
            print(f"❌ {test_name} crashed: {str(e)}")
            tester.errors.append(f"{test_name}: Crashed - {str(e)}")
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"TEST SUMMARY")
    print('='*60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.errors:
        print(f"\n❌ ERRORS ({len(tester.errors)}):")
        for error in tester.errors:
            print(f"   • {error}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())