"""
Al-Ghazaly Auto Parts API - Advanced Owner Interface Backend
FastAPI + MongoDB + WebSockets
"""
from fastapi import FastAPI, APIRouter, HTTPException, Response, Request, Query, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import json
import time

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="Al-Ghazaly Auto Parts API", version="3.0.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
client: AsyncIOMotorClient = None
db = None

# Primary Owner Email
PRIMARY_OWNER_EMAIL = "pc.2025.ai@gmail.com"

# WebSocket Manager with notification support
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.anonymous_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket, user_id: str = None):
        await websocket.accept()
        if user_id:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
        else:
            self.anonymous_connections.add(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str = None):
        if user_id and user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
        else:
            self.anonymous_connections.discard(websocket)
    
    async def broadcast(self, message: dict):
        for connections in self.active_connections.values():
            for conn in connections:
                try:
                    await conn.send_json(message)
                except:
                    pass
        for conn in self.anonymous_connections:
            try:
                await conn.send_json(message)
            except:
                pass
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for conn in self.active_connections[user_id]:
                try:
                    await conn.send_json(message)
                except:
                    pass
    
    async def send_notification(self, user_id: str, notification: dict):
        """Send real-time notification to specific user"""
        await self.send_to_user(user_id, {"type": "notification", "data": notification})

manager = ConnectionManager()

# ==================== Pydantic Schemas ====================

class CarBrandCreate(BaseModel):
    name: str
    name_ar: str
    logo: Optional[str] = None
    distributor_id: Optional[str] = None

class CarModelCreate(BaseModel):
    brand_id: str
    name: str
    name_ar: str
    year_start: Optional[int] = None
    year_end: Optional[int] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    variants: List[dict] = []

class ProductBrandCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    logo: Optional[str] = None
    country_of_origin: Optional[str] = None
    country_of_origin_ar: Optional[str] = None
    supplier_id: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    name_ar: str
    parent_id: Optional[str] = None
    icon: Optional[str] = None

class ProductCreate(BaseModel):
    name: str
    name_ar: str
    description: Optional[str] = None
    description_ar: Optional[str] = None
    price: float
    sku: str
    product_brand_id: Optional[str] = None
    category_id: Optional[str] = None
    image_url: Optional[str] = None
    images: List[str] = []
    car_model_ids: List[str] = []
    stock_quantity: int = 0
    hidden_status: bool = False
    added_by_admin_id: Optional[str] = None

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = 1

class OrderCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    street_address: str
    city: str
    state: str
    country: str = "Egypt"
    delivery_instructions: Optional[str] = None
    payment_method: str = "cash_on_delivery"
    notes: Optional[str] = None

class CommentCreate(BaseModel):
    text: str
    rating: Optional[int] = None

class FavoriteAdd(BaseModel):
    product_id: str

class PartnerCreate(BaseModel):
    email: str

class AdminCreate(BaseModel):
    email: str
    name: Optional[str] = None

class SupplierCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    profile_image: Optional[str] = None
    phone_numbers: List[str] = []
    address: Optional[str] = None
    address_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    slider_images: List[str] = []
    website_url: Optional[str] = None
    linked_product_brand_ids: List[str] = []

class DistributorCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    profile_image: Optional[str] = None
    phone_numbers: List[str] = []
    address: Optional[str] = None
    address_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    slider_images: List[str] = []
    website_url: Optional[str] = None
    linked_car_brand_ids: List[str] = []

class SubscriberCreate(BaseModel):
    email: str

class SubscriptionRequestCreate(BaseModel):
    customer_name: str
    phone: str
    governorate: str
    village: str
    address: str
    car_model: str
    description: Optional[str] = None

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str = "info"  # info, success, warning, error

class SettleRevenueRequest(BaseModel):
    admin_id: str
    product_ids: List[str]
    total_amount: float

class SyncPullRequest(BaseModel):
    last_pulled_at: Optional[int] = None
    tables: List[str] = []

# ==================== Marketing System Schemas ====================

class PromotionCreate(BaseModel):
    title: str
    title_ar: Optional[str] = None
    image: Optional[str] = None
    promotion_type: str = "slider"  # slider or banner
    is_active: bool = True
    target_product_id: Optional[str] = None
    target_car_model_id: Optional[str] = None
    sort_order: int = 0

class BundleOfferCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    discount_percentage: float
    target_car_model_id: Optional[str] = None
    product_ids: List[str] = []
    image: Optional[str] = None
    is_active: bool = True

# ==================== Helpers ====================

def get_timestamp_ms() -> int:
    return int(time.time() * 1000)

def serialize_doc(doc):
    if doc is None:
        return None
    doc = dict(doc)
    if '_id' in doc:
        doc['id'] = str(doc['_id'])
        del doc['_id']
    return doc

async def get_session_token(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if token:
        return token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None

async def get_current_user(request: Request):
    token = await get_session_token(request)
    if not token:
        return None
    session = await db.sessions.find_one({"session_token": token})
    if not session:
        return None
    if session.get("expires_at") and session["expires_at"] <= datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"_id": session["user_id"]})
    return serialize_doc(user) if user else None

async def get_user_role(user):
    """Determine user role: owner, partner, admin, subscriber, or user"""
    if not user:
        return "guest"
    
    email = user.get("email", "")
    
    # Check if primary owner
    if email == PRIMARY_OWNER_EMAIL:
        return "owner"
    
    # Check if partner
    partner = await db.partners.find_one({"email": email, "deleted_at": None})
    if partner:
        return "partner"
    
    # Check if admin
    admin = await db.admins.find_one({"email": email, "deleted_at": None})
    if admin:
        return "admin"
    
    # Check if subscriber
    subscriber = await db.subscribers.find_one({"email": email, "deleted_at": None})
    if subscriber:
        return "subscriber"
    
    return "user"

