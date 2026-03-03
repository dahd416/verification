from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import zipfile
import tempfile
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import json
import qrcode
from io import BytesIO
import base64
import aiofiles
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'orviti-academy-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create uploads directory (used as fallback when S3 is not configured)
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# ==================== S3 STORAGE ==================== 
# If S3_BUCKET_NAME is set, all uploads go to S3.
# Otherwise falls back to local filesystem.
_s3_client = None
S3_BUCKET = os.environ.get('S3_BUCKET_NAME', '')
S3_REGION = os.environ.get('S3_REGION', 'us-east-1')
S3_ACCESS_KEY = os.environ.get('S3_ACCESS_KEY_ID', '')
S3_SECRET_KEY = os.environ.get('S3_SECRET_ACCESS_KEY', '')
S3_CUSTOM_DOMAIN = os.environ.get('S3_CUSTOM_DOMAIN', '')  # optional CDN/custom domain
S3_ENDPOINT_URL = os.environ.get('S3_ENDPOINT_URL', '')    # for S3-compatible providers (Cloudflare R2, etc.)

def get_s3_client():
    """Get or create the boto3 S3 client (lazy init)."""
    global _s3_client
    if _s3_client is None and S3_BUCKET:
        import boto3
        kwargs = {
            'region_name': S3_REGION,
            'aws_access_key_id': S3_ACCESS_KEY,
            'aws_secret_access_key': S3_SECRET_KEY,
        }
        if S3_ENDPOINT_URL:
            kwargs['endpoint_url'] = S3_ENDPOINT_URL
        _s3_client = boto3.client('s3', **kwargs)
        logger.info(f"S3 client initialized: bucket={S3_BUCKET}, region={S3_REGION}")
    return _s3_client

def s3_proxy_url(key: str) -> str:
    """Return a backend-proxied URL for the S3 object.
    This keeps the bucket private — the browser never talks to MinIO directly.
    The actual fetch is done in the /api/media/ endpoint with S3 credentials.
    """
    return f"/api/media/{key}"

if S3_BUCKET:
    logger.info(f"S3 storage enabled (private proxy mode): bucket={S3_BUCKET}")
else:
    logger.info("S3 not configured — using local file storage")

# Create the main app
app = FastAPI(title="ORVITI Academy API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    organization_name: Optional[str] = "ORVITI Academy"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    organization_id: str
    role: str = "admin"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class CourseCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    instructor: str
    duration_hours: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class CourseResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    organization_id: str
    name: str
    description: str
    instructor: str
    duration_hours: int
    start_date: Optional[str]
    end_date: Optional[str]
    created_at: str
    recipient_count: int = 0
    diploma_count: int = 0

class TemplateFieldConfig(BaseModel):
    id: str
    type: str  # 'variable', 'text', 'image'
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    text: Optional[str] = None
    variable: Optional[str] = None
    fontFamily: str = "Libre Baskerville"
    fontSize: int = 24
    fontColor: str = "#0f172a"
    bold: bool = False
    italic: bool = False
    underline: bool = False
    align: str = "center"
    rotation: float = 0
    opacity: float = 1
    imageUrl: Optional[str] = None

class TemplateCreate(BaseModel):
    name: str
    background_image_url: str
    fields_config: List[Dict[str, Any]]
    thumbnail_url: Optional[str] = None
    canvas_width: int = 1123  # A4 landscape at 96 DPI
    canvas_height: int = 794

class TemplateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    organization_id: str
    name: str
    background_image_url: str
    fields_config: List[Dict[str, Any]]
    thumbnail_url: Optional[str]
    canvas_width: int
    canvas_height: int
    created_at: str

class RecipientCreate(BaseModel):
    full_name: str
    email: EmailStr
    course_id: str

class RecipientResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    organization_id: str
    course_id: str
    full_name: str
    email: str
    created_at: str

class DiplomaCreate(BaseModel):
    course_id: str
    template_id: str
    recipient_ids: List[str]

class DiplomaResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    course_id: str
    template_id: str
    recipient_id: str
    certificate_id: str
    qr_code_url: str
    pdf_url: Optional[str]
    png_url: Optional[str]
    status: str  # 'valid', 'revoked'
    issued_at: str
    revoked_at: Optional[str]
    recipient_name: Optional[str] = None
    course_name: Optional[str] = None
    email_sent: bool = False
    email_sent_at: Optional[str] = None

class VerificationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    certificate_id: str
    recipient_name: str
    course_name: str
    instructor: str
    duration_hours: int
    organization_name: str
    status: str
    issued_at: str
    diploma_preview_url: Optional[str]

class DashboardStats(BaseModel):
    total_diplomas: int
    valid_diplomas: int
    revoked_diplomas: int
    total_courses: int
    total_recipients: int
    total_templates: int
    recent_activity: List[Dict[str, Any]]

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, org_id: str) -> str:
    payload = {
        "user_id": user_id,
        "org_id": org_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create organization
    org_id = str(uuid.uuid4())
    org = {
        "id": org_id,
        "name": data.organization_name,
        "logo_url": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org)
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "organization_id": org_id,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id, org_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=data.email,
            name=data.name,
            organization_id=org_id,
            role="admin"
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    email = data.email.strip().lower()
    logger.info(f"Login attempt for: {email}")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    logger.info(f"User found: {user is not None}")
    if not user:
        logger.warning(f"User not found in DB: {email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_valid = verify_password(data.password, user["password_hash"])
    logger.info(f"Password valid: {password_valid}")
    
    if not password_valid:
        logger.warning(f"Invalid password for: {email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["organization_id"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            organization_id=user["organization_id"],
            role=user.get("role", "admin")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        organization_id=user["organization_id"],
        role=user.get("role", "admin")
    )

# ==================== COURSES ROUTES ====================

@api_router.get("/courses", response_model=List[CourseResponse])
async def get_courses(user: dict = Depends(get_current_user)):
    
    courses = await db.courses.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0}
    ).to_list(1000)
    
    # Get recipient and diploma counts
    for course in courses:
        recipient_count = await db.recipients.count_documents({"course_id": course["id"]})
        diploma_count = await db.diplomas.count_documents({"course_id": course["id"]})
        course["recipient_count"] = recipient_count
        course["diploma_count"] = diploma_count
    
    return courses

