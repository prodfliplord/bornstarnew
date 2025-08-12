import requests
import sys
import json
from datetime import datetime
import uuid

class ShopifyCRMAPITester:
    def __init__(self, base_url="https://order-manager-22.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.demo_order_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        return self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )

    def test_get_orders(self):
        """Test getting all orders"""
        return self.run_test(
            "Get All Orders",
            "GET",
            "api/orders",
            200
        )

    def test_get_orders_by_status(self, status="new"):
        """Test getting orders filtered by status"""
        return self.run_test(
            f"Get Orders by Status ({status})",
            "GET",
            f"api/orders?status={status}",
            200
        )

    def test_get_order_stats(self):
        """Test getting order statistics"""
        return self.run_test(
            "Get Order Statistics",
            "GET",
            "api/orders/stats",
            200
        )

    def test_create_demo_order(self):
        """Test creating a demo order"""
        success, response = self.run_test(
            "Create Demo Order",
            "POST",
            "api/orders/demo",
            200
        )
        if success and 'order' in response:
            self.demo_order_id = response['order']['order_id']
            print(f"   Demo order ID: {self.demo_order_id}")
        return success, response

    def test_update_order_status(self, order_id, new_status):
        """Test updating order status"""
        data = {
            "order_id": order_id,
            "status": new_status,
            "updated_at": datetime.now().isoformat()
        }
        return self.run_test(
            f"Update Order Status to {new_status}",
            "PUT",
            f"api/orders/{order_id}/status",
            200,
            data=data
        )

    def test_shopify_webhook(self):
        """Test Shopify webhook endpoint with sample data"""
        sample_webhook_data = {
            "id": 12345678901234567890,
            "name": "#TEST1001",
            "email": "test@example.com",
            "phone": "+91 98765 43210",
            "created_at": datetime.now().isoformat(),
            "current_total_price": "1999.00",
            "currency": "INR",
            "financial_status": "pending",
            "fulfillment_status": None,
            "customer": {
                "first_name": "Test",
                "last_name": "Customer",
                "email": "test@example.com"
            },
            "billing_address": {
                "first_name": "Test",
                "last_name": "Customer",
                "phone": "+91 98765 43210",
                "city": "Mumbai",
                "province": "Maharashtra",
                "country": "India"
            },
            "shipping_address": {
                "first_name": "Test",
                "last_name": "Customer",
                "phone": "+91 98765 43210",
                "city": "Mumbai",
                "province": "Maharashtra",
                "country": "India"
            },
            "line_items": [
                {
                    "id": 987654321,
                    "title": "Test Product",
                    "variant_title": "M",
                    "quantity": 1,
                    "price": "1999.00",
                    "vendor": "Test Store"
                }
            ]
        }
        
        return self.run_test(
            "Shopify Webhook",
            "POST",
            "api/webhook/shopify",
            200,
            data=sample_webhook_data
        )

    def test_invalid_status_update(self, order_id):
        """Test updating order with invalid status"""
        data = {
            "order_id": order_id,
            "status": "invalid_status",
            "updated_at": datetime.now().isoformat()
        }
        return self.run_test(
            "Update Order with Invalid Status",
            "PUT",
            f"api/orders/{order_id}/status",
            400,
            data=data
        )

    def test_update_nonexistent_order(self):
        """Test updating a non-existent order"""
        fake_order_id = f"fake_{int(datetime.now().timestamp())}"
        data = {
            "order_id": fake_order_id,
            "status": "confirmed",
            "updated_at": datetime.now().isoformat()
        }
        return self.run_test(
            "Update Non-existent Order",
            "PUT",
            f"api/orders/{fake_order_id}/status",
            404,
            data=data
        )

def main():
    print("🚀 Starting Shopify Orders CRM API Tests")
    print("=" * 50)
    
    tester = ShopifyCRMAPITester()
    
    # Test 1: Health Check
    tester.test_health_check()
    
    # Test 2: Get all orders
    tester.test_get_orders()
    
    # Test 3: Get order statistics
    tester.test_get_order_stats()
    
    # Test 4: Create demo order
    success, _ = tester.test_create_demo_order()
    
    # Test 5: Get orders by status
    tester.test_get_orders_by_status("new")
    tester.test_get_orders_by_status("confirmed")
    
    # Test 6: Update order status (if demo order was created)
    if success and tester.demo_order_id:
        # Test valid status updates
        tester.test_update_order_status(tester.demo_order_id, "confirmed")
        tester.test_update_order_status(tester.demo_order_id, "dispatched")
        tester.test_update_order_status(tester.demo_order_id, "delivered")
        
        # Test invalid status update
        tester.test_invalid_status_update(tester.demo_order_id)
    
    # Test 7: Update non-existent order
    tester.test_update_nonexistent_order()
    
    # Test 8: Shopify webhook
    tester.test_shopify_webhook()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())