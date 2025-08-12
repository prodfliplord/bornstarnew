from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime
import json

# Environment setup
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Shopify Orders CRM API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.shopify_crm
orders_collection = db.orders

# Pydantic models
class ShopifyWebhook(BaseModel):
    headers: Dict[str, Any]
    body: Dict[str, Any]

class OrderStatus(BaseModel):
    order_id: str
    status: str  # confirmed, cancelled, not_picked, dispatched, delivered, rto
    updated_at: str

class Order(BaseModel):
    id: str
    order_id: str
    order_number: str
    customer_name: str
    phone: str
    email: str
    products: List[Dict[str, Any]]
    total_price: str
    currency: str
    financial_status: str
    fulfillment_status: Optional[str]
    payment_method: Optional[str]
    billing_address: Dict[str, Any]
    shipping_address: Dict[str, Any]
    created_at: str
    # Local status management
    local_status: str = "new"  # new, confirmed, cancelled, not_picked, dispatched, delivered, rto
    status_updated_at: Optional[str] = None
    notes: Optional[str] = None

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Shopify Orders CRM API"}

@app.post("/api/webhook/shopify")
async def shopify_webhook(request: Request):
    """Receive Shopify order webhook and store order data"""
    try:
        # Get the raw JSON data
        webhook_data = await request.json()
        
        # Extract order information from webhook body
        order_data = webhook_data
        
        # Parse customer information
        customer = order_data.get('customer', {})
        customer_name = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
        
        # Parse billing address for phone
        billing_address = order_data.get('billing_address', {})
        phone = billing_address.get('phone') or order_data.get('phone', '')
        
        # Determine payment method
        payment_gateways = order_data.get('payment_gateway_names', [])
        payment_method = "COD" if any("COD" in gateway.upper() or "CASH ON DELIVERY" in gateway.upper() for gateway in payment_gateways) else "Prepaid"
        
        # Parse line items (products) with images
        line_items = order_data.get('line_items', [])
        products = []
        for item in line_items:
            product_data = {
                'id': item.get('id'),
                'title': item.get('title'),
                'variant_title': item.get('variant_title'),
                'quantity': item.get('quantity'),
                'price': item.get('price'),
                'vendor': item.get('vendor'),
                'product_id': item.get('product_id'),
                'variant_id': item.get('variant_id')
            }
            products.append(product_data)
        
        # Enhanced billing address
        enhanced_billing = billing_address.copy()
        enhanced_billing['full_address'] = f"{billing_address.get('address1', '')} {billing_address.get('address2', '')}".strip()
        
        # Enhanced shipping address
        shipping_address = order_data.get('shipping_address', {})
        enhanced_shipping = shipping_address.copy()
        enhanced_shipping['full_address'] = f"{shipping_address.get('address1', '')} {shipping_address.get('address2', '')}".strip()
        
        # Create order document
        order_doc = {
            'id': str(uuid.uuid4()),
            'order_id': str(order_data.get('id')),
            'order_number': order_data.get('name', ''),  # This is like #2314
            'customer_name': customer_name,
            'phone': phone,
            'email': order_data.get('email') or customer.get('email', ''),
            'products': products,
            'total_price': order_data.get('current_total_price', '0'),
            'currency': order_data.get('currency', 'INR'),
            'financial_status': order_data.get('financial_status', ''),
            'fulfillment_status': order_data.get('fulfillment_status'),
            'payment_method': payment_method,
            'billing_address': enhanced_billing,
            'shipping_address': enhanced_shipping,
            'created_at': order_data.get('created_at', datetime.now().isoformat()),
            'local_status': 'new',
            'status_updated_at': None,
            'notes': '',
            'webhook_data': order_data  # Store original webhook data for reference
        }
        
        # Check if order already exists
        existing_order = await orders_collection.find_one({'order_id': order_doc['order_id']})
        if existing_order:
            # Update existing order but preserve local status
            order_doc['local_status'] = existing_order.get('local_status', 'new')
            order_doc['status_updated_at'] = existing_order.get('status_updated_at')
            order_doc['notes'] = existing_order.get('notes', '')
            
            await orders_collection.replace_one(
                {'order_id': order_doc['order_id']}, 
                order_doc
            )
        else:
            # Insert new order
            await orders_collection.insert_one(order_doc)
        
        print(f"✅ Processed order: {order_doc['order_number']} for {customer_name}")
        
        return {"status": "success", "message": "Order processed successfully", "order_id": order_doc['order_id']}
        
    except Exception as e:
        print(f"Error processing webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}")

@app.get("/api/orders")
async def get_orders(status: Optional[str] = None):
    """Get all orders or filter by local status"""
    try:
        query = {}
        if status:
            query['local_status'] = status
        
        # Exclude demo orders
        query['order_number'] = {'$not': {'$regex': '^#DEMO'}}
        
        cursor = orders_collection.find(query).sort('created_at', -1)
        orders = await cursor.to_list(length=100)
        
        # Convert ObjectId to string for JSON serialization
        for order in orders:
            order['_id'] = str(order['_id'])
        
        return {"orders": orders}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching orders: {str(e)}")

@app.put("/api/orders/{order_id}/status")
async def update_order_status(order_id: str, status_data: OrderStatus):
    """Update local order status"""
    try:
        valid_statuses = ['new', 'confirmed', 'cancelled', 'not_picked', 'dispatched', 'delivered', 'rto']
        if status_data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        update_data = {
            'local_status': status_data.status,
            'status_updated_at': datetime.now().isoformat()
        }
        
        result = await orders_collection.update_one(
            {'order_id': order_id},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return {"status": "success", "message": "Order status updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating order status: {str(e)}")

@app.get("/api/orders/stats")
async def get_order_stats():
    """Get order statistics by status (excluding demo orders)"""
    try:
        pipeline = [
            # Exclude demo orders
            {'$match': {'order_number': {'$not': {'$regex': '^#DEMO'}}}},
            {
                '$group': {
                    '_id': '$local_status',
                    'count': {'$sum': 1}
                }
            }
        ]
        
        cursor = orders_collection.aggregate(pipeline)
        stats = await cursor.to_list(length=None)
        
        # Convert to dictionary format
        stats_dict = {stat['_id']: stat['count'] for stat in stats}
        
        return {"stats": stats_dict}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching order stats: {str(e)}")

@app.delete("/api/orders/demo/clear")
async def clear_demo_orders():
    """Clear all demo orders"""
    try:
        result = await orders_collection.delete_many({'order_number': {'$regex': '^#DEMO'}})
        return {"status": "success", "message": f"Cleared {result.deleted_count} demo orders"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing demo orders: {str(e)}")

# Get product images from Shopify (requires additional API call)
@app.get("/api/product/{product_id}/image")
async def get_product_image(product_id: str):
    """Get product image URL - placeholder endpoint"""
    # This would require Shopify Admin API access
    # For now, return a placeholder
    return {"image_url": f"https://via.placeholder.com/150x150?text=Product+{product_id}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)