import json
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.core.firebase import verify_firebase_token
from app.services.firestore_service import FirestoreService
from app.core.config import settings
from app.models.user import User, UserQuota
from app.models.usage import AuditLog

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def _get_or_sync_firebase_user(claims: dict, db: Session) -> Optional[User]:
    raw_email = claims.get("email")
    if not raw_email:
        return None
    email = raw_email.strip().lower()
    
    admin_emails = {
        "manikandan10bs@gmail.com",
        "admin@agent.studio",
        settings.DEFAULT_ADMIN_EMAIL.lower()
    }
    is_default_admin = email in admin_emails

    user = db.query(User).filter(User.email.ilike(email)).first()
    if not user:
        role = "admin" if is_default_admin else "creator"
        user = User(
            email=email,
            full_name=claims.get("name") or email.split("@")[0].title(),
            hashed_password="firebase_authenticated_account",
            role=role,
            is_active=True
        )
        db.add(user)
        db.flush()
        # Ensure quota record exists
        quota = UserQuota(user_id=user.id)
        db.add(quota)
        db.commit()
        db.refresh(user)
    else:
        # Guarantee default admin always retains admin role
        if is_default_admin and user.role != "admin":
            user.role = "admin"
            db.commit()
            db.refresh(user)
    
    # Sync user in Firestore
    try:
        FirestoreService.sync_user_profile(
            user_id=str(user.id),
            email=user.email,
            name=user.full_name,
            role=user.role
        )
    except Exception:
        pass
    return user

def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    # Also check cookie if header not present
    if not token:
        token = request.cookies.get("agent_studio_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Try Firebase Authentication ID Token verification
    firebase_claims = verify_firebase_token(token)
    if firebase_claims:
        fb_user = _get_or_sync_firebase_user(firebase_claims, db)
        if fb_user:
            if not fb_user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is inactive or suspended",
                )
            return fb_user

    # 2. Fallback to local JWT token
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or suspended",
        )
    return user

def get_current_user_optional(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Returns user if valid token is provided, otherwise None without raising 401.
    """
    if not token:
        token = request.cookies.get("agent_studio_token")
    if not token:
        return None

    firebase_claims = verify_firebase_token(token)
    if firebase_claims:
        return _get_or_sync_firebase_user(firebase_claims, db)

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None

    try:
        user_id = payload.get("sub")
        return db.query(User).filter(User.id == int(user_id), User.is_active == True).first()
    except Exception:
        return None

def get_current_active_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required",
        )
    return current_user

def get_optional_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    if not token:
        token = request.cookies.get("agent_studio_token")
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload or not payload.get("sub"):
            return None
        user = db.query(User).filter(User.id == int(payload.get("sub"))).first()
        if user and user.is_active:
            return user
    except Exception:
        return None
    return None

def log_audit(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    user: Optional[User] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Record an audit trail event."""
    audit = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else "anonymous",
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        details_json=json.dumps(details or {}),
        ip_address=ip_address
    )
    db.add(audit)
    db.commit()