@api_router.post("/courses", response_model=CourseResponse)
async def create_course(data: CourseCreate, user: dict = Depends(get_current_user)):
    
    
    course_id = str(uuid.uuid4())
    course = {
        "id": course_id,
        "organization_id": user["organization_id"],
        "name": data.name,
        "description": data.description or "",
        "instructor": data.instructor,
        "duration_hours": data.duration_hours,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.courses.insert_one(course)
    course["recipient_count"] = 0
    return course

@api_router.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str, user: dict = Depends(get_current_user)):
    
    course = await db.courses.find_one(
        {"id": course_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course["recipient_count"] = await db.recipients.count_documents({"course_id": course_id})
    return course

@api_router.put("/courses/{course_id}", response_model=CourseResponse)
async def update_course(course_id: str, data: CourseCreate, user: dict = Depends(get_current_user)):
    
    
    result = await db.courses.update_one(
        {"id": course_id, "organization_id": user["organization_id"]},
        {"$set": {
            "name": data.name,
            "description": data.description or "",
            "instructor": data.instructor,
            "duration_hours": data.duration_hours,
            "start_date": data.start_date,
            "end_date": data.end_date
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    course["recipient_count"] = await db.recipients.count_documents({"course_id": course_id})
    return course

@api_router.delete("/courses/{course_id}")
async def delete_course(course_id: str, user: dict = Depends(get_current_user)):
    
    
    result = await db.courses.delete_one(
        {"id": course_id, "organization_id": user["organization_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Also delete related recipients
    await db.recipients.delete_many({"course_id": course_id})
    
    return {"message": "Course deleted"}

# ==================== TEMPLATES ROUTES ====================

@api_router.get("/templates", response_model=List[TemplateResponse])
async def get_templates(user: dict = Depends(get_current_user)):
    
    templates = await db.templates.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0}
    ).to_list(1000)
    return templates

@api_router.post("/templates", response_model=TemplateResponse)
async def create_template(data: TemplateCreate, user: dict = Depends(get_current_user)):
    
    
    template_id = str(uuid.uuid4())
    template = {
        "id": template_id,
        "organization_id": user["organization_id"],
        "name": data.name,
        "background_image_url": data.background_image_url,
        "fields_config": data.fields_config,
        "thumbnail_url": data.thumbnail_url,
        "canvas_width": data.canvas_width,
        "canvas_height": data.canvas_height,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.templates.insert_one(template)
    return template

@api_router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, user: dict = Depends(get_current_user)):
    
    template = await db.templates.find_one(
        {"id": template_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@api_router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, data: TemplateCreate, user: dict = Depends(get_current_user)):
    
    
    result = await db.templates.update_one(
        {"id": template_id, "organization_id": user["organization_id"]},
        {"$set": {
            "name": data.name,
            "background_image_url": data.background_image_url,
            "fields_config": data.fields_config,
            "thumbnail_url": data.thumbnail_url,
            "canvas_width": data.canvas_width,
            "canvas_height": data.canvas_height
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    return template

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    
    
    result = await db.templates.delete_one(
        {"id": template_id, "organization_id": user["organization_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted"}

@api_router.post("/templates/{template_id}/duplicate", response_model=TemplateResponse)
async def duplicate_template(template_id: str, user: dict = Depends(get_current_user)):
    
    
    original = await db.templates.find_one(
        {"id": template_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not original:
        raise HTTPException(status_code=404, detail="Template not found")
    
    new_id = str(uuid.uuid4())
    new_template = {
        **original,
        "id": new_id,
        "name": f"{original['name']} (Copy)",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.templates.insert_one(new_template)
    return new_template

# ==================== RECIPIENTS ROUTES ====================

@api_router.get("/recipients", response_model=List[RecipientResponse])
async def get_recipients(course_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    
    
    query = {"organization_id": user["organization_id"]}
    if course_id:
        query["course_id"] = course_id
    
    recipients = await db.recipients.find(query, {"_id": 0}).to_list(1000)
    return recipients

@api_router.post("/recipients", response_model=RecipientResponse)
async def create_recipient(data: RecipientCreate, user: dict = Depends(get_current_user)):
    
    
    # Verify course exists
    course = await db.courses.find_one(
        {"id": data.course_id, "organization_id": user["organization_id"]}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    recipient_id = str(uuid.uuid4())
    recipient = {
        "id": recipient_id,
        "organization_id": user["organization_id"],
        "course_id": data.course_id,
        "full_name": data.full_name,
        "email": data.email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.recipients.insert_one(recipient)
    return recipient

@api_router.post("/recipients/bulk")
async def bulk_import_recipients(
    course_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    
    
    # Verify course exists
    course = await db.courses.find_one(
        {"id": course_id, "organization_id": user["organization_id"]}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    content = await file.read()
    lines = content.decode('utf-8').strip().split('\n')
    
    # Parse CSV (simple parser - expects: full_name,email)
    headers = [h.strip().lower() for h in lines[0].split(',')]
    
    imported = 0
    errors = []
    
    for i, line in enumerate(lines[1:], start=2):
        try:
            values = [v.strip() for v in line.split(',')]
            row = dict(zip(headers, values))
            
            recipient_id = str(uuid.uuid4())
            recipient = {
                "id": recipient_id,
                "organization_id": user["organization_id"],
                "course_id": course_id,
                "full_name": row.get('full_name', row.get('name', '')),
                "email": row.get('email', ''),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            if recipient["full_name"] and recipient["email"]:
                await db.recipients.insert_one(recipient)
                imported += 1
            else:
                errors.append(f"Row {i}: Missing name or email")
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
    
    return {"imported": imported, "errors": errors}

@api_router.delete("/recipients/{recipient_id}")
async def delete_recipient(recipient_id: str, user: dict = Depends(get_current_user)):
    
    
    result = await db.recipients.delete_one(
        {"id": recipient_id, "organization_id": user["organization_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    return {"message": "Recipient deleted"}

@api_router.get("/recipients/csv-template")
async def get_csv_template():
    csv_content = "full_name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com"
    return StreamingResponse(
        BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=recipients_template.csv"}
    )

# ==================== DIPLOMAS ROUTES ====================

def generate_certificate_id() -> str:
    short_uuid = str(uuid.uuid4()).replace('-', '').upper()[:10]
    return f"CERT-{short_uuid[:6]}-{short_uuid[6:]}"

def generate_qr_code(
    verification_url: str, 
    fill_color: str = "#000000", 
    back_color: str = "transparent",
    corner_style: str = "square",
    dot_style: str = "squares",
    error_level: str = "M",
    size: int = 100
) -> str:
    """Generate QR code as base64 data URL - bulletproof version"""
    import base64
    from io import BytesIO

    if not verification_url:
        verification_url = "https://orviti.com"

    logger.info(f"Generating QR code for URL: {verification_url[:80]}")

    # -------------------------------------------------------
    # Step 1: Try qrcode + PIL (most reliable)
    # -------------------------------------------------------
    try:
        import qrcode
        from PIL import Image as PILImage

        # Normalize fill_color - if caller passes transparent/empty, default to black
        qr_fill = fill_color if fill_color and fill_color not in ("", "transparent") else "#000000"
        use_transparency = (back_color in ("transparent", "", None))

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=3,
        )
        qr.add_data(verification_url)
        qr.make(fit=True)

        # Use a sentinel magenta background so that we can safely erase ONLY
        # the background without touching the QR modules (even if they're white)
        SENTINEL_BACK = "#FF00FF"
        pil_img_wrapper = qr.make_image(fill_color=qr_fill, back_color=SENTINEL_BACK)

        # Get underlying PIL image
        if hasattr(pil_img_wrapper, 'to_image'):
            raw_img = pil_img_wrapper.to_image()
        elif hasattr(pil_img_wrapper, '_img'):
            raw_img = pil_img_wrapper._img
        else:
            # Fallback: direct save
            buf = BytesIO()
            pil_img_wrapper.save(buf)
            buf.seek(0)
            if not use_transparency:
                data_url = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
                logger.info(f"QR generated via wrapper save (len={len(data_url)})")
                return data_url
            raw_img = PILImage.open(buf)

        if use_transparency:
            # Erase only the sentinel magenta pixels → make them transparent
            rgba_img = raw_img.convert("RGBA")
            data = rgba_img.getdata()
            new_data = []
            for item in data:
                r, g, b = item[0], item[1], item[2]
                # Near-magenta: high red, high blue, low green
                if r > 200 and b > 200 and g < 50:
                    new_data.append((255, 255, 255, 0))  # transparent
                else:
                    new_data.append((r, g, b, 255))      # keep opaque
            rgba_img.putdata(new_data)
            final_img = rgba_img
        else:
            # Replace sentinel magenta with the actual requested background color
            qr_back = back_color if back_color and back_color not in ("", "transparent") else "#ffffff"
            rgb_img = raw_img.convert("RGBA")
            data = rgb_img.getdata()
            # Parse qr_back to RGB tuple
            def hex_to_rgb(h):
                h = h.lstrip("#")
                if len(h) == 3: h = "".join(c*2 for c in h)
                try:
                    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
                except:
                    return (255, 255, 255)
            br, bg, bb = hex_to_rgb(qr_back)
            new_data = []
            for item in data:
                r, g, b = item[0], item[1], item[2]
                if r > 200 and b > 200 and g < 50:
                    new_data.append((br, bg, bb, 255))
                else:
                    new_data.append((r, g, b, 255))
            rgb_img.putdata(new_data)
            final_img = rgb_img.convert("RGB")

        buffer = BytesIO()
        final_img.save(buffer, format="PNG")
        buffer.seek(0)
        data_url = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
        logger.info(f"QR code generated successfully via qrcode+PIL (len={len(data_url)})")
        return data_url

    except Exception as e:
        logger.error(f"qrcode+PIL failed: {e}", exc_info=True)

    # -------------------------------------------------------
    # Step 2: Try segno (alternate library)
    # -------------------------------------------------------
    try:
        import segno

        qr = segno.make(verification_url, error="M")
        buffer = BytesIO()
        qr_back_val = None if back_color in ("transparent", "") else back_color
        qr_dark_val = fill_color if fill_color and fill_color not in ("transparent", "") else "#000000"
        qr.save(buffer, kind="png", scale=10,
                dark=qr_dark_val,
                light=qr_back_val)
        buffer.seek(0)
        data_url = f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"
        logger.info(f"QR code generated via segno (len={len(data_url)})")
        return data_url

    except Exception as e2:
        logger.error(f"segno also failed: {e2}", exc_info=True)

    # -------------------------------------------------------
    # Step 3: Inline SVG fallback (no library needed)
    # -------------------------------------------------------
    logger.warning("All QR libraries failed. Returning inline SVG placeholder.")
    placeholder_svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        '<rect width="100" height="100" fill="white"/>'
        '<rect x="10" y="10" width="30" height="30" fill="#000"/>'
        '<rect x="15" y="15" width="20" height="20" fill="white"/>'
        '<rect x="60" y="10" width="30" height="30" fill="#000"/>'
        '<rect x="65" y="15" width="20" height="20" fill="white"/>'
        '<rect x="10" y="60" width="30" height="30" fill="#000"/>'
        '<rect x="15" y="65" width="20" height="20" fill="white"/>'
        '<text x="50" y="55" text-anchor="middle" font-size="8" fill="#555">QR</text>'
        "</svg>"
    )
    return f"data:image/svg+xml;base64,{base64.b64encode(placeholder_svg.encode()).decode()}"


@api_router.post("/diplomas/generate")
async def generate_diplomas(data: DiplomaCreate, user: dict = Depends(get_current_user)):
    
    
    # Verify course and template
    course = await db.courses.find_one(
        {"id": data.course_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    template = await db.templates.find_one(
        {"id": data.template_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get organization
    org = await db.organizations.find_one(
        {"id": user["organization_id"]},
        {"_id": 0}
    )
    
    generated = []
    frontend_url = os.environ.get('FRONTEND_URL', '')

    
    for recipient_id in data.recipient_ids:
        recipient = await db.recipients.find_one(
            {"id": recipient_id, "organization_id": user["organization_id"]},
            {"_id": 0}
        )
        if not recipient:
            continue
        
        # Check if diploma already exists
        existing = await db.diplomas.find_one({
            "course_id": data.course_id,
            "recipient_id": recipient_id
        })
        if existing:
            continue
        
        diploma_id = str(uuid.uuid4())
        certificate_id = generate_certificate_id()
        verification_url = f"{frontend_url}/verify/{certificate_id}"
        qr_code = generate_qr_code(verification_url)
        
        diploma = {
            "id": diploma_id,
            "organization_id": user["organization_id"],
            "course_id": data.course_id,
            "template_id": data.template_id,
            "recipient_id": recipient_id,
            "certificate_id": certificate_id,
            "qr_code_url": qr_code,
            "pdf_url": None,
            "png_url": None,
            "status": "valid",
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "revoked_at": None,
            # Store denormalized data for faster queries
            "recipient_name": recipient["full_name"],
            "recipient_email": recipient["email"],
            "course_name": course["name"],
            "instructor": course["instructor"],
            "duration_hours": course["duration_hours"],
            "organization_name": org["name"] if org else "ORVITI Academy",
            # Email tracking
            "email_sent": False,
            "email_sent_at": None
        }
        
        await db.diplomas.insert_one(diploma)
        generated.append(diploma)
    
    return {"generated": len(generated), "diplomas": [{k: v for k, v in d.items() if k != "_id"} for d in generated]}

@api_router.get("/diplomas", response_model=List[DiplomaResponse])
async def get_diplomas(
    course_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    
    
    query = {"organization_id": user["organization_id"]}
    if course_id:
        query["course_id"] = course_id
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"recipient_name": {"$regex": search, "$options": "i"}},
            {"certificate_id": {"$regex": search, "$options": "i"}}
        ]
    
    diplomas = await db.diplomas.find(query, {"_id": 0}).sort("issued_at", -1).to_list(1000)
    return diplomas

@api_router.get("/diplomas/{diploma_id}", response_model=DiplomaResponse)
async def get_diploma(diploma_id: str, user: dict = Depends(get_current_user)):
    
    
    diploma = await db.diplomas.find_one(
        {"id": diploma_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not diploma:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    return diploma

@api_router.post("/diplomas/{diploma_id}/revoke")
async def revoke_diploma(diploma_id: str, user: dict = Depends(get_current_user)):
    
    
    result = await db.diplomas.update_one(
        {"id": diploma_id, "organization_id": user["organization_id"]},
        {"$set": {
            "status": "revoked",
            "revoked_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    return {"message": "Diploma revoked"}

@api_router.post("/diplomas/{diploma_id}/reactivate")
async def reactivate_diploma(diploma_id: str, user: dict = Depends(get_current_user)):
    
    
    result = await db.diplomas.update_one(
        {"id": diploma_id, "organization_id": user["organization_id"]},
        {"$set": {
            "status": "valid",
            "revoked_at": None
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    return {"message": "Diploma reactivated"}

@api_router.delete("/diplomas/{diploma_id}")
async def delete_diploma(diploma_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a diploma"""
    result = await db.diplomas.delete_one(
        {"id": diploma_id, "organization_id": user["organization_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    return {"message": "Diploma deleted"}

@api_router.post("/diplomas/{diploma_id}/send-email")
async def send_diploma_email(diploma_id: str, user: dict = Depends(get_current_user)):
    """Send diploma PDF to recipient via email"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.application import MIMEApplication
    from pdf_generator import get_pdf_generator
    
    # Get diploma
    diploma = await db.diplomas.find_one(
        {"id": diploma_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not diploma:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    # Get settings
    settings = await db.settings.find_one(
        {"organization_id": user["organization_id"]},
        {"_id": 0}
    )
    
    if not settings or not settings.get("email_enabled"):
        raise HTTPException(status_code=400, detail="El envío de emails no está habilitado")
    
    if not settings.get("smtp_user") or not settings.get("smtp_password"):
        raise HTTPException(status_code=400, detail="Configuración SMTP incompleta")
    
    recipient_email = diploma.get("recipient_email")
    if not recipient_email:
        raise HTTPException(status_code=400, detail="El destinatario no tiene email registrado")
    
    # Get template for PDF generation
    template = await db.templates.find_one(
        {"id": diploma.get("template_id")},
        {"_id": 0}
    )
    
    # Prepare PDF data
    issue_date = datetime.fromisoformat(diploma["issued_at"].replace("Z", "+00:00"))
    formatted_date = issue_date.strftime("%d de %B, %Y")
    
    certificate_data = {
        "recipient_name": diploma["recipient_name"],
        "course_name": diploma["course_name"],
        "organization_name": diploma.get("organization_name", "ORVITI Academy"),
        "instructor": diploma.get("instructor", ""),
        "duration_hours": diploma.get("duration_hours", 0),
        "issue_date": formatted_date,
        "certificate_id": diploma["certificate_id"],
        "qr_code_url": diploma["qr_code_url"]
    }
    
    # If we have a custom template, prepare the fields
    if template and template.get("fields_config"):
        # Prepare fields for the template
        fields = []
        for field_config in template.get("fields_config", []):
            field = {
                "x": field_config.get("x", 0),
                "y": field_config.get("y", 0),
                "width": field_config.get("width"),
                "height": field_config.get("height"),
                "fontFamily": field_config.get("fontFamily", "Urbanist"),
                "fontSize": field_config.get("fontSize", 24),
                "fontColor": field_config.get("fontColor", "#000000"),
                "bold": field_config.get("bold", False),
                "italic": field_config.get("italic", False),
                "underline": field_config.get("underline", False),
                "align": field_config.get("align", "left"),
                "rotation": field_config.get("rotation", 0),
                "opacity": field_config.get("opacity", 1),
                "type": field_config.get("type", "text"),
            }
            
            variable = field_config.get("variable", "")
            field_type = field_config.get("type", "text")

            # Value mapping logic
            if field_type == "image":
                field["type"] = "image"
                field["imageUrl"] = field_config.get("imageUrl", "")
                field["imageWidth"] = field_config.get("imageWidth", field_config.get("width", 150))
                field["imageHeight"] = field_config.get("imageHeight", field_config.get("height", 150))
                field["value"] = "[image]"
            elif variable == "qr_code" or field_type == "qr_code":
                field["type"] = "qr_code"
                qr_color = field_config.get("qrColor", "#000000")
                qr_size = field_config.get("qrSize", 100)
                qr_bg_color = field_config.get("qrBgColor", "transparent")
                qr_corner_style = field_config.get("qrCornerStyle", "square")
                qr_dot_style = field_config.get("qrDotStyle", "squares")
                qr_error_level = field_config.get("qrErrorLevel", "M")
                
                frontend_url = os.environ.get('FRONTEND_URL', '').rstrip('/')
                if not frontend_url:
                    frontend_url = "https://orviti.com"
                verification_url = f"{frontend_url}/verify/{diploma['certificate_id']}"
                
                qr_value = generate_qr_code(
                    verification_url, 
                    fill_color=qr_color, 
                    back_color=qr_bg_color,
                    corner_style=qr_corner_style,
                    dot_style=qr_dot_style,
                    error_level=qr_error_level,
                    size=qr_size
                )
                
                if qr_value:
                    field["value"] = qr_value
                else:
                    field["value"] = ""

                field["qrSize"] = qr_size
                field["width"] = qr_size
                field["height"] = qr_size
            elif variable == "recipient_name":
                field["value"] = diploma["recipient_name"]
            elif variable == "course_name":
                field["value"] = diploma["course_name"]
            elif variable == "completion_date" or variable == "issue_date":
                field["value"] = formatted_date
            elif variable == "instructor_name":
                field["value"] = diploma.get("instructor", "")
            elif variable == "duration_hours":
                field["value"] = f"{diploma.get('duration_hours', 0)} horas"
            elif variable == "certificate_id":
                field["value"] = diploma["certificate_id"]
            elif variable == "organization_name":
                field["value"] = diploma.get("organization_name", "ORVITI Academy")
            elif field_config.get("text"):
                field["value"] = field_config["text"]
            else:
                field["value"] = ""
            
            if field.get("value"):
                fields.append(field)

        certificate_data["fields"] = fields
        certificate_data["custom_template"] = True
        certificate_data["background_image_url"] = template.get("background_image_url", "")
        certificate_data["canvas_width"] = template.get("canvas_width", 1123)
        certificate_data["canvas_height"] = template.get("canvas_height", 794)
    
    # Generate PDF
    pdf_generator = await get_pdf_generator()
    try:
        pdf_path = await pdf_generator.generate_certificate_pdf(certificate_data)
        
        # Read PDF content
        async with aiofiles.open(pdf_path, 'rb') as f:
            pdf_content = await f.read()
        
        # Email configuration
        smtp_host = settings.get("smtp_host", "smtp.gmail.com")
        smtp_port = int(settings.get("smtp_port", "587"))
        smtp_user = settings.get("smtp_user")
        smtp_password = settings.get("smtp_password")
        from_name = settings.get("smtp_from_name", "ORVITI Academy")
        from_email = settings.get("smtp_from_email", smtp_user)
        org_name = diploma.get("organization_name", "ORVITI Academy")
        
        # Get email template (default or custom)
        email_template = await db.email_templates.find_one(
            {"organization_id": user["organization_id"], "is_default": True},
            {"_id": 0}
        )
        
        # Template variables
        template_vars = {
            "recipient_name": diploma['recipient_name'],
            "course_name": diploma['course_name'],
            "instructor": diploma.get('instructor', 'N/A'),
            "duration_hours": str(diploma.get('duration_hours', 0)),
            "issue_date": formatted_date,
            "certificate_id": diploma['certificate_id'],
            "organization_name": org_name
        }
        
        # Create email
        msg = MIMEMultipart()
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = recipient_email
        
        # Use template subject or default
        if email_template:
            subject = email_template.get("subject", f"Tu diploma de {{{{course_name}}}} - {{{{organization_name}}}}")
            body = email_template.get("html_content", "")
        else:
            subject = f"Tu diploma de {{{{course_name}}}} - {{{{organization_name}}}}"
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                    <h1 style="color: #6366f1; margin-bottom: 10px;">¡Felicidades, {{{{recipient_name}}}}!</h1>
                    <p style="font-size: 16px; color: #333;">Has completado exitosamente el curso:</p>
                    <h2 style="color: #333; margin: 20px 0;">{{{{course_name}}}}</h2>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>ID del Certificado:</strong> {{{{certificate_id}}}}</p>
                        <p style="margin: 5px 0;"><strong>Instructor:</strong> {{{{instructor}}}}</p>
                        <p style="margin: 5px 0;"><strong>Duración:</strong> {{{{duration_hours}}}} horas</p>
                        <p style="margin: 5px 0;"><strong>Fecha de Emisión:</strong> {{{{issue_date}}}}</p>
                    </div>
                    <p style="font-size: 14px; color: #666;">Adjunto encontrarás tu diploma en formato PDF.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">{{{{organization_name}}}}</p>
                </div>
            </body>
            </html>
            """
        
        # Replace template variables
        for key, value in template_vars.items():
            subject = subject.replace(f"{{{{{key}}}}}", value)
            body = body.replace(f"{{{{{key}}}}}", value)
        
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        # Attach PDF
        pdf_attachment = MIMEApplication(pdf_content, _subtype='pdf')
        pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f'certificado_{diploma["certificate_id"]}.pdf')
        msg.attach(pdf_attachment)
        
        # Send email
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()
        
        # Mark diploma as email sent
        await db.diplomas.update_one(
            {"id": diploma_id},
            {"$set": {
                "email_sent": True,
                "email_sent_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": f"Diploma enviado a {recipient_email}", "email_sent": True, "email_sent_at": datetime.now(timezone.utc).isoformat()}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="Error de autenticación SMTP")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al enviar email: {str(e)}")

class BulkEmailRequest(BaseModel):
    diploma_ids: List[str]

@api_router.post("/diplomas/send-bulk-email")
async def send_bulk_diploma_emails(data: BulkEmailRequest, user: dict = Depends(get_current_user)):
    """Send diploma PDFs to multiple recipients via email"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.application import MIMEApplication
    from pdf_generator import get_pdf_generator
    
    # Get settings
    settings = await db.settings.find_one(
        {"organization_id": user["organization_id"]},
        {"_id": 0}
    )
    
    if not settings or not settings.get("email_enabled"):
        raise HTTPException(status_code=400, detail="El envío de emails no está habilitado")
    
    if not settings.get("smtp_user") or not settings.get("smtp_password"):
        raise HTTPException(status_code=400, detail="Configuración SMTP incompleta")
    
    smtp_host = settings.get("smtp_host", "smtp.gmail.com")
    smtp_port = int(settings.get("smtp_port", "587"))
    smtp_user = settings.get("smtp_user")
    smtp_password = settings.get("smtp_password")
    from_name = settings.get("smtp_from_name", "ORVITI Academy")
    from_email = settings.get("smtp_from_email", smtp_user)
    
    # Get email template
    email_template = await db.email_templates.find_one(
        {"organization_id": user["organization_id"], "is_default": True},
        {"_id": 0}
    )
    
    pdf_generator = await get_pdf_generator()
    
    sent_count = 0
    failed_count = 0
    results = []
    
    # Connect to SMTP once for all emails
    try:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="Error de autenticación SMTP")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error conectando al servidor SMTP: {str(e)}")
    
    try:
        for diploma_id in data.diploma_ids:
            try:
                # Get diploma
                diploma = await db.diplomas.find_one(
                    {"id": diploma_id, "organization_id": user["organization_id"]},
                    {"_id": 0}
                )
                if not diploma:
                    results.append({"id": diploma_id, "success": False, "error": "Diploma no encontrado"})
                    failed_count += 1
                    continue
                
                recipient_email = diploma.get("recipient_email")
                if not recipient_email:
                    results.append({"id": diploma_id, "success": False, "error": "Sin email de destinatario"})
                    failed_count += 1
                    continue
                
                # Get template
                template = await db.templates.find_one(
                    {"id": diploma.get("template_id")},
                    {"_id": 0}
                )
                
                # Prepare PDF data
                issue_date = datetime.fromisoformat(diploma["issued_at"].replace("Z", "+00:00"))
                formatted_date = issue_date.strftime("%d de %B, %Y")
                
                certificate_data = {
                    "recipient_name": diploma["recipient_name"],
                    "course_name": diploma["course_name"],
                    "organization_name": diploma.get("organization_name", "ORVITI Academy"),
                    "instructor": diploma.get("instructor", ""),
                    "duration_hours": diploma.get("duration_hours", 0),
                    "issue_date": formatted_date,
                    "certificate_id": diploma["certificate_id"],
                    "qr_code_url": diploma["qr_code_url"]
                }
                
                # If we have a custom template, prepare the fields (simplified for bulk)
                if template and template.get("fields_config"):
                    fields = []
                    for field_config in template["fields_config"]:
                        field = {
                            "x": field_config.get("x", 0),
                            "y": field_config.get("y", 0),
                            "width": field_config.get("width"),
                            "height": field_config.get("height"),
                            "fontFamily": field_config.get("fontFamily", "Urbanist"),
                            "fontSize": field_config.get("fontSize", 24),
                            "fontColor": field_config.get("fontColor", "#000000"),
                            "bold": field_config.get("bold", False),
                            "italic": field_config.get("italic", False),
                            "underline": field_config.get("underline", False),
                            "align": field_config.get("align", "left"),
                            "rotation": field_config.get("rotation", 0),
                            "opacity": field_config.get("opacity", 1),
                            "type": field_config.get("type", "text"),
                        }
                        
                        variable = field_config.get("variable", "")
                        if variable == "recipient_name":
                            field["value"] = diploma["recipient_name"]
                        elif variable == "course_name":
                            field["value"] = diploma["course_name"]
                        elif variable == "completion_date" or variable == "issue_date":
                            field["value"] = formatted_date
                        elif variable == "instructor_name":
                            field["value"] = diploma.get("instructor", "")
                        elif variable == "duration_hours":
                            field["value"] = f"{diploma.get('duration_hours', 0)} horas"
                        elif variable == "certificate_id":
                            field["value"] = diploma["certificate_id"]
                        elif variable == "qr_code" or field_config.get("type") == "qr_code":
                            field["type"] = "qr_code"
                            field["value"] = diploma["qr_code_url"]
                            field["qrSize"] = field_config.get("qrSize", 100)
                            field["width"] = field_config.get("qrSize", 100)
                            field["height"] = field_config.get("qrSize", 100)
                        elif variable == "organization_name":
                            field["value"] = diploma.get("organization_name", "ORVITI Academy")
                        elif field_config.get("text"):
                            field["value"] = field_config["text"]
                        else:
                            field["value"] = ""
                        
                        if field["value"] or field_config.get("type") == "image":
                            fields.append(field)
                    
                    for field_config in template["fields_config"]:
                        if field_config.get("type") == "image":
                            field = {
                                "type": "image",
                                "x": field_config.get("x", 0),
                                "y": field_config.get("y", 0),
                                "imageUrl": field_config.get("imageUrl", ""),
                                "imageWidth": field_config.get("imageWidth", 150),
                                "imageHeight": field_config.get("imageHeight", 150),
                                "rotation": field_config.get("rotation", 0),
                                "opacity": field_config.get("opacity", 1),
                            }
                            fields.append(field)
                    
                    certificate_data["custom_template"] = True
                    certificate_data["fields"] = fields
                    certificate_data["background_image_url"] = template.get("background_image_url", "")
                    certificate_data["canvas_width"] = template.get("canvas_width", 1123)
                    certificate_data["canvas_height"] = template.get("canvas_height", 794)
                
                # Generate PDF
                pdf_path = await pdf_generator.generate_certificate_pdf(certificate_data)
                
                async with aiofiles.open(pdf_path, 'rb') as f:
                    pdf_content = await f.read()
                
                org_name = diploma.get("organization_name", "ORVITI Academy")
                
                # Template variables
                template_vars = {
                    "recipient_name": diploma['recipient_name'],
                    "course_name": diploma['course_name'],
                    "instructor": diploma.get('instructor', 'N/A'),
                    "duration_hours": str(diploma.get('duration_hours', 0)),
                    "issue_date": formatted_date,
                    "certificate_id": diploma['certificate_id'],
                    "organization_name": org_name
                }
                
                # Create email
                msg = MIMEMultipart()
                msg['From'] = f"{from_name} <{from_email}>"
                msg['To'] = recipient_email
                
                # Use template subject and body or defaults
                if email_template:
                    subject = email_template.get("subject", f"Tu diploma de {{{{course_name}}}} - {{{{organization_name}}}}")
                    body = email_template.get("html_content", "")
                else:
                    subject = f"Tu diploma de {{{{course_name}}}} - {{{{organization_name}}}}"
                    body = f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                            <h1 style="color: #6366f1; margin-bottom: 10px;">¡Felicidades, {{{{recipient_name}}}}!</h1>
                            <p style="font-size: 16px; color: #333;">Has completado exitosamente el curso:</p>
                            <h2 style="color: #333; margin: 20px 0;">{{{{course_name}}}}</h2>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>ID del Certificado:</strong> {{{{certificate_id}}}}</p>
                                <p style="margin: 5px 0;"><strong>Instructor:</strong> {{{{instructor}}}}</p>
                                <p style="margin: 5px 0;"><strong>Duración:</strong> {{{{duration_hours}}}} horas</p>
                                <p style="margin: 5px 0;"><strong>Fecha de Emisión:</strong> {{{{issue_date}}}}</p>
                            </div>
                            <p style="font-size: 14px; color: #666;">Adjunto encontrarás tu diploma en formato PDF.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px; text-align: center;">{{{{organization_name}}}}</p>
                        </div>
                    </body>
                    </html>
                    """
                
                # Replace template variables
                for key, value in template_vars.items():
                    subject = subject.replace(f"{{{{{key}}}}}", value)
                    body = body.replace(f"{{{{{key}}}}}", value)
                
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'html'))
                
                # Attach PDF
                pdf_attachment = MIMEApplication(pdf_content, _subtype='pdf')
                pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f'certificado_{diploma["certificate_id"]}.pdf')
                msg.attach(pdf_attachment)
                
                # Send email
                server.send_message(msg)
                
                # Mark diploma as email sent
                await db.diplomas.update_one(
                    {"id": diploma_id},
                    {"$set": {
                        "email_sent": True,
                        "email_sent_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                results.append({"id": diploma_id, "success": True, "recipient": recipient_email})
                sent_count += 1
                
            except Exception as e:
                logger.error(f"Error sending email for diploma {diploma_id}: {str(e)}")
                results.append({"id": diploma_id, "success": False, "error": str(e)})
                failed_count += 1
    finally:
        server.quit()
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "results": results
    }

@api_router.get("/diplomas/{diploma_id}/download-pdf")
async def download_diploma_pdf(diploma_id: str, user: dict = Depends(get_current_user)):
    """Generate and download diploma as PDF using the custom template"""
    from pdf_generator import get_pdf_generator
    
    # Get diploma
    diploma = await db.diplomas.find_one(
        {"id": diploma_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not diploma:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    # Get the template used for this diploma
    template = await db.templates.find_one(
        {"id": diploma.get("template_id")},
        {"_id": 0}
    )
    
    # Prepare data for PDF
    issue_date = datetime.fromisoformat(diploma["issued_at"].replace("Z", "+00:00"))
    formatted_date = issue_date.strftime("%d de %B, %Y")
    
    # Build certificate data
    certificate_data = {
        "recipient_name": diploma["recipient_name"],
        "course_name": diploma["course_name"],
        "organization_name": diploma.get("organization_name", "ORVITI Academy"),
        "instructor": diploma.get("instructor", ""),
        "duration_hours": diploma.get("duration_hours", 0),
        "issue_date": formatted_date,
        "certificate_id": diploma["certificate_id"],
        "qr_code_url": diploma["qr_code_url"]
    }
    
    # If we have a custom template, prepare the fields
    if template and template.get("fields_config"):
        fields = []
        for field_config in template["fields_config"]:
            field = {
                "x": field_config.get("x", 0),
                "y": field_config.get("y", 0),
                "width": field_config.get("width"),
                "height": field_config.get("height"),
                "fontFamily": field_config.get("fontFamily", "Urbanist"),
                "fontSize": field_config.get("fontSize", 24),
                "fontColor": field_config.get("fontColor", "#000000"),
                "bold": field_config.get("bold", False),
                "italic": field_config.get("italic", False),
                "underline": field_config.get("underline", False),
                "align": field_config.get("align", "left"),
                "rotation": field_config.get("rotation", 0),
                "opacity": field_config.get("opacity", 1),
                "type": field_config.get("type", "text"),
            }
            
            # Map variable to actual value
            variable = field_config.get("variable", "")
            if variable == "recipient_name":
                field["value"] = diploma["recipient_name"]
            elif variable == "course_name":
                field["value"] = diploma["course_name"]
            elif variable == "completion_date" or variable == "issue_date":
                field["value"] = formatted_date
            elif variable == "instructor_name":
                field["value"] = diploma.get("instructor", "")
            elif variable == "duration_hours":
                field["value"] = f"{diploma.get('duration_hours', 0)} horas"
            elif variable == "certificate_id":
                field["value"] = diploma["certificate_id"]
            elif variable == "qr_code" or field_config.get("type") == "qr_code":
                field["type"] = "qr_code"
                qr_color = field_config.get("qrColor", "#000000")
                qr_size = field_config.get("qrSize", 100)
                qr_bg_color = field_config.get("qrBgColor", "transparent")
                qr_corner_style = field_config.get("qrCornerStyle", "square")
                qr_dot_style = field_config.get("qrDotStyle", "squares")
                qr_error_level = field_config.get("qrErrorLevel", "M")
                
                # Ensure FRONTEND_URL is a full URL
                frontend_url = os.environ.get('FRONTEND_URL', '').rstrip('/')
                if not frontend_url:
                    frontend_url = "https://orviti.com"
                verification_url = f"{frontend_url}/verify/{diploma['certificate_id']}"

                field["value"] = generate_qr_code(
                    verification_url, 
                    fill_color=qr_color, 
                    back_color=qr_bg_color,
                    corner_style=qr_corner_style,
                    dot_style=qr_dot_style,
                    error_level=qr_error_level,
                    size=qr_size
                )
                field["qrSize"] = qr_size
                field["qrColor"] = qr_color
                field["qrBgColor"] = qr_bg_color
                field["qrCornerStyle"] = qr_corner_style
                field["width"] = qr_size
                field["height"] = qr_size
            elif variable == "organization_name":
                field["value"] = diploma.get("organization_name", "ORVITI Academy")
            elif field_config.get("text"):
                field["value"] = field_config["text"]
            else:
                field["value"] = ""
            
            # Add field if it has content (text/qr) or is an image
            if field["value"] or field_config.get("type") == "image":
                fields.append(field)
        
        certificate_data["custom_template"] = True
        certificate_data["fields"] = fields
        certificate_data["background_image_url"] = template.get("background_image_url", "")
        certificate_data["canvas_width"] = template.get("canvas_width", 1123)
        certificate_data["canvas_height"] = template.get("canvas_height", 794)
    
    # Generate PDF
    try:
        logger.info(f"Generating PDF for diploma {diploma_id} with certificate_id {diploma['certificate_id']}")
        pdf_generator = await get_pdf_generator()
        pdf_path = await pdf_generator.generate_certificate_pdf(certificate_data)
        
        logger.info(f"PDF generated at: {pdf_path}")
        
        # Return PDF file
        return FileResponse(
            path=str(pdf_path),
            filename=f"certificado_{diploma['certificate_id']}.pdf",
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="certificado_{diploma["certificate_id"]}.pdf"'
            }
        )
    except Exception as e:
        logger.error(f"CRITICAL ERROR in download_diploma_pdf: {str(e)}", exc_info=True)
        import traceback
        error_details = traceback.format_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Error generating PDF: {str(e)}. Check server logs for details."
        )
    except Exception as e:
        logger.error(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")

@api_router.get("/debug/playwright")
async def debug_playwright(user: dict = Depends(get_current_user)):
    """Debug endpoint to test if Playwright can launch in this environment"""
    from pdf_generator import get_pdf_generator
    try:
        logger.info("DEBUG: Attempting to launch Playwright...")
        pdf_gen = await get_pdf_generator()
        browser = await pdf_gen._get_browser()
        version = browser.version
        
        # Try a simple page load
        page = await browser.new_page()
        await page.set_content("<h1>Playwright is working</h1>")
        await page.close()
        
        return {
            "status": "success",
            "message": "Playwright launched successfully",
            "browser_version": version,
            "pw_browsers_path": os.environ.get('PLAYWRIGHT_BROWSERS_PATH', 'not set')
        }
    except Exception as e:
        import traceback
        logger.error(f"DEBUG Playwright failed: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc(),
            "pw_browsers_path": os.environ.get('PLAYWRIGHT_BROWSERS_PATH', 'not set')
        }


@api_router.get("/debug/qr")
async def debug_qr_generation():
    """Test QR code generation"""
    import time
    start = time.time()
    result = generate_qr_code("https://orviti.com/verify/TEST-CERT-123")
    elapsed = time.time() - start
    if result:
        return {
            "status": "success",
            "data_url_length": len(result),
            "data_url_prefix": result[:50],
            "elapsed_seconds": elapsed
        }
    else:
        return {
            "status": "error",
            "message": "generate_qr_code returned empty string",
            "elapsed_seconds": elapsed
        }

@api_router.get("/diplomas/{diploma_id}/debug-html")
async def debug_diploma_html(diploma_id: str, user: dict = Depends(get_current_user)):
    """Return the raw HTML that would be sent to Playwright for a diploma.
    Useful for debugging rendering issues."""
    from jinja2 import Environment, FileSystemLoader
    from pathlib import Path
    import json

    diploma = await db.diplomas.find_one(
        {"id": diploma_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not diploma:
        raise HTTPException(status_code=404, detail="Diploma not found")

    template_doc = await db.templates.find_one(
        {"id": diploma.get("template_id")},
        {"_id": 0}
    )

    issue_date = datetime.fromisoformat(diploma["issued_at"].replace("Z", "+00:00"))
    formatted_date = issue_date.strftime("%d de %B, %Y")

    certificate_data = {
        "recipient_name": diploma["recipient_name"],
        "course_name": diploma["course_name"],
        "organization_name": diploma.get("organization_name", "ORVITI Academy"),
        "instructor": diploma.get("instructor", ""),
        "duration_hours": diploma.get("duration_hours", 0),
        "issue_date": formatted_date,
        "certificate_id": diploma["certificate_id"],
        "qr_code_url": diploma.get("qr_code_url", ""),
    }

    fields_summary = []
    if template_doc and template_doc.get("fields_config"):
        fields = []
        for field_config in template_doc.get("fields_config", []):
            variable = field_config.get("variable", "")
            field_type = field_config.get("type", "text")
            field = {
                "x": field_config.get("x", 0),
                "y": field_config.get("y", 0),
                "width": field_config.get("width"),
                "height": field_config.get("height"),
                "fontFamily": field_config.get("fontFamily", "Urbanist"),
                "fontSize": field_config.get("fontSize", 24),
                "fontColor": field_config.get("fontColor", "#000000"),
                "bold": field_config.get("bold", False),
                "italic": field_config.get("italic", False),
                "underline": field_config.get("underline", False),
                "align": field_config.get("align", "left"),
                "rotation": field_config.get("rotation", 0),
                "opacity": field_config.get("opacity", 1),
                "type": field_type,
            }

            if field_type == "image":
                field["type"] = "image"
                field["imageUrl"] = field_config.get("imageUrl", "")
                field["imageWidth"] = field_config.get("imageWidth", field_config.get("width", 150))
                field["imageHeight"] = field_config.get("imageHeight", field_config.get("height", 150))
                field["value"] = "[image]"
            elif variable == "qr_code" or field_type == "qr_code":
                field["type"] = "qr_code"
                frontend_url = os.environ.get('FRONTEND_URL', '').rstrip('/')
                if not frontend_url:
                    frontend_url = "https://orviti.com"
                verification_url = f"{frontend_url}/verify/{diploma['certificate_id']}"
                qr_value = generate_qr_code(verification_url)
                field["value"] = qr_value
                field["qrSize"] = field_config.get("qrSize", 100)
                field["width"] = field["qrSize"]
                field["height"] = field["qrSize"]
            elif variable == "recipient_name":
                field["value"] = diploma["recipient_name"]
            elif variable == "course_name":
                field["value"] = diploma["course_name"]
            elif variable in ("completion_date", "issue_date"):
                field["value"] = formatted_date
            elif variable == "instructor_name":
                field["value"] = diploma.get("instructor", "")
            elif variable == "duration_hours":
                field["value"] = f"{diploma.get('duration_hours', 0)} horas"
            elif variable == "certificate_id":
                field["value"] = diploma["certificate_id"]
            elif variable == "organization_name":
                field["value"] = diploma.get("organization_name", "ORVITI Academy")
            elif field_config.get("text"):
                field["value"] = field_config["text"]
            else:
                field["value"] = ""

            fields_summary.append({
                "variable": variable,
                "type": field.get("type"),
                "has_value": bool(field.get("value")),
                "value_length": len(field.get("value", "")) if field.get("value") else 0,
                "value_preview": str(field.get("value", ""))[:80],
            })

            if field.get("value"):
                fields.append(field)

        certificate_data["custom_template"] = True
        certificate_data["fields"] = fields
        certificate_data["background_image_url"] = template_doc.get("background_image_url", "")
        certificate_data["canvas_width"] = template_doc.get("canvas_width", 1123)
        certificate_data["canvas_height"] = template_doc.get("canvas_height", 794)

    # Return summary instead of full HTML (too large for JSON)
    return {
        "diploma_id": diploma_id,
        "template_found": template_doc is not None,
        "template_id": diploma.get("template_id"),
        "fields_in_template": len(template_doc.get("fields_config", [])) if template_doc else 0,
        "fields_processed": len(fields_summary),
        "fields_summary": fields_summary,
        "uses_custom_template": certificate_data.get("custom_template", False),
    }

@api_router.get("/diplomas/by-certificate/{certificate_id}/download-pdf")
async def download_diploma_pdf_public(certificate_id: str):
    """Generate and download diploma as PDF (public endpoint for verification page)"""
    from pdf_generator import get_pdf_generator
    
    # Get diploma by certificate_id
    diploma = await db.diplomas.find_one(
        {"certificate_id": certificate_id},
        {"_id": 0}
    )
    if not diploma:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    # Get the template used for this diploma
    template = await db.templates.find_one(
        {"id": diploma.get("template_id")},
        {"_id": 0}
    )
    
    # Prepare data for PDF
    issue_date = datetime.fromisoformat(diploma["issued_at"].replace("Z", "+00:00"))
    formatted_date = issue_date.strftime("%d de %B, %Y")
    
    certificate_data = {
        "recipient_name": diploma["recipient_name"],
        "course_name": diploma["course_name"],
        "organization_name": diploma.get("organization_name", "ORVITI Academy"),
        "instructor": diploma.get("instructor", ""),
        "duration_hours": diploma.get("duration_hours", 0),
        "issue_date": formatted_date,
        "certificate_id": diploma["certificate_id"],
        "qr_code_url": diploma["qr_code_url"]
    }
    
    # If we have a custom template, prepare the fields
    if template and template.get("fields_config"):
        fields = []
        for field_config in template["fields_config"]:
            field = {
                "x": field_config.get("x", 0),
                "y": field_config.get("y", 0),
                "width": field_config.get("width"),
                "height": field_config.get("height"),
                "fontFamily": field_config.get("fontFamily", "Urbanist"),
                "fontSize": field_config.get("fontSize", 24),
                "fontColor": field_config.get("fontColor", "#000000"),
                "bold": field_config.get("bold", False),
                "italic": field_config.get("italic", False),
                "underline": field_config.get("underline", False),
                "align": field_config.get("align", "left"),
                "rotation": field_config.get("rotation", 0),
                "opacity": field_config.get("opacity", 1),
                "type": field_config.get("type", "text"),
            }
            
            # Map variable to actual value
            variable = field_config.get("variable", "")
            if variable == "recipient_name":
                field["value"] = diploma["recipient_name"]
            elif variable == "course_name":
                field["value"] = diploma["course_name"]
            elif variable == "completion_date" or variable == "issue_date":
                field["value"] = formatted_date
            elif variable == "instructor_name":
                field["value"] = diploma.get("instructor", "")
            elif variable == "duration_hours":
                field["value"] = f"{diploma.get('duration_hours', 0)} horas"
            elif variable == "certificate_id":
                field["value"] = diploma["certificate_id"]
            elif variable == "qr_code" or field_config.get("type") == "qr_code":
                field["type"] = "qr_code"
                qr_color = field_config.get("qrColor", "#000000")
                qr_size = field_config.get("qrSize", 100)
                qr_bg_color = field_config.get("qrBgColor", "transparent")
                qr_corner_style = field_config.get("qrCornerStyle", "square")
                qr_dot_style = field_config.get("qrDotStyle", "squares")
                qr_error_level = field_config.get("qrErrorLevel", "M")
                
                # Ensure FRONTEND_URL is a full URL
                frontend_url = os.environ.get('FRONTEND_URL', '').rstrip('/')
                if not frontend_url:
                    frontend_url = "https://orviti.com"
                verification_url = f"{frontend_url}/verify/{diploma['certificate_id']}"

                field["value"] = generate_qr_code(
                    verification_url, 
                    fill_color=qr_color, 
                    back_color=qr_bg_color,
                    corner_style=qr_corner_style,
                    dot_style=qr_dot_style,
                    error_level=qr_error_level,
                    size=qr_size
                )
                field["qrSize"] = qr_size
                field["qrColor"] = qr_color
                field["qrBgColor"] = qr_bg_color
                field["qrCornerStyle"] = qr_corner_style
                field["width"] = qr_size
                field["height"] = qr_size
            elif variable == "organization_name":
                field["value"] = diploma.get("organization_name", "ORVITI Academy")
            elif field_config.get("text"):
                field["value"] = field_config["text"]
            else:
                field["value"] = ""
            
            # Add field if it has content (text/qr) or is an image
            if field["value"] or field_config.get("type") == "image":
                fields.append(field)
        
        certificate_data["custom_template"] = True
        certificate_data["fields"] = fields
        certificate_data["background_image_url"] = template.get("background_image_url", "")
        certificate_data["canvas_width"] = template.get("canvas_width", 1123)
        certificate_data["canvas_height"] = template.get("canvas_height", 794)
    
    # Generate PDF
    pdf_generator = await get_pdf_generator()
    try:
        pdf_path = await pdf_generator.generate_certificate_pdf(certificate_data)
        
        # Return PDF file
        return FileResponse(
            path=str(pdf_path),
            filename=f"certificado_{diploma['certificate_id']}.pdf",
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="certificado_{diploma["certificate_id"]}.pdf"'
            }
        )
    except Exception as e:
        logger.error(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")

@api_router.get("/courses/{course_id}/download-all-diplomas")
async def download_all_course_diplomas_zip(course_id: str, user: dict = Depends(get_current_user)):
    """Download all diplomas from a course as a ZIP file"""
    from pdf_generator import get_pdf_generator
    
    # Verify course exists and belongs to user's organization
    course = await db.courses.find_one(
        {"id": course_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Get all diplomas for this course
    diplomas = await db.diplomas.find(
        {"course_id": course_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    ).to_list(length=1000)
    
    if not diplomas:
        raise HTTPException(status_code=404, detail="No diplomas found for this course")
    
    # Create temporary ZIP file
    pdf_generator = await get_pdf_generator()
    
    # Create a temp file for the ZIP
    with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_zip:
        zip_path = tmp_zip.name
    
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for diploma in diplomas:
                try:
                    # Prepare PDF data
                    issue_date = datetime.fromisoformat(diploma["issued_at"].replace("Z", "+00:00"))
                    formatted_date = issue_date.strftime("%d de %B, %Y")
                    
                    certificate_data = {
                        "recipient_name": diploma["recipient_name"],
                        "course_name": diploma["course_name"],
                        "organization_name": diploma.get("organization_name", "ORVITI Academy"),
                        "instructor": diploma.get("instructor", ""),
                        "duration_hours": diploma.get("duration_hours", 0),
                        "issue_date": formatted_date,
                        "certificate_id": diploma["certificate_id"],
                        "qr_code_url": diploma["qr_code_url"]
                    }
                    
                    # Generate PDF
                    pdf_path = await pdf_generator.generate_certificate_pdf(certificate_data)
                    
                    # Add to ZIP with a clean filename
                    recipient_name = diploma["recipient_name"].replace(" ", "_").replace("/", "-")
                    zip_filename = f"{recipient_name}_{diploma['certificate_id']}.pdf"
                    zipf.write(str(pdf_path), zip_filename)
                    
                except Exception as e:
                    logger.error(f"Error generating PDF for {diploma['certificate_id']}: {str(e)}")
                    continue
        
        # Return ZIP file
        course_name = course["name"].replace(" ", "_").replace("/", "-")
        return FileResponse(
            path=zip_path,
            filename=f"diplomas_{course_name}.zip",
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="diplomas_{course_name}.zip"'
            },
            background=None  # Don't delete file until response is complete
        )
        
    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(zip_path):
            os.unlink(zip_path)
        logger.error(f"ZIP generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating ZIP: {str(e)}")

# ==================== PUBLIC VERIFICATION ====================

@api_router.get("/verify/{certificate_id}", response_model=VerificationResponse)
async def verify_diploma(certificate_id: str, request_ip: str = None, user_agent: str = None):
    diploma = await db.diplomas.find_one(
        {"certificate_id": certificate_id},
        {"_id": 0}
    )
    
    if not diploma:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    # Log the scan
    scan_log = {
        "id": str(uuid.uuid4()),
        "diploma_id": diploma["id"],
        "certificate_id": certificate_id,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "ip_address": request_ip or "unknown",
        "user_agent": user_agent or "unknown"
    }
    await db.scan_logs.insert_one(scan_log)
    
    # Get template for preview URL
    template = await db.templates.find_one(
        {"id": diploma["template_id"]},
        {"_id": 0}
    )
    
    return VerificationResponse(
        certificate_id=diploma["certificate_id"],
        recipient_name=diploma["recipient_name"],
        course_name=diploma["course_name"],
        instructor=diploma.get("instructor", ""),
        duration_hours=diploma.get("duration_hours", 0),
        organization_name=diploma.get("organization_name", "ORVITI Academy"),
        status=diploma["status"],
        issued_at=diploma["issued_at"],
        diploma_preview_url=template["background_image_url"] if template else None
    )

@api_router.get("/diplomas/{diploma_id}/data")
async def get_diploma_data(diploma_id: str):
    """Get full diploma data for rendering (public endpoint for verification page)"""
    diploma = await db.diplomas.find_one({"id": diploma_id}, {"_id": 0})
    if not diploma:
        raise HTTPException(status_code=404, detail="Diploma not found")
    
    template = await db.templates.find_one({"id": diploma["template_id"]}, {"_id": 0})
    
    return {
        "diploma": diploma,
        "template": template
    }

# ==================== DASHBOARD ====================

@api_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(user: dict = Depends(get_current_user)):
    
    org_id = user["organization_id"]
    
    # Get counts
    total_diplomas = await db.diplomas.count_documents({"organization_id": org_id})
    valid_diplomas = await db.diplomas.count_documents({"organization_id": org_id, "status": "valid"})
    revoked_diplomas = await db.diplomas.count_documents({"organization_id": org_id, "status": "revoked"})
    total_courses = await db.courses.count_documents({"organization_id": org_id})
    total_recipients = await db.recipients.count_documents({"organization_id": org_id})
    total_templates = await db.templates.count_documents({"organization_id": org_id})
    
    # Get recent activity (recent diplomas)
    recent = await db.diplomas.find(
        {"organization_id": org_id},
        {"_id": 0}
    ).sort("issued_at", -1).limit(5).to_list(5)
    
    return DashboardStats(
        total_diplomas=total_diplomas,
        valid_diplomas=valid_diplomas,
        revoked_diplomas=revoked_diplomas,
        total_courses=total_courses,
        total_recipients=total_recipients,
        total_templates=total_templates,
        recent_activity=recent
    )

@api_router.get("/scan-logs")
async def get_scan_logs(diploma_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    
    
    if diploma_id:
        # Verify diploma belongs to user's org
        diploma = await db.diplomas.find_one(
            {"id": diploma_id, "organization_id": user["organization_id"]}
        )
        if not diploma:
            raise HTTPException(status_code=404, detail="Diploma not found")
        
        logs = await db.scan_logs.find(
            {"diploma_id": diploma_id},
            {"_id": 0}
        ).sort("scanned_at", -1).to_list(100)
    else:
        # Get all scan logs for org's diplomas
        diploma_ids = await db.diplomas.distinct("id", {"organization_id": user["organization_id"]})
        logs = await db.scan_logs.find(
            {"diploma_id": {"$in": diploma_ids}},
            {"_id": 0}
        ).sort("scanned_at", -1).to_list(100)
    
    return logs


@api_router.delete("/scan-logs/clear")
async def clear_scan_logs(user: dict = Depends(get_current_user)):
    """Clear all scan logs for the organization's diplomas"""
    # Get all diploma IDs for this organization
    diploma_ids = await db.diplomas.distinct("id", {"organization_id": user["organization_id"]})
    
    # Delete all scan logs for those diplomas
    result = await db.scan_logs.delete_many({"diploma_id": {"$in": diploma_ids}})
    
    return {"message": f"Cleared {result.deleted_count} scan logs"}


# ==================== FILE UPLOADS ====================

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Upload a file to S3 (if configured) or local storage."""
    ext = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{ext}"
    content = await file.read()

    s3 = get_s3_client()
    if s3 and S3_BUCKET:
        # ── S3 path ──
        try:
            content_type_map = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.gif': 'image/gif', '.webp': 'image/webp',
                '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
            }
            content_type = content_type_map.get(ext, 'application/octet-stream')
            key = f"uploads/{filename}"
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=content,
                ContentType=content_type,
                # ACL only needed for public AWS S3 (not Cloudflare R2)
                **({'ACL': 'public-read'} if not S3_ENDPOINT_URL else {}),
            )
            url = s3_proxy_url(key)
            logger.info(f"File uploaded to S3: {key}")
            return {"url": url, "filename": filename, "storage": "s3"}
        except Exception as e:
            logger.error(f"S3 upload failed, falling back to local: {e}")
            # Fall through to local storage

    # ── Local fallback ──
    filepath = UPLOADS_DIR / filename
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    logger.info(f"File saved locally: {filename}")
    return {"url": f"/api/uploads/{filename}", "filename": filename, "storage": "local"}

# Serve locally-stored files (used when S3 is not configured or as fallback)
@api_router.get("/uploads/{filename}")
async def get_upload(filename: str):
    filepath = UPLOADS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = None
    if filename.lower().endswith('.svg'):
        media_type = 'image/svg+xml'
    return FileResponse(filepath, media_type=media_type)

# ── MinIO/S3 Proxy ──────────────────────────────────────────────────────────
# Serves private S3/MinIO files through the backend using its credentials.
# The browser only talks to this endpoint — MinIO stays private.
@api_router.get("/media/{key:path}")
async def proxy_s3_media(key: str):
    """Proxy a private S3/MinIO object to the browser."""
    s3 = get_s3_client()
    if not s3:
        raise HTTPException(status_code=404, detail="S3 not configured")
    try:
        response = s3.get_object(Bucket=S3_BUCKET, Key=key)
        content_type = response.get('ContentType', 'application/octet-stream')
        body = response['Body']

        def iter_content():
            while True:
                chunk = body.read(65536)  # 64KB chunks
                if not chunk:
                    break
                yield chunk

        from fastapi.responses import StreamingResponse as SR
        return SR(
            iter_content(),
            media_type=content_type,
            headers={
                'Cache-Control': 'public, max-age=31536000',  # cache 1 year
                'Content-Length': str(response.get('ContentLength', '')),
            }
        )
    except s3.exceptions.NoSuchKey:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.error(f"S3 proxy error for key={key}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve file")

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_database():
    """Seed the database with sample data"""
    
    # Check if already seeded
    existing_org = await db.organizations.find_one({"name": "SETY"})
    if existing_org:
        return {"message": "Database already seeded"}
    
    # Create organization
    org_id = str(uuid.uuid4())
    org = {
        "id": org_id,
        "name": "SETY",
        "logo_url": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org)
    
    # Create admin user (password: admin123)
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "organization_id": org_id,
        "email": "admin@sety.com",
        "password_hash": hash_password("admin123"),
        "name": "Admin User",
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    # Create courses
    courses_data = [
        {"name": "IA para Negocios", "description": "Curso completo de inteligencia artificial aplicada a los negocios", "instructor": "Dr. Carlos Martinez", "duration_hours": 40},
        {"name": "Excel Avanzado", "description": "Domina Excel con fórmulas avanzadas, macros y análisis de datos", "instructor": "María García", "duration_hours": 20}
    ]
    
    course_ids = []
    for course_data in courses_data:
        course_id = str(uuid.uuid4())
        course = {
            "id": course_id,
            "organization_id": org_id,
            **course_data,
            "start_date": "2024-01-15",
            "end_date": "2024-03-15",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.courses.insert_one(course)
        course_ids.append(course_id)
    
    # Create recipients for each course
    sample_names = [
        ("Juan Pérez", "juan.perez@email.com"),
        ("Ana López", "ana.lopez@email.com"),
        ("Carlos Rodríguez", "carlos.rodriguez@email.com"),
        ("María Fernández", "maria.fernandez@email.com"),
        ("Pedro Sánchez", "pedro.sanchez@email.com")
    ]
    
    for course_id in course_ids:
        for name, email in sample_names:
            recipient = {
                "id": str(uuid.uuid4()),
                "organization_id": org_id,
                "course_id": course_id,
                "full_name": name,
                "email": email,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.recipients.insert_one(recipient)
    
    # Create a sample template
    template_id = str(uuid.uuid4())
    template = {
        "id": template_id,
        "organization_id": org_id,
        "name": "Classic Certificate",
        "background_image_url": "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&h=800&fit=crop",
        "fields_config": [
            {"id": "1", "type": "variable", "variable": "recipient_name", "x": 400, "y": 280, "fontFamily": "Libre Baskerville", "fontSize": 36, "fontColor": "#0f172a", "bold": True, "italic": False, "underline": False, "align": "center", "rotation": 0, "opacity": 1},
            {"id": "2", "type": "variable", "variable": "course_name", "x": 400, "y": 350, "fontFamily": "Libre Baskerville", "fontSize": 24, "fontColor": "#0f172a", "bold": False, "italic": True, "underline": False, "align": "center", "rotation": 0, "opacity": 1},
            {"id": "3", "type": "variable", "variable": "completion_date", "x": 400, "y": 420, "fontFamily": "Manrope", "fontSize": 16, "fontColor": "#64748b", "bold": False, "italic": False, "underline": False, "align": "center", "rotation": 0, "opacity": 1},
            {"id": "4", "type": "variable", "variable": "qr_code", "x": 700, "y": 500, "fontFamily": "Manrope", "fontSize": 16, "fontColor": "#0f172a", "bold": False, "italic": False, "underline": False, "align": "center", "rotation": 0, "opacity": 1, "width": 80, "height": 80}
        ],
        "thumbnail_url": None,
        "canvas_width": 1123,
        "canvas_height": 794,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.templates.insert_one(template)
    
    return {
        "message": "Database seeded successfully",
        "credentials": {
            "email": "admin@sety.com",
            "password": "admin123"
        }
    }

# ==================== USERS MANAGEMENT ====================

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    name: Optional[str] = None

@api_router.get("/users")
async def get_users(user: dict = Depends(get_current_user)):
    """Get all users in the organization"""
    users = await db.users.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    # Mark the first user (base admin) - lowest created_at
    if users:
        users_sorted = sorted(users, key=lambda x: x.get("created_at", ""))
        if users_sorted:
            first_user_id = users_sorted[0]["id"]
            for u in users:
                u["is_base_admin"] = u["id"] == first_user_id
    
    return users

@api_router.post("/users")
async def create_user(data: UserCreate, user: dict = Depends(get_current_user)):
    """Create a new user in the organization (admin only)"""
    # Check if email already exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    new_user = {
        "id": user_id,
        "organization_id": user["organization_id"],
        "email": data.email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    
    return {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "role": "admin",
        "organization_id": user["organization_id"]
    }

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, user: dict = Depends(get_current_user)):
    """Update a user (can only edit self for base admin protection)"""
    # Get the target user
    target_user = await db.users.find_one(
        {"id": user_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if target is the base admin (first user)
    all_users = await db.users.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0, "id": 1, "created_at": 1}
    ).to_list(100)
    
    if all_users:
        sorted_users = sorted(all_users, key=lambda x: x.get("created_at", ""))
        base_admin_id = sorted_users[0]["id"] if sorted_users else None
        
        # Only the base admin can edit themselves
        if target_user["id"] == base_admin_id and user["id"] != base_admin_id:
            raise HTTPException(status_code=403, detail="Cannot modify base admin")
    
    # Build update data
    update_data = {}
    if data.email is not None:
        # Check if email is taken by another user
        existing = await db.users.find_one({"email": data.email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_data["email"] = data.email
    if data.password is not None:
        update_data["password_hash"] = hash_password(data.password)
    if data.name is not None:
        update_data["name"] = data.name
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    return {"message": "User updated"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    """Delete a user (cannot delete self or base admin)"""
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Get the target user
    target_user = await db.users.find_one(
        {"id": user_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if target is the base admin
    all_users = await db.users.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0, "id": 1, "created_at": 1}
    ).to_list(100)
    
    if all_users:
        sorted_users = sorted(all_users, key=lambda x: x.get("created_at", ""))
        base_admin_id = sorted_users[0]["id"] if sorted_users else None
        
        if target_user["id"] == base_admin_id:
            raise HTTPException(status_code=403, detail="Cannot delete base admin")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted"}

# ==================== SETTINGS/CONFIGURATION ====================

class SettingsUpdate(BaseModel):
    login_logo_url: Optional[str] = None
    sidebar_logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    site_title: Optional[str] = None
    site_description: Optional[str] = None
    # Email settings
    email_enabled: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_name: Optional[str] = None
    smtp_from_email: Optional[str] = None

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    """Get organization settings"""
    settings = await db.settings.find_one(
        {"organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not settings:
        # Return defaults
        return {
            "organization_id": user["organization_id"],
            "login_logo_url": None,
            "sidebar_logo_url": None,
            "favicon_url": None,
            "site_title": "ORVITI Academy",
            "site_description": "Sistema de Gestión de Diplomas Digitales",
            "email_enabled": False,
            "smtp_host": "smtp.gmail.com",
            "smtp_port": "587",
            "smtp_user": "",
            "smtp_password": "",
            "smtp_from_name": "",
            "smtp_from_email": ""
        }
    return settings

@api_router.put("/settings")
async def update_settings(data: SettingsUpdate, user: dict = Depends(get_current_user)):
    """Update organization settings"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["organization_id"] = user["organization_id"]
    
    await db.settings.update_one(
        {"organization_id": user["organization_id"]},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Settings updated"}

@api_router.post("/settings/test-email")
async def test_email_connection(user: dict = Depends(get_current_user)):
    """Test SMTP email connection by sending a test email"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    # Get settings
    settings = await db.settings.find_one(
        {"organization_id": user["organization_id"]},
        {"_id": 0}
    )
    
    if not settings or not settings.get("smtp_user") or not settings.get("smtp_password"):
        raise HTTPException(status_code=400, detail="Configuración SMTP incompleta")
    
    smtp_host = settings.get("smtp_host", "smtp.gmail.com")
    smtp_port = int(settings.get("smtp_port", "587"))
    smtp_user = settings.get("smtp_user")
    smtp_password = settings.get("smtp_password")
    from_name = settings.get("smtp_from_name", "ORVITI Academy")
    from_email = settings.get("smtp_from_email", smtp_user)
    
    try:
        # Create test message
        msg = MIMEMultipart()
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = smtp_user
        msg['Subject'] = "Prueba de conexión SMTP - ORVITI Academy"
        
        body = """
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #6366f1;">¡Conexión SMTP exitosa!</h2>
            <p>Este es un correo de prueba desde ORVITI Academy.</p>
            <p>Tu configuración de correo electrónico está funcionando correctamente.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">ORVITI Academy - Sistema de Gestión de Diplomas Digitales</p>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, 'html'))
        
        # Connect and send
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()
        
        return {"message": "Email de prueba enviado correctamente"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="Error de autenticación SMTP. Verifica tus credenciales.")
    except smtplib.SMTPConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar al servidor SMTP")
    except Exception as e:
        logger.error(f"SMTP test error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error al enviar: {str(e)}")

@api_router.get("/settings/public")
async def get_public_settings():
    """Get public settings (for login page without auth)"""
    # Get the first organization's settings (for single-tenant setup)
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "login_logo_url": None,
            "sidebar_logo_url": None,
            "favicon_url": None,
            "site_title": "ORVITI Academy",
            "site_description": "Sistema de Gestión de Diplomas Digitales"
        }
    return settings

# ==================== EMAIL TEMPLATES ====================

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    html_content: str
    is_default: bool = False

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    is_default: Optional[bool] = None

class EmailTemplateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    subject: str
    html_content: str
    is_default: bool
    created_at: str
    updated_at: str

# Default email template HTML
DEFAULT_EMAIL_TEMPLATE = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; margin: 0 auto;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0;">
                    <tr>
                        <td style="padding: 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">¡Felicidades!</h1>
                        </td>
                    </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px;">Hola {{recipient_name}},</h2>
                            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Has completado exitosamente el curso:
                            </p>
                            <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                                <h3 style="color: #6366f1; margin: 0 0 10px 0; font-size: 20px;">{{course_name}}</h3>
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 5px 0;">
                                            <span style="color: #6b7280; font-size: 14px;">Instructor:</span>
                                            <span style="color: #1f2937; font-size: 14px; font-weight: 600;">{{instructor}}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 5px 0;">
                                            <span style="color: #6b7280; font-size: 14px;">Duración:</span>
                                            <span style="color: #1f2937; font-size: 14px; font-weight: 600;">{{duration_hours}} horas</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 5px 0;">
                                            <span style="color: #6b7280; font-size: 14px;">Fecha de emisión:</span>
                                            <span style="color: #1f2937; font-size: 14px; font-weight: 600;">{{issue_date}}</span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            <div style="background-color: #faf5ff; border-left: 4px solid #6366f1; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
                                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                    <strong style="color: #6366f1;">ID del Certificado:</strong><br>
                                    <code style="background-color: #e0e7ff; padding: 4px 8px; border-radius: 4px; font-size: 14px; color: #4f46e5;">{{certificate_id}}</code>
                                </p>
                            </div>
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                                Adjunto encontrarás tu diploma en formato PDF. También puedes verificar la autenticidad de tu certificado escaneando el código QR incluido en el documento.
                            </p>
                        </td>
                    </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 20px; text-align: center;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                {{organization_name}}<br>
                                Este es un correo automático, por favor no responda a este mensaje.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'''

@api_router.get("/email-templates", response_model=List[EmailTemplateResponse])
async def get_email_templates(user: dict = Depends(get_current_user)):
    """Get all email templates for the organization"""
    templates = await db.email_templates.find(
        {"organization_id": user["organization_id"]},
        {"_id": 0}
    ).to_list(100)
    
    # If no templates exist, create a default one
    if not templates:
        default_template = {
            "id": str(uuid.uuid4()),
            "organization_id": user["organization_id"],
            "name": "Plantilla por Defecto",
            "subject": "Tu diploma de {{course_name}} - {{organization_name}}",
            "html_content": DEFAULT_EMAIL_TEMPLATE,
            "is_default": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.email_templates.insert_one(default_template)
        templates = [default_template]
    
    return [{k: v for k, v in t.items() if k != "_id"} for t in templates]

@api_router.get("/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def get_email_template(template_id: str, user: dict = Depends(get_current_user)):
    """Get a specific email template"""
    template = await db.email_templates.find_one(
        {"id": template_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@api_router.post("/email-templates", response_model=EmailTemplateResponse)
async def create_email_template(data: EmailTemplateCreate, user: dict = Depends(get_current_user)):
    """Create a new email template"""
    template = {
        "id": str(uuid.uuid4()),
        "organization_id": user["organization_id"],
        "name": data.name,
        "subject": data.subject,
        "html_content": data.html_content,
        "is_default": data.is_default,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If this is set as default, unset other defaults
    if data.is_default:
        await db.email_templates.update_many(
            {"organization_id": user["organization_id"]},
            {"$set": {"is_default": False}}
        )
    
    await db.email_templates.insert_one(template)
    return {k: v for k, v in template.items() if k != "_id"}

@api_router.put("/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def update_email_template(template_id: str, data: EmailTemplateUpdate, user: dict = Depends(get_current_user)):
    """Update an email template"""
    template = await db.email_templates.find_one(
        {"id": template_id, "organization_id": user["organization_id"]}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If this is set as default, unset other defaults
    if data.is_default:
        await db.email_templates.update_many(
            {"organization_id": user["organization_id"], "id": {"$ne": template_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.email_templates.update_one(
        {"id": template_id},
        {"$set": update_data}
    )
    
    updated = await db.email_templates.find_one({"id": template_id}, {"_id": 0})
    return updated

@api_router.delete("/email-templates/{template_id}")
async def delete_email_template(template_id: str, user: dict = Depends(get_current_user)):
    """Delete an email template"""
    template = await db.email_templates.find_one(
        {"id": template_id, "organization_id": user["organization_id"]}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Don't allow deleting the default template if it's the only one
    count = await db.email_templates.count_documents({"organization_id": user["organization_id"]})
    if template.get("is_default") and count <= 1:
        raise HTTPException(status_code=400, detail="No puedes eliminar la única plantilla por defecto")
    
    await db.email_templates.delete_one({"id": template_id})
    return {"message": "Template deleted"}

@api_router.post("/email-templates/{template_id}/duplicate", response_model=EmailTemplateResponse)
async def duplicate_email_template(template_id: str, user: dict = Depends(get_current_user)):
    """Duplicate an email template"""
    template = await db.email_templates.find_one(
        {"id": template_id, "organization_id": user["organization_id"]},
        {"_id": 0}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    new_template = {
        "id": str(uuid.uuid4()),
        "organization_id": user["organization_id"],
        "name": f"{template['name']} (copia)",
        "subject": template["subject"],
        "html_content": template["html_content"],
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_templates.insert_one(new_template)
    return {k: v for k, v in new_template.items() if k != "_id"}

@api_router.post("/email-templates/preview")
async def preview_email_template(data: dict, user: dict = Depends(get_current_user)):
    """Generate a preview of the email template with sample data"""
    html_content = data.get("html_content", "")
    
    # Sample data for preview
    sample_data = {
        "recipient_name": "Juan Pérez",
        "course_name": "Curso de Ejemplo",
        "instructor": "Dr. María González",
        "duration_hours": "40",
        "issue_date": datetime.now().strftime("%d de %B, %Y"),
        "certificate_id": "CERT-XXXXX-XXXX",
        "organization_name": "ORVITI Academy"
    }
    
    # Replace variables
    preview_html = html_content
    for key, value in sample_data.items():
        preview_html = preview_html.replace(f"{{{{{key}}}}}", str(value))
    
    return {"preview_html": preview_html}

@api_router.get("/check-first-user")
async def check_first_user():
    """Check if there are any users (for showing register option)"""
    user_count = await db.users.count_documents({})
    return {"has_users": user_count > 0}

# ==================== ROOT ====================

@api_router.get("/health")
async def health_check():
    try:
        # Check DB connection
        await client.admin.command('ping')
        
        # Check user count
        user_count = await db.users.count_documents({})
        
        return {
            "status": "ok",
            "database": os.environ.get('DB_NAME'),
            "users_in_db": user_count,
            "api_version": "1.0.1"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "database": os.environ.get('DB_NAME')
        }

@api_router.get("/")
async def root():
    return {"message": "ORVITI Academy API", "version": "1.0.1"}


# Include the router in the main app

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    from pdf_generator import cleanup_pdf_generator
    await cleanup_pdf_generator()
    client.close()
