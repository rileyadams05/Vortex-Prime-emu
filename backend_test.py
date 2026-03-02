#!/usr/bin/env python3

import requests
import sys
from datetime import datetime

class XeniaAPITester:
    def __init__(self, base_url="https://9bbe7817-6fbd-42e3-be8c-472eeeb17346.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, check_headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            # Check status code
            status_success = response.status_code == expected_status
            
            # Check specific headers if requested
            header_success = True
            if check_headers:
                for header_name, expected_value in check_headers.items():
                    actual_value = response.headers.get(header_name)
                    if actual_value != expected_value:
                        print(f"❌ Header check failed - {header_name}: expected '{expected_value}', got '{actual_value}'")
                        header_success = False

            success = status_success and header_success
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if check_headers:
                    print(f"   Headers: {check_headers}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if check_headers and not header_success:
                    print(f"   Header check failed")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_gamepad_permissions_policy(self):
        """Test that backend sends Permissions-Policy gamepad header"""
        success, _ = self.run_test(
            "Gamepad Permissions Policy",
            "GET", 
            "",
            200,
            check_headers={"Permissions-Policy": "gamepad=(*)"}
        )
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_status_endpoints(self):
        """Test status check endpoints"""
        # Test POST status
        success1, response = self.run_test(
            "Create Status Check",
            "POST",
            "status",
            200,
            data={"client_name": f"test_client_{datetime.now().strftime('%H%M%S')}"}
        )
        
        # Test GET status 
        success2, _ = self.run_test(
            "Get Status Checks",
            "GET",
            "status",
            200
        )
        
        return success1 and success2

    def test_xbox_endpoints(self):
        """Test Xbox Live API endpoints"""
        success1, _ = self.run_test(
            "Xbox Profile",
            "GET",
            "xbox/profile",
            200
        )
        
        success2, _ = self.run_test(
            "Xbox Auth URL",
            "GET", 
            "xbox/auth/url",
            200
        )
        
        return success1 and success2

    def test_startup_videos_endpoint(self):
        """Test startup videos endpoint"""
        success, _ = self.run_test(
            "Startup Videos",
            "GET",
            "startup/videos",
            200
        )
        return success

    def test_wallpapers_endpoint(self):
        """Test wallpapers endpoint"""
        success, _ = self.run_test(
            "Wallpapers",
            "GET",
            "wallpapers",
            200
        )
        return success

def main():
    print("🎮 Testing Xenia Dashboard Backend APIs...")
    print("=" * 50)
    
    tester = XeniaAPITester()
    
    # Run tests
    tests = [
        tester.test_gamepad_permissions_policy,
        tester.test_root_endpoint,
        tester.test_status_endpoints,
        tester.test_xbox_endpoints,
        tester.test_startup_videos_endpoint,
        tester.test_wallpapers_endpoint,
    ]
    
    for test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            tester.tests_run += 1

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Backend API Tests: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("⚠️  Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())