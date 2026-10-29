from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "creator"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = "creator"

class InvitationOut(BaseModel):
    id: int
    email: str
    role: str
    invitation_url: str
    expires_at: datetime
    is_used: bool
    created_at: datetime

    class Config:
        from_attributes = True
