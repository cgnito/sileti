from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # <-- 1. Add this import
from routes import (
    orgs_router,
    auth_router,
    users_router,
    fees_router,
    billing_router,
    classes_router,
    students_router,
    webhooks_router,
    # whatsapp_router
    # payments_router  
)

app = FastAPI(title="ṣilẹti API")

# 2. Define your allowed frontend origins
origins = [
    "http://localhost:3000",      # React / Next.js
    "http://localhost:5173",      # Vite / Vue / React
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    # Add your production frontend URL here later
]

# 3. Add the CORS middleware to the app
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
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
# Legacy inbound WhatsApp assistant intentionally left out of the active app.
# app.include_router(whatsapp_router)
# app.include_router(payments_router)


@app.get("/")
async def root():
    return {"message": "Welcome to ṣilẹti API", "status": "active"}
