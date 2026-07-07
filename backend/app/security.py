from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import os
from dotenv import load_dotenv

from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from . import models
from .database import get_db

load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM") 
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

class AuthContext:
    def __init__(self, *, id, email, full_name, role, org_id, is_active=True, organization=None, user=None):
        # unified tracking payload across school admins and staff accounts
        self.id = id
        self.email = email
        self.full_name = full_name
        self.role = role
        self.org_id = org_id
        self.is_active = is_active
        self.organization = organization
        self.user = user

def get_password_hash(password: str) -> str:
    # generate secure password hash using bcrypt
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # verify plain password against saved hash profile
    return pwd_context.verify(plain_password, hashed_password)

def create_verification_token(email: str) -> str:
    # issue a time-restricted token strictly bound for email validation
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    to_encode = {"exp": expire, "sub": email, "purpose": "verification"}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(data: dict) -> str:
    # generate authentication json web token for session access
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=1)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> AuthContext:
    # decode access credentials and construct context instance
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="invalid session credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="could not validate session credentials")

    # verify against organization table for school admin profiles
    org = db.query(models.Organization).filter(models.Organization.school_email == email).first()
    if org:
        return AuthContext(
            id=org.id,
            email=org.school_email,
            full_name=org.school_name,
            role="admin",
            org_id=org.id,
            is_active=True,
            organization=org,
            user=None
        )

    # fallback query against user table for staff accounts
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="invalid or inactive account credentials")
        
    return AuthContext(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=str(user.role).lower(),
        org_id=user.org_id,
        is_active=user.is_active,
        organization=user.organization,
        user=user
    )

class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = {str(role).lower() for role in allowed_roles}

    def __call__(self, current_user: AuthContext = Depends(get_current_user)) -> AuthContext:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="access denied. insufficient permissions for this operation."
            )
        return current_user

# explicit shortcut validator functions for route handlers
allow_admin_only = RoleChecker(["admin"])