from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
import utils

class OrgCreate(BaseModel):
    # school registration input parameters
    school_name: str = Field(..., min_length=3, max_length=100)
    short_code: Optional[str] = Field(None, min_length=2, max_length=10)
    school_email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator('school_name')
    @classmethod
    def clean_name_fields(cls, v: str) -> str:
        # uniform title casing for school names
        return utils.sanitize_text(v)

    @field_validator('short_code')
    @classmethod
    def clean_code(cls, v: Optional[str]) -> Optional[str]:
        if v:
            # force spacing removal and uppercase matching
            return utils.sanitize_short_code(v)
        return v

    @field_validator('school_email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        # strip and lowercase incoming email
        return utils.sanitize_email(v)

class EmailVerification(BaseModel):
    email: EmailStr
    
    @field_validator('email')
    @classmethod
    def clean_email(cls, v: str) -> str:
        # standard validation clean pipeline
        return utils.sanitize_email(v)

class OrgResponse(BaseModel): 
    id: UUID
    school_name: str
    short_code: str
    school_email: EmailStr
    slug: Optional[str] = None

    class Config:
        from_attributes = True

class OrgUpdate(BaseModel):
    school_name: Optional[str] = Field(None, min_length=3, max_length=100)
    short_code: Optional[str] = Field(None, min_length=2, max_length=10)
    school_email: Optional[EmailStr] = None

    @field_validator('school_name')
    @classmethod
    def clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return utils.sanitize_text(v)
        return v