async def create_notification(user_id: str, title: str, message: str, notif_type: str = "info"):
    """Create and broadcast a notification"""
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.notifications.insert_one(notification)
    await manager.send_notification(user_id, serialize_doc(notification))
    return notification

# ==================== Auth Routes ====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client_http:
        try:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth API error: {e}")
            raise HTTPException(status_code=500, detail="Authentication service error")
    
    user = await db.users.find_one({"email": user_data["email"]})
    if not user:
        user = {
            "_id": str(uuid.uuid4()),
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "is_admin": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(user)
    
    session = {
        "_id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "session_token": user_data["session_token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    }
    await db.sessions.insert_one(session)
    
    # Get user role
    user_serialized = serialize_doc(user)
    role = await get_user_role(user_serialized)
    user_serialized["role"] = role
    
    response.set_cookie(key="session_token", value=session["session_token"], httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    return {"user": user_serialized, "session_token": session["session_token"]}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user["role"] = await get_user_role(user)
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = await get_session_token(request)
    if token:
        await db.sessions.delete_one({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== Partner Routes ====================

@api_router.get("/partners")
async def get_partners(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    partners = await db.partners.find({"deleted_at": None}).to_list(1000)
    # Include primary owner in list
    owner_info = {"id": "owner", "email": PRIMARY_OWNER_EMAIL, "name": "Primary Owner", "is_owner": True}
    return [owner_info] + [serialize_doc(p) for p in partners]

@api_router.post("/partners")
async def add_partner(data: PartnerCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can add partners")
    
    existing = await db.partners.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Partner already exists")
    
    partner = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.email.split("@")[0],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.partners.insert_one(partner)
    await manager.broadcast({"type": "sync", "tables": ["partners"]})
    return serialize_doc(partner)

@api_router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete partners")
    
    await db.partners.update_one({"_id": partner_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["partners"]})
    return {"message": "Deleted"}

# ==================== Admin Routes ====================

@api_router.get("/admins")
async def get_admins(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    admins = await db.admins.find({"deleted_at": None}).to_list(1000)
    result = []
    for admin in admins:
        admin_data = serialize_doc(admin)
        # Calculate stats for this admin
        products = await db.products.find({"added_by_admin_id": admin["_id"], "deleted_at": None}).to_list(10000)
        admin_data["products_added"] = len(products)
        
        product_ids = [p["_id"] for p in products]
        orders = await db.orders.find({"items.product_id": {"$in": product_ids}}).to_list(10000)
        delivered = sum(1 for o in orders if o.get("status") == "delivered")
        processing = sum(1 for o in orders if o.get("status") in ["pending", "preparing", "shipped", "out_for_delivery"])
        
        admin_data["products_delivered"] = delivered
        admin_data["products_processing"] = processing
        admin_data["revenue"] = admin.get("revenue", 0)
        result.append(admin_data)
    return result

@api_router.post("/admins")
async def add_admin(data: AdminCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.admins.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Admin already exists")
    
    admin = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.name or data.email.split("@")[0],
        "revenue": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.admins.insert_one(admin)
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return serialize_doc(admin)

@api_router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.admins.update_one({"_id": admin_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return {"message": "Deleted"}

@api_router.get("/admins/{admin_id}/products")
async def get_admin_products(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    products = await db.products.find({"added_by_admin_id": admin_id, "deleted_at": None}).to_list(10000)
    return [serialize_doc(p) for p in products]

@api_router.post("/admins/{admin_id}/settle")
async def settle_admin_revenue(admin_id: str, data: SettleRevenueRequest, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Mark products as settled
    await db.products.update_many(
        {"_id": {"$in": data.product_ids}},
        {"$set": {"settled": True, "settled_at": datetime.now(timezone.utc)}}
    )
    
    # Add to settled collection
    settlement = {
        "_id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "product_ids": data.product_ids,
        "amount": data.total_amount,
        "settled_by": user["id"] if user else None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.settlements.insert_one(settlement)
    
    # Update admin revenue
    await db.admins.update_one({"_id": admin_id}, {"$inc": {"revenue": data.total_amount}})
    
    # Create notification
    admin = await db.admins.find_one({"_id": admin_id})
    if admin:
        await create_notification(
            user["id"] if user else "system",
            "Revenue Settled",
            f"Admin {admin.get('name', admin.get('email'))} settled revenue of {data.total_amount} EGP",
            "success"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["admins", "products", "settlements"]})
    return {"message": "Settled", "amount": data.total_amount}

@api_router.post("/admins/{admin_id}/clear-revenue")
async def clear_admin_revenue(admin_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.admins.update_one({"_id": admin_id}, {"$set": {"revenue": 0}})
    await manager.broadcast({"type": "sync", "tables": ["admins"]})
    return {"message": "Revenue cleared"}

# ==================== Supplier Routes ====================

@api_router.get("/suppliers")
async def get_suppliers(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    # Subscribers and above can view suppliers
    if role not in ["owner", "partner", "admin", "subscriber"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    suppliers = await db.suppliers.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(s) for s in suppliers]

@api_router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, request: Request):
    supplier = await db.suppliers.find_one({"_id": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return serialize_doc(supplier)

@api_router.post("/suppliers")
async def create_supplier(data: SupplierCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    supplier = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.suppliers.insert_one(supplier)
    
    # Update linked product brands
    if data.linked_product_brand_ids:
        await db.product_brands.update_many(
            {"_id": {"$in": data.linked_product_brand_ids}},
            {"$set": {"supplier_id": supplier["_id"]}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return serialize_doc(supplier)

@api_router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, data: SupplierCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Clear old brand links
    await db.product_brands.update_many({"supplier_id": supplier_id}, {"$set": {"supplier_id": None}})
    
    # Update supplier
    await db.suppliers.update_one(
        {"_id": supplier_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Set new brand links
    if data.linked_product_brand_ids:
        await db.product_brands.update_many(
            {"_id": {"$in": data.linked_product_brand_ids}},
            {"$set": {"supplier_id": supplier_id}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return {"message": "Updated"}

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Clear brand links
    await db.product_brands.update_many({"supplier_id": supplier_id}, {"$set": {"supplier_id": None}})
    
    await db.suppliers.update_one({"_id": supplier_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["suppliers", "product_brands"]})
    return {"message": "Deleted"}

# ==================== Distributor Routes ====================

@api_router.get("/distributors")
async def get_distributors(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin", "subscriber"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    distributors = await db.distributors.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(d) for d in distributors]

@api_router.get("/distributors/{distributor_id}")
async def get_distributor(distributor_id: str, request: Request):
    distributor = await db.distributors.find_one({"_id": distributor_id})
    if not distributor:
        raise HTTPException(status_code=404, detail="Distributor not found")
    return serialize_doc(distributor)

@api_router.post("/distributors")
async def create_distributor(data: DistributorCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    distributor = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.distributors.insert_one(distributor)
    
    # Update linked car brands
    if data.linked_car_brand_ids:
        await db.car_brands.update_many(
            {"_id": {"$in": data.linked_car_brand_ids}},
            {"$set": {"distributor_id": distributor["_id"]}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return serialize_doc(distributor)

@api_router.put("/distributors/{distributor_id}")
async def update_distributor(distributor_id: str, data: DistributorCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.car_brands.update_many({"distributor_id": distributor_id}, {"$set": {"distributor_id": None}})
    
    await db.distributors.update_one(
        {"_id": distributor_id},
        {"$set": {**data.dict(), "updated_at": datetime.now(timezone.utc)}}
    )
    
    if data.linked_car_brand_ids:
        await db.car_brands.update_many(
            {"_id": {"$in": data.linked_car_brand_ids}},
            {"$set": {"distributor_id": distributor_id}}
        )
    
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return {"message": "Updated"}

@api_router.delete("/distributors/{distributor_id}")
async def delete_distributor(distributor_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.car_brands.update_many({"distributor_id": distributor_id}, {"$set": {"distributor_id": None}})
    await db.distributors.update_one({"_id": distributor_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["distributors", "car_brands"]})
    return {"message": "Deleted"}

# ==================== Subscriber Routes ====================

@api_router.get("/subscribers")
async def get_subscribers(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    subscribers = await db.subscribers.find({"deleted_at": None}).to_list(1000)
    return [serialize_doc(s) for s in subscribers]

@api_router.post("/subscribers")
async def add_subscriber(data: SubscriberCreate, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    existing = await db.subscribers.find_one({"email": data.email, "deleted_at": None})
    if existing:
        raise HTTPException(status_code=400, detail="Subscriber already exists")
    
    subscriber = {
        "_id": str(uuid.uuid4()),
        "email": data.email,
        "name": data.email.split("@")[0],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.subscribers.insert_one(subscriber)
    await manager.broadcast({"type": "sync", "tables": ["subscribers"]})
    return serialize_doc(subscriber)

@api_router.delete("/subscribers/{subscriber_id}")
async def delete_subscriber(subscriber_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscribers.update_one({"_id": subscriber_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["subscribers"]})
    return {"message": "Deleted"}

# ==================== Subscription Request Routes ====================

@api_router.get("/subscription-requests")
async def get_subscription_requests(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    requests = await db.subscription_requests.find({"deleted_at": None}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(r) for r in requests]

@api_router.post("/subscription-requests")
async def create_subscription_request(data: SubscriptionRequestCreate):
    """Public endpoint for users to submit subscription requests"""
    request_doc = {
        "_id": str(uuid.uuid4()),
        **data.dict(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None,
    }
    await db.subscription_requests.insert_one(request_doc)
    
    # Send notification to owner
    owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
    if owner:
        await create_notification(
            str(owner["_id"]),
            "New Subscription Request",
            f"New subscription request from {data.customer_name}",
            "info"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["subscription_requests"]})
    return serialize_doc(request_doc)

@api_router.patch("/subscription-requests/{request_id}/approve")
async def approve_subscription_request(request_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscription_requests.update_one(
        {"_id": request_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Approved"}

@api_router.delete("/subscription-requests/{request_id}")
async def delete_subscription_request(request_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.subscription_requests.update_one({"_id": request_id}, {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    return {"message": "Deleted"}

# ==================== Notification Routes ====================

@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    notifications = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50).to_list(50)
    return [serialize_doc(n) for n in notifications]

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.notifications.update_one(
        {"_id": notification_id, "user_id": user["id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All marked as read"}

# ==================== Analytics Routes ====================

@api_router.get("/analytics/overview")
async def get_analytics_overview(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build date filter
    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
    if end_date:
        date_filter["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    
    order_query = {}
    if date_filter:
        order_query["created_at"] = date_filter
    
    # Get orders
    orders = await db.orders.find(order_query).to_list(100000)
    
    # Calculate metrics
    total_orders = len(orders)
    total_revenue = sum(o.get("total", 0) for o in orders)
    delivered_orders = [o for o in orders if o.get("status") == "delivered"]
    delivered_revenue = sum(o.get("total", 0) for o in delivered_orders)
    aov = total_revenue / total_orders if total_orders > 0 else 0
    
    # Orders by status
    status_counts = {}
    for status in ["pending", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled"]:
        status_counts[status] = sum(1 for o in orders if o.get("status") == status)
    
    # Top products
    product_sales = {}
    for order in orders:
        for item in order.get("items", []):
            pid = item.get("product_id")
            if pid:
                if pid not in product_sales:
                    product_sales[pid] = {"count": 0, "revenue": 0, "name": item.get("product_name", "Unknown")}
                product_sales[pid]["count"] += item.get("quantity", 1)
                product_sales[pid]["revenue"] += item.get("price", 0) * item.get("quantity", 1)
    
    top_products = sorted(product_sales.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    # Revenue over time (last 30 days)
    revenue_by_day = {}
    for order in orders:
        day = order.get("created_at").strftime("%Y-%m-%d") if order.get("created_at") else "Unknown"
        revenue_by_day[day] = revenue_by_day.get(day, 0) + order.get("total", 0)
    
    # Sales by admin
    admin_sales = {}
    products = await db.products.find({}).to_list(100000)
    product_admin_map = {p["_id"]: p.get("added_by_admin_id") for p in products}
    
    for order in orders:
        for item in order.get("items", []):
            admin_id = product_admin_map.get(item.get("product_id"))
            if admin_id:
                if admin_id not in admin_sales:
                    admin_sales[admin_id] = {"count": 0, "revenue": 0}
                admin_sales[admin_id]["count"] += item.get("quantity", 1)
                admin_sales[admin_id]["revenue"] += item.get("price", 0) * item.get("quantity", 1)
    
    # Get admin names
    admins = await db.admins.find({}).to_list(1000)
    admin_name_map = {a["_id"]: a.get("name", a.get("email", "Unknown")) for a in admins}
    
    sales_by_admin = [
        {"admin_id": aid, "name": admin_name_map.get(aid, "Unknown"), **data}
        for aid, data in admin_sales.items()
    ]
    
    # Recent customers
    recent_customers = await db.users.find({}).sort("created_at", -1).limit(5).to_list(5)
    
    # Low stock products
    low_stock = await db.products.find({"stock_quantity": {"$lt": 10}, "deleted_at": None}).limit(10).to_list(10)
    
    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "delivered_revenue": delivered_revenue,
        "average_order_value": round(aov, 2),
        "orders_by_status": status_counts,
        "top_products": top_products,
        "revenue_by_day": [{"date": k, "revenue": v} for k, v in sorted(revenue_by_day.items())],
        "sales_by_admin": sales_by_admin,
        "recent_customers": [serialize_doc(c) for c in recent_customers],
        "low_stock_products": [serialize_doc(p) for p in low_stock],
    }

# ==================== Collection Routes ====================

@api_router.get("/collections")
async def get_collections(request: Request, admin_id: Optional[str] = None):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {"settled": True}
    if admin_id:
        query["added_by_admin_id"] = admin_id
    
    products = await db.products.find(query).to_list(10000)
    
    # Add admin info to each product
    admins = await db.admins.find({}).to_list(1000)
    admin_map = {a["_id"]: serialize_doc(a) for a in admins}
    
    result = []
    for p in products:
        p_data = serialize_doc(p)
        p_data["admin"] = admin_map.get(p.get("added_by_admin_id"))
        result.append(p_data)
    
    return result

# ==================== Car Brand Routes ====================

@api_router.get("/car-brands")
async def get_car_brands():
    brands = await db.car_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    result = []
    for b in brands:
        b_data = serialize_doc(b)
        # Include distributor info if linked
        if b.get("distributor_id"):
            distributor = await db.distributors.find_one({"_id": b["distributor_id"]})
            b_data["distributor"] = serialize_doc(distributor) if distributor else None
        result.append(b_data)
    return result

@api_router.post("/car-brands")
async def create_car_brand(brand: CarBrandCreate):
    doc = {"_id": f"cb_{uuid.uuid4().hex[:8]}", **brand.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.car_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return serialize_doc(doc)

@api_router.delete("/car-brands/{brand_id}")
async def delete_car_brand(brand_id: str):
    await db.car_brands.update_one({"_id": brand_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_brands"]})
    return {"message": "Deleted"}

# ==================== Car Model Routes ====================

@api_router.get("/car-models")
async def get_car_models(brand_id: Optional[str] = None):
    query = {"deleted_at": None}
    if brand_id:
        query["brand_id"] = brand_id
    models = await db.car_models.find(query).sort("name", 1).to_list(1000)
    return [serialize_doc(m) for m in models]

@api_router.get("/car-models/{model_id}")
async def get_car_model(model_id: str):
    model = await db.car_models.find_one({"_id": model_id})
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    model_data = serialize_doc(model)
    brand = await db.car_brands.find_one({"_id": model["brand_id"]})
    model_data["brand"] = serialize_doc(brand)
    products = await db.products.find({"car_model_ids": model_id, "deleted_at": None}).to_list(100)
    model_data["compatible_products"] = [serialize_doc(p) for p in products]
    model_data["compatible_products_count"] = len(products)
    return model_data

@api_router.post("/car-models")
async def create_car_model(model: CarModelCreate):
    doc = {"_id": f"cm_{uuid.uuid4().hex[:8]}", **model.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.car_models.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return serialize_doc(doc)

@api_router.put("/car-models/{model_id}")
async def update_car_model(model_id: str, model: CarModelCreate):
    await db.car_models.update_one({"_id": model_id}, {"$set": {**model.dict(), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Updated"}

@api_router.delete("/car-models/{model_id}")
async def delete_car_model(model_id: str):
    await db.car_models.update_one({"_id": model_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["car_models"]})
    return {"message": "Deleted"}

# ==================== Product Brand Routes ====================

@api_router.get("/product-brands")
async def get_product_brands():
    brands = await db.product_brands.find({"deleted_at": None}).sort("name", 1).to_list(1000)
    result = []
    for b in brands:
        b_data = serialize_doc(b)
        if b.get("supplier_id"):
            supplier = await db.suppliers.find_one({"_id": b["supplier_id"]})
            b_data["supplier"] = serialize_doc(supplier) if supplier else None
        result.append(b_data)
    return result

@api_router.post("/product-brands")
async def create_product_brand(brand: ProductBrandCreate):
    doc = {"_id": f"pb_{uuid.uuid4().hex[:8]}", **brand.dict(), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.product_brands.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return serialize_doc(doc)

@api_router.delete("/product-brands/{brand_id}")
async def delete_product_brand(brand_id: str):
    await db.product_brands.update_one({"_id": brand_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["product_brands"]})
    return {"message": "Deleted"}

# ==================== Category Routes ====================

@api_router.get("/categories")
async def get_categories(parent_id: Optional[str] = None):
    query = {"deleted_at": None}
    if parent_id is None:
        query["parent_id"] = None
    else:
        query["parent_id"] = parent_id
    categories = await db.categories.find(query).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    return [serialize_doc(c) for c in categories]

@api_router.get("/categories/all")
async def get_all_categories():
    categories = await db.categories.find({"deleted_at": None}).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    return [serialize_doc(c) for c in categories]

@api_router.get("/categories/tree")
async def get_categories_tree():
    categories = await db.categories.find({"deleted_at": None}).sort([("sort_order", 1), ("name", 1)]).to_list(1000)
    all_cats = [serialize_doc(c) for c in categories]
    cats_by_id = {c["id"]: {**c, "children": []} for c in all_cats}
    root = []
    for c in all_cats:
        if c.get("parent_id") and c["parent_id"] in cats_by_id:
            cats_by_id[c["parent_id"]]["children"].append(cats_by_id[c["id"]])
        elif not c.get("parent_id"):
            root.append(cats_by_id[c["id"]])
    return root

@api_router.post("/categories")
async def create_category(category: CategoryCreate):
    doc = {"_id": f"cat_{uuid.uuid4().hex[:8]}", **category.dict(), "sort_order": 0, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.categories.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["categories"]})
    return serialize_doc(doc)

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str):
    await db.categories.update_one({"_id": cat_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["categories"]})
    return {"message": "Deleted"}

# ==================== Product Routes ====================

@api_router.get("/products")
async def get_products(category_id: Optional[str] = None, product_brand_id: Optional[str] = None, car_model_id: Optional[str] = None, car_brand_id: Optional[str] = None, min_price: Optional[float] = None, max_price: Optional[float] = None, skip: int = 0, limit: int = 50, include_hidden: bool = False):
    query = {"deleted_at": None}
    if not include_hidden:
        query["$or"] = [{"hidden_status": False}, {"hidden_status": None}]
    if category_id:
        subcats = await db.categories.find({"parent_id": category_id}).to_list(100)
        cat_ids = [category_id] + [str(c["_id"]) for c in subcats]
        query["category_id"] = {"$in": cat_ids}
    if product_brand_id:
        query["product_brand_id"] = product_brand_id
    if car_model_id:
        query["car_model_ids"] = car_model_id
    if car_brand_id:
        models = await db.car_models.find({"brand_id": car_brand_id}).to_list(100)
        model_ids = [str(m["_id"]) for m in models]
        if model_ids:
            query["car_model_ids"] = {"$in": model_ids}
    if min_price is not None:
        query["price"] = {"$gte": min_price}
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
    
    total = await db.products.count_documents(query)
    products = await db.products.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"products": [serialize_doc(p) for p in products], "total": total}

@api_router.get("/products/search")
async def search_products(q: str = Query(..., min_length=1), limit: int = 20):
    regex = {"$regex": q, "$options": "i"}
    products = await db.products.find({"$and": [{"deleted_at": None}, {"$or": [{"name": regex}, {"name_ar": regex}, {"sku": regex}]}]}).limit(limit).to_list(limit)
    car_brands = await db.car_brands.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    car_models = await db.car_models.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    product_brands = await db.product_brands.find({"deleted_at": None, "name": regex}).limit(5).to_list(5)
    categories = await db.categories.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    suppliers = await db.suppliers.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    distributors = await db.distributors.find({"deleted_at": None, "$or": [{"name": regex}, {"name_ar": regex}]}).limit(5).to_list(5)
    return {
        "products": [serialize_doc(p) for p in products],
        "car_brands": [serialize_doc(b) for b in car_brands],
        "car_models": [serialize_doc(m) for m in car_models],
        "product_brands": [serialize_doc(b) for b in product_brands],
        "categories": [serialize_doc(c) for c in categories],
        "suppliers": [serialize_doc(s) for s in suppliers],
        "distributors": [serialize_doc(d) for d in distributors],
    }

@api_router.get("/products/all")
async def get_all_products():
    products = await db.products.find({"deleted_at": None}).sort("created_at", -1).to_list(10000)
    return {"products": [serialize_doc(p) for p in products], "total": len(products)}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    p = serialize_doc(product)
    if p.get("product_brand_id"):
        brand = await db.product_brands.find_one({"_id": p["product_brand_id"]})
        p["product_brand"] = serialize_doc(brand)
    if p.get("category_id"):
        cat = await db.categories.find_one({"_id": p["category_id"]})
        p["category"] = serialize_doc(cat)
    if p.get("car_model_ids"):
        models = await db.car_models.find({"_id": {"$in": p["car_model_ids"]}}).to_list(100)
        p["car_models"] = [serialize_doc(m) for m in models]
    return p

@api_router.post("/products")
async def create_product(product: ProductCreate, request: Request):
    user = await get_current_user(request)
    admin_id = None
    if user:
        admin = await db.admins.find_one({"email": user.get("email"), "deleted_at": None})
        if admin:
            admin_id = admin["_id"]
    
    doc = {
        "_id": f"prod_{uuid.uuid4().hex[:8]}",
        **product.dict(),
        "added_by_admin_id": admin_id or product.added_by_admin_id,
        "settled": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "deleted_at": None
    }
    await db.products.insert_one(doc)
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return serialize_doc(doc)

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate):
    await db.products.update_one({"_id": product_id}, {"$set": {**product.dict(), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@api_router.patch("/products/{product_id}/price")
async def update_product_price(product_id: str, data: dict):
    await db.products.update_one({"_id": product_id}, {"$set": {"price": data.get("price"), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Price updated"}

@api_router.patch("/products/{product_id}/hidden")
async def update_product_hidden(product_id: str, data: dict):
    await db.products.update_one({"_id": product_id}, {"$set": {"hidden_status": data.get("hidden_status"), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Updated"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    await db.products.update_one({"_id": product_id}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await manager.broadcast({"type": "sync", "tables": ["products"]})
    return {"message": "Deleted"}

# ==================== Cart Routes ====================

@api_router.get("/cart")
async def get_cart(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        return {"user_id": user["id"], "items": []}
    items = []
    for item in cart.get("items", []):
        product = await db.products.find_one({"_id": item["product_id"]})
        if product:
            items.append({"product_id": item["product_id"], "quantity": item["quantity"], "product": serialize_doc(product)})
    return {"user_id": user["id"], "items": items}

@api_router.post("/cart/add")
async def add_to_cart(item: CartItemAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        await db.carts.insert_one({"_id": str(uuid.uuid4()), "user_id": user["id"], "items": [{"product_id": item.product_id, "quantity": item.quantity}]})
    else:
        existing = next((i for i in cart.get("items", []) if i["product_id"] == item.product_id), None)
        if existing:
            await db.carts.update_one({"user_id": user["id"], "items.product_id": item.product_id}, {"$inc": {"items.$.quantity": item.quantity}})
        else:
            await db.carts.update_one({"user_id": user["id"]}, {"$push": {"items": {"product_id": item.product_id, "quantity": item.quantity}}})
    return {"message": "Added"}

@api_router.put("/cart/update")
async def update_cart(item: CartItemAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if item.quantity <= 0:
        await db.carts.update_one({"user_id": user["id"]}, {"$pull": {"items": {"product_id": item.product_id}}})
    else:
        await db.carts.update_one({"user_id": user["id"], "items.product_id": item.product_id}, {"$set": {"items.$.quantity": item.quantity}})
    return {"message": "Updated"}

@api_router.delete("/cart/clear")
async def clear_cart(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    return {"message": "Cleared"}

# ==================== Order Routes ====================

@api_router.get("/orders")
async def get_orders(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    orders = await db.orders.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    return [serialize_doc(o) for o in orders]

@api_router.get("/orders/all")
async def get_all_orders(request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    orders = await db.orders.find({}).sort("created_at", -1).to_list(10000)
    return {"orders": [serialize_doc(o) for o in orders], "total": len(orders)}

@api_router.post("/orders")
async def create_order(order_data: OrderCreate, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart empty")
    
    subtotal = 0
    order_items = []
    for item in cart["items"]:
        product = await db.products.find_one({"_id": item["product_id"]})
        if product:
            subtotal += product["price"] * item["quantity"]
            order_items.append({
                "product_id": item["product_id"],
                "product_name": product["name"],
                "product_name_ar": product.get("name_ar"),
                "quantity": item["quantity"],
                "price": product["price"],
                "image_url": product.get("image_url")
            })
    
    shipping = 150.0
    order = {
        "_id": str(uuid.uuid4()),
        "order_number": f"ORD-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}",
        "user_id": user["id"],
        "customer_name": f"{order_data.first_name} {order_data.last_name}",
        "customer_email": order_data.email,
        "phone": order_data.phone,
        "subtotal": subtotal,
        "shipping_cost": shipping,
        "total": subtotal + shipping,
        "status": "pending",
        "payment_method": order_data.payment_method,
        "notes": order_data.notes,
        "delivery_address": {
            "street_address": order_data.street_address,
            "city": order_data.city,
            "state": order_data.state,
            "country": order_data.country,
            "delivery_instructions": order_data.delivery_instructions
        },
        "items": order_items,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.orders.insert_one(order)
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    
    # Notify owner about new order
    owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
    if owner:
        await create_notification(
            str(owner["_id"]),
            "New Order",
            f"New order #{order['order_number'][:20]} from {order['customer_name']}",
            "info"
        )
    
    await manager.broadcast({"type": "sync", "tables": ["orders"]})
    return serialize_doc(order)

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, request: Request):
    valid = ["pending", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled", "complete"]
    if status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.orders.update_one({"_id": order_id}, {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}})
    
    # Send notification for delivered orders
    if status == "delivered":
        owner = await db.users.find_one({"email": PRIMARY_OWNER_EMAIL})
        if owner:
            await create_notification(
                str(owner["_id"]),
                "Order Delivered",
                f"Order #{order.get('order_number', order_id)[:20]} has been delivered",
                "success"
            )
    
    await manager.broadcast({"type": "order_update", "order_id": order_id, "status": status})
    return {"message": "Updated"}

# ==================== Customers Routes ====================

@api_router.get("/customers")
async def get_customers(request: Request, sort_by: str = "created_at"):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    customers = await db.users.find({"deleted_at": None}).to_list(10000)
    result = []
    
    for customer in customers:
        c_data = serialize_doc(customer)
        # Get order stats
        orders = await db.orders.find({"user_id": customer["_id"]}).to_list(10000)
        c_data["total_orders"] = len(orders)
        c_data["total_spent"] = sum(o.get("total", 0) for o in orders)
        c_data["total_items"] = sum(sum(i.get("quantity", 1) for i in o.get("items", [])) for o in orders)
        
        # Status indicators
        c_data["has_processing"] = any(o.get("status") in ["pending", "preparing"] for o in orders)
        c_data["has_shipped"] = any(o.get("status") in ["shipped", "out_for_delivery"] for o in orders)
        c_data["has_cancelled"] = any(o.get("status") == "cancelled" for o in orders)
        
        result.append(c_data)
    
    # Sort
    if sort_by == "total_items":
        result.sort(key=lambda x: x["total_items"], reverse=True)
    elif sort_by == "total_spent":
        result.sort(key=lambda x: x["total_spent"], reverse=True)
    else:
        result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return {"customers": result, "total": len(result)}

@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, request: Request):
    user = await get_current_user(request)
    role = await get_user_role(user) if user else "guest"
    if role not in ["owner", "partner"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    customer = await db.users.find_one({"_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Not found")
    
    c_data = serialize_doc(customer)
    orders = await db.orders.find({"user_id": customer_id}).sort("created_at", -1).to_list(10000)
    c_data["orders"] = [serialize_doc(o) for o in orders]
    c_data["total_spent"] = sum(o.get("total", 0) for o in orders)
    c_data["total_orders"] = len(orders)
    
    return c_data

# ==================== Favorites Routes ====================

@api_router.get("/favorites")
async def get_favorites(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    favs = await db.favorites.find({"user_id": user["id"], "deleted_at": None}).to_list(1000)
    result = []
    for f in favs:
        product = await db.products.find_one({"_id": f["product_id"]})
        if product:
            result.append({**serialize_doc(f), "product": serialize_doc(product)})
    return {"favorites": result, "total": len(result)}

@api_router.get("/favorites/check/{product_id}")
async def check_favorite(product_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    fav = await db.favorites.find_one({"user_id": user["id"], "product_id": product_id, "deleted_at": None})
    return {"is_favorite": fav is not None}

@api_router.post("/favorites/toggle")
async def toggle_favorite(data: FavoriteAdd, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    existing = await db.favorites.find_one({"user_id": user["id"], "product_id": data.product_id})
    if existing:
        if existing.get("deleted_at"):
            await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": None, "updated_at": datetime.now(timezone.utc)}})
            return {"is_favorite": True}
        else:
            await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
            return {"is_favorite": False}
    else:
        await db.favorites.insert_one({"_id": str(uuid.uuid4()), "user_id": user["id"], "product_id": data.product_id, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None})
        return {"is_favorite": True}

# ==================== Comments Routes ====================

@api_router.get("/products/{product_id}/comments")
async def get_comments(product_id: str, request: Request, skip: int = 0, limit: int = 50):
    user = await get_current_user(request)
    user_id = user["id"] if user else None
    comments = await db.comments.find({"product_id": product_id, "deleted_at": None}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    pipeline = [{"$match": {"product_id": product_id, "deleted_at": None, "rating": {"$ne": None}}}, {"$group": {"_id": None, "count": {"$sum": 1}, "avg": {"$avg": "$rating"}}}]
    stats = await db.comments.aggregate(pipeline).to_list(1)
    avg_rating = round(stats[0]["avg"], 1) if stats and stats[0].get("avg") else None
    rating_count = stats[0]["count"] if stats else 0
    return {"comments": [{**serialize_doc(c), "is_owner": c.get("user_id") == user_id} for c in comments], "total": len(comments), "avg_rating": avg_rating, "rating_count": rating_count}

@api_router.post("/products/{product_id}/comments")
async def add_comment(product_id: str, data: CommentCreate, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if data.rating and (data.rating < 1 or data.rating > 5):
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    comment = {"_id": str(uuid.uuid4()), "product_id": product_id, "user_id": user["id"], "user_name": user["name"], "user_picture": user.get("picture"), "text": data.text, "rating": data.rating, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None}
    await db.comments.insert_one(comment)
    return {**serialize_doc(comment), "is_owner": True}

# ==================== Sync Routes ====================

@api_router.post("/sync/pull")
async def sync_pull(request_data: SyncPullRequest):
    last_pulled_at = request_data.last_pulled_at or 0
    tables = request_data.tables or ["car_brands", "car_models", "product_brands", "categories", "products", "suppliers", "distributors"]
    last_dt = datetime.fromtimestamp(last_pulled_at / 1000, tz=timezone.utc) if last_pulled_at else datetime.min.replace(tzinfo=timezone.utc)
    
    changes = {}
    for table in tables:
        coll = db[table]
        created = await coll.find({"created_at": {"$gt": last_dt}, "deleted_at": None}).to_list(10000)
        updated = await coll.find({"updated_at": {"$gt": last_dt}, "created_at": {"$lte": last_dt}, "deleted_at": None}).to_list(10000)
        deleted = await coll.find({"deleted_at": {"$gt": last_dt}}).to_list(10000)
        changes[table] = {
            "created": [serialize_doc(d) for d in created],
            "updated": [serialize_doc(d) for d in updated],
            "deleted": [str(d["_id"]) for d in deleted],
        }
    
    return {"changes": changes, "timestamp": get_timestamp_ms()}

# ==================== WebSocket ====================

@api_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = None
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "auth":
                token = data.get("token")
                if token:
                    session = await db.sessions.find_one({"session_token": token})
                    if session:
                        user_id = session["user_id"]
                        manager.disconnect(websocket)
                        await manager.connect(websocket, user_id)
                        await websocket.send_json({"type": "auth_ok", "user_id": user_id})
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)

# ==================== Health & Root ====================

@api_router.get("/")
async def root():
    return {"message": "Al-Ghazaly Auto Parts API v3.0", "status": "running", "architecture": "offline-first-advanced"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "database": "mongodb", "version": "3.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    logger.info("Connected to MongoDB - Advanced Owner Interface Backend v3.0")
    
    # Create indexes for better performance
    await db.users.create_index("email")
    await db.sessions.create_index("session_token")
    await db.partners.create_index("email")
    await db.admins.create_index("email")
    await db.subscribers.create_index("email")
    await db.products.create_index("added_by_admin_id")
    await db.orders.create_index("user_id")
    await db.orders.create_index("status")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    
    # Seed if needed
    count = await db.car_brands.count_documents({})
    if count == 0:
        logger.info("Seeding database...")
        await seed_database()

async def seed_database():
    """Seed initial data"""
    # Car Brands
    await db.car_brands.insert_many([
        {"_id": "cb_toyota", "name": "Toyota", "name_ar": "تويوتا", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_mitsubishi", "name": "Mitsubishi", "name_ar": "ميتسوبيشي", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cb_mazda", "name": "Mazda", "name_ar": "مازدا", "logo": None, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Car Models
    await db.car_models.insert_many([
        {"_id": "cm_camry", "brand_id": "cb_toyota", "name": "Camry", "name_ar": "كامري", "year_start": 2018, "year_end": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_corolla", "brand_id": "cb_toyota", "name": "Corolla", "name_ar": "كورولا", "year_start": 2019, "year_end": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_hilux", "brand_id": "cb_toyota", "name": "Hilux", "name_ar": "هايلكس", "year_start": 2016, "year_end": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_lancer", "brand_id": "cb_mitsubishi", "name": "Lancer", "name_ar": "لانسر", "year_start": 2015, "year_end": 2020, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_pajero", "brand_id": "cb_mitsubishi", "name": "Pajero", "name_ar": "باجيرو", "year_start": 2016, "year_end": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_mazda3", "brand_id": "cb_mazda", "name": "Mazda 3", "name_ar": "مازدا 3", "year_start": 2019, "year_end": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cm_cx5", "brand_id": "cb_mazda", "name": "CX-5", "name_ar": "سي اكس 5", "year_start": 2017, "year_end": 2024, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Product Brands
    await db.product_brands.insert_many([
        {"_id": "pb_kby", "name": "KBY", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "pb_ctr", "name": "CTR", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "pb_art", "name": "ART", "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Categories
    await db.categories.insert_many([
        {"_id": "cat_engine", "name": "Engine", "name_ar": "المحرك", "parent_id": None, "icon": "engine", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_suspension", "name": "Suspension", "name_ar": "نظام التعليق", "parent_id": None, "icon": "car-suspension", "sort_order": 2, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_clutch", "name": "Clutch", "name_ar": "الكلتش", "parent_id": None, "icon": "car-clutch", "sort_order": 3, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_electricity", "name": "Electricity", "name_ar": "الكهرباء", "parent_id": None, "icon": "lightning-bolt", "sort_order": 4, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_body", "name": "Body", "name_ar": "البودي", "parent_id": None, "icon": "car-door", "sort_order": 5, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_tires", "name": "Tires", "name_ar": "الإطارات", "parent_id": None, "icon": "car-tire-alert", "sort_order": 6, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_filters", "name": "Filters", "name_ar": "الفلاتر", "parent_id": "cat_engine", "icon": "filter", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_spark_plugs", "name": "Spark Plugs", "name_ar": "شمعات الاشتعال", "parent_id": "cat_engine", "icon": "flash", "sort_order": 2, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_shock_absorbers", "name": "Shock Absorbers", "name_ar": "ممتص الصدمات", "parent_id": "cat_suspension", "icon": "car-brake-abs", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_batteries", "name": "Batteries", "name_ar": "البطاريات", "parent_id": "cat_electricity", "icon": "battery", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_headlights", "name": "Headlights", "name_ar": "المصابيح الأمامية", "parent_id": "cat_electricity", "icon": "lightbulb", "sort_order": 2, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "cat_mirrors", "name": "Mirrors", "name_ar": "المرايا", "parent_id": "cat_body", "icon": "flip-horizontal", "sort_order": 1, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    # Products
    await db.products.insert_many([
        {"_id": "prod_oil_filter_1", "name": "Toyota Oil Filter", "name_ar": "فلتر زيت تويوتا", "price": 45.99, "sku": "TOY-OIL-001", "category_id": "cat_filters", "product_brand_id": "pb_kby", "car_model_ids": ["cm_camry", "cm_corolla"], "stock_quantity": 50, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_air_filter_1", "name": "Camry Air Filter", "name_ar": "فلتر هواء كامري", "price": 35.50, "sku": "CAM-AIR-001", "category_id": "cat_filters", "product_brand_id": "pb_ctr", "car_model_ids": ["cm_camry"], "stock_quantity": 30, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_spark_plug_1", "name": "Iridium Spark Plugs Set", "name_ar": "طقم شمعات إريديوم", "price": 89.99, "sku": "SPK-IRD-001", "category_id": "cat_spark_plugs", "product_brand_id": "pb_art", "car_model_ids": ["cm_camry", "cm_corolla", "cm_lancer"], "stock_quantity": 25, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_shock_1", "name": "Front Shock Absorber", "name_ar": "ممتص صدمات أمامي", "price": 125.00, "sku": "SHK-FRT-001", "category_id": "cat_shock_absorbers", "product_brand_id": "pb_kby", "car_model_ids": ["cm_hilux", "cm_pajero"], "stock_quantity": 15, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_battery_1", "name": "Car Battery 70Ah", "name_ar": "بطارية سيارة 70 أمبير", "price": 185.00, "sku": "BAT-70A-001", "category_id": "cat_batteries", "product_brand_id": "pb_art", "car_model_ids": ["cm_camry", "cm_corolla", "cm_hilux", "cm_pajero"], "stock_quantity": 20, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_headlight_1", "name": "LED Headlight Bulb H7", "name_ar": "لمبة فانوس LED H7", "price": 55.00, "sku": "LED-H7-001", "category_id": "cat_headlights", "product_brand_id": "pb_kby", "car_model_ids": ["cm_mazda3", "cm_cx5"], "stock_quantity": 40, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_mirror_1", "name": "Side Mirror Right", "name_ar": "مرآة جانبية يمين", "price": 145.00, "sku": "MIR-R-001", "category_id": "cat_mirrors", "product_brand_id": "pb_ctr", "car_model_ids": ["cm_camry"], "stock_quantity": 10, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
        {"_id": "prod_clutch_kit_1", "name": "Complete Clutch Kit", "name_ar": "طقم كلتش كامل", "price": 299.99, "sku": "CLT-KIT-001", "category_id": "cat_clutch", "product_brand_id": "pb_ctr", "car_model_ids": ["cm_lancer", "cm_mazda3"], "stock_quantity": 8, "hidden_status": False, "settled": False, "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc), "deleted_at": None},
    ])
    
    logger.info("Database seeded successfully")

@app.on_event("shutdown")
async def shutdown():
    client.close()
