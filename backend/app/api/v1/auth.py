from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, create_access_token, get_password_hash, hash_invitation_token
from app.models.user import User, UserInvitation, UserQuota
from app.schemas.auth import LoginRequest, Token, UserResponse, AcceptInvitationRequest
from app.api.deps import get_current_user, log_audit

router = APIRouter()

@router.post("/login", response_model=Token)
def login(
    login_data: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == login_data.email.lower()).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended or deactivated. Contact administrator.",
        )

    access_token = create_access_token(subject=user.id)

    # Set secure HTTP-only cookie
    response.set_cookie(
        key="agent_studio_token",
        value=access_token,
        httponly=True,
        max_age=60 * 60 * 24,  # 24 hours
        samesite="lax",
        secure=False  # Allow localhost development
    )

    log_audit(db, "LOGIN_SUCCESS", "user", str(user.id), user=user, ip_address=request.client.host if request.client else None)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="agent_studio_token")
    return {"message": "Logged out successfully"}

@router.get("/invitation-info")
def get_invitation_info(token: str, db: Session = Depends(get_db)):
    """Retrieve invitation details to pre-fill the accept-invitation form."""
    token_hash = hash_invitation_token(token)
    invitation = db.query(UserInvitation).filter(
        UserInvitation.token_hash == token_hash,
        UserInvitation.is_used == False
    ).first()
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used invitation token.",
        )
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation token has expired. Request a new invite from the administrator.",
        )
    return {
        "email": invitation.email,
        "role": invitation.role,
        "is_valid": True
    }

@router.post("/accept-invitation", response_model=Token)
def accept_invitation(
    data: AcceptInvitationRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    token_hash = hash_invitation_token(data.token)
    invitation = db.query(UserInvitation).filter(
        UserInvitation.token_hash == token_hash,
        UserInvitation.is_used == False
    ).first()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used invitation token.",
        )

    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation token has expired. Request a new invite from the administrator.",
        )

    # Check if user already exists
    user = db.query(User).filter(User.email == invitation.email.lower()).first()
    if user:
        user.hashed_password = get_password_hash(data.password)
        if data.full_name:
            user.full_name = data.full_name
        user.is_active = True
    else:
        user = User(
            email=invitation.email.lower(),
            full_name=data.full_name or invitation.email.split("@")[0].title(),
            hashed_password=get_password_hash(data.password),
            role=invitation.role,
            is_active=True
        )
        db.add(user)
        db.flush()

        # Add quota
        quota = UserQuota(user_id=user.id)
        db.add(quota)

    invitation.is_used = True
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id)
    response.set_cookie(
        key="agent_studio_token",
        value=access_token,
        httponly=True,
        max_age=60 * 60 * 24,
        samesite="lax",
        secure=False
    )

    log_audit(db, "INVITATION_ACCEPTED", "user", str(user.id), user=user, ip_address=request.client.host if request.client else None)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user
