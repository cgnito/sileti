from fastapi import FastAPI
from routes import orgs_router, auth_router, users_router, fees_router, billing_router, classes_router, students_router, payments_router  

app = FastAPI(title="Kọ́ API")

# Connect routers
app.include_router(orgs_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(fees_router)
app.include_router(billing_router)
app.include_router(classes_router)
app.include_router(students_router)
app.include_router(payments_router)

@app.get("/")
async def root():
    return {"message": "Welcome to ṣilẹti API", "status": "active"}