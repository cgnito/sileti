from pathlib import Path
import sys
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from routes import (
    orgs_router,
    auth_router,
    users_router,
    fees_router,
    billing_router,
    classes_router,
    students_router,
    webhooks_router,
    whatsapp_router,    
    # payments_router  
)

app = FastAPI(title="ṣilẹti API")

# 2. Define your allowed frontend origins
origins = [
    "http://localhost:3000",      # React / Next.js
    "http://localhost:5173",      # Vite / React
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]


production_frontend_url = os.environ.get("FRONTEND_URL")

if production_frontend_url:
    # Clean up trailing slashes if any exist
    origins.append(production_frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# connect application routers
app.include_router(orgs_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(fees_router)
app.include_router(billing_router)
app.include_router(classes_router)
app.include_router(students_router)
app.include_router(webhooks_router)
app.include_router(whatsapp_router)
# app.include_router(payments_router)


@app.get("/")
async def root():
    return {"message": "Welcome to ṣilẹti API", "status": "active"}
