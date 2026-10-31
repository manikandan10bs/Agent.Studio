from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.core.config import settings
from app.core.security import (
    get_password_hash,
    generate_invitation_token,
    hash_invitation_token,
    encrypt_credential,
    decrypt_credential,
    mask_api_key
)
from app.models.user import User, UserInvitation, UserQuota
from app.models.provider import Provider, ProviderCredential, Model
from app.models.agent import Agent
from app.models.chat import Conversation
from app.models.usage import UsageEvent, AuditLog
from app.schemas.user import UserCreate, UserUpdate, UserOut, InvitationCreate, InvitationOut
from app.schemas.provider import ProviderOut, ProviderCredentialCreate, ProviderCredentialOut, ModelOut, ModelToggle, TestConnectionResponse
from app.schemas.admin import DashboardStats, UsageStats, AuditLogOut
from app.api.deps import get_current_active_admin, log_audit
from app.services.llm.factory import get_llm_adapter

router = APIRouter()

# --- Dashboard & Usage ---
@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    total_agents = db.query(Agent).count()
    published_agents = db.query(Agent).filter(Agent.status == "published").count()
    total_conversations = db.query(Conversation).count()
    
    token_sum = db.query(func.sum(UsageEvent.total_tokens)).scalar() or 0
    error_count = db.query(UsageEvent).filter(UsageEvent.is_error == True).count()
    
    # Estimate cost ($0.50 per 1M tokens average across providers)
    estimated_cost = round((token_sum / 1_000_000) * 0.50, 4)

    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_agents=total_agents,
        published_agents=published_agents,
        total_conversations=total_conversations,
        total_tokens_used=token_sum,
        estimated_cost=estimated_cost,
        total_errors=error_count
    )

@router.get("/usage", response_model=List[UsageStats])
def get_usage_statistics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    stats = (
        db.query(
            UsageEvent.provider_name,
            UsageEvent.model_identifier,
            func.count(UsageEvent.id).label("requests"),
            func.sum(UsageEvent.total_tokens).label("tokens"),
            func.avg(UsageEvent.latency_ms).label("latency"),
            func.sum(func.cast(UsageEvent.is_error, func.Integer if db.bind.dialect.name == "sqlite" else None)).label("errors")
        )
        .group_by(UsageEvent.provider_name, UsageEvent.model_identifier)
        .all()
    )
    results = []
    for row in stats:
        results.append(UsageStats(
            provider_name=row[0],
            model_identifier=row[1],
            total_requests=row[2] or 0,
            total_tokens=row[3] or 0,
            avg_latency_ms=round(row[4] or 0.0, 1),
            error_count=row[5] or 0
        ))
    return results

@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs

# --- Users & Invitations ---
@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    return db.query(User).order_by(User.created_at.desc()).all()

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user_direct(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_user = User(
        email=user_in.email.lower(),
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True
    )
    db.add(new_user)
    db.flush()

    quota = UserQuota(user_id=new_user.id)
    db.add(quota)
    db.commit()
    db.refresh(new_user)

    log_audit(db, "ADMIN_CREATE_USER", "user", str(new_user.id), user=admin, details={"email": new_user.email})
    return new_user

@router.post("/invitations", response_model=InvitationOut)
def create_invitation(
    invite_in: InvitationCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    raw_token = generate_invitation_token()
    token_hash = hash_invitation_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.INVITATION_TOKEN_EXPIRE_HOURS)

    invitation = UserInvitation(
        email=invite_in.email.lower(),
        role=invite_in.role,
        token_hash=token_hash,
        expires_at=expires_at,
        is_used=False,
        created_by_id=admin.id
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    invite_url = f"/accept-invitation?token={raw_token}"
    log_audit(db, "GENERATE_INVITATION", "invitation", str(invitation.id), user=admin, details={"email": invite_in.email})

    return InvitationOut(
        id=invitation.id,
        email=invitation.email,
        role=invitation.role,
        invitation_url=invite_url,
        expires_at=invitation.expires_at,
        is_used=invitation.is_used,
        created_at=invitation.created_at
    )

@router.patch("/users/{user_id}", response_model=UserOut)
def update_user_status(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.id == admin.id and user_update.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate the currently signed-in administrator.")

    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    db.commit()
    db.refresh(user)
    log_audit(db, "ADMIN_UPDATE_USER", "user", str(user.id), user=admin)

    try:
        from app.services.firestore_service import FirestoreService
        FirestoreService.sync_user_profile(
            user_id=str(user.id),
            email=user.email,
            name=user.full_name,
            role=user.role
        )
    except Exception:
        pass

    return user

# --- Providers & Model Administration ---
@router.get("/providers", response_model=List[ProviderOut])
def list_providers(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    providers = db.query(Provider).order_by(Provider.name).all()
    results = []
    for p in providers:
        cred_out = None
        if p.credentials:
            cred_out = ProviderCredentialOut(
                key_hint=p.credentials.key_hint,
                is_valid=p.credentials.is_valid,
                last_tested_at=p.credentials.last_tested_at,
                last_error=p.credentials.last_error
            )
        
        models_out = [
            ModelOut(
                id=m.id,
                provider_id=m.provider_id,
                provider_name=p.name,
                model_identifier=m.model_identifier,
                display_name=m.display_name,
                is_enabled=m.is_enabled,
                context_window=m.context_window,
                supports_streaming=m.supports_streaming,
                supports_rag=m.supports_rag
            )
            for m in p.models
        ]

        results.append(ProviderOut(
            id=p.id,
            name=p.name,
            display_name=p.display_name,
            is_configured=p.is_configured,
            credentials=cred_out,
            models=models_out
        ))
    return results

@router.post("/providers/{provider_id}/credentials", response_model=TestConnectionResponse)
async def update_provider_credentials(
    provider_id: int,
    cred_in: ProviderCredentialCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    raw_key = cred_in.api_key.strip()
    if not raw_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty.")

    encrypted = encrypt_credential(raw_key)
    hint = mask_api_key(raw_key)

    cred = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).first()
    if not cred:
        cred = ProviderCredential(
            provider_id=provider.id,
            encrypted_api_key=encrypted,
            key_hint=hint,
            is_valid=True
        )
        db.add(cred)
    else:
        cred.encrypted_api_key = encrypted
        cred.key_hint = hint
        cred.is_valid = True

    provider.is_configured = True
    db.commit()

    # Automatically test the new connection
    test_msg = "Credentials saved."
    try:
        adapter = get_llm_adapter(provider.name, db)
        is_ok, msg = await adapter.test_connection()
        cred.is_valid = is_ok
        cred.last_tested_at = datetime.now(timezone.utc)
        cred.last_error = None if is_ok else msg
        db.commit()
        test_msg = msg
    except Exception as e:
        cred.is_valid = False
        cred.last_error = str(e)
        db.commit()
        test_msg = f"Credentials saved, but verification failed: {str(e)}"

    log_audit(db, "UPDATE_PROVIDER_CREDENTIALS", "provider", str(provider.id), user=admin, details={"key_hint": hint})
    return TestConnectionResponse(success=cred.is_valid, message=test_msg)

@router.post("/providers/{provider_id}/test", response_model=TestConnectionResponse)
async def test_provider_connection(
    provider_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    provider = db.query(Provider).filter(Provider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found.")

    cred = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).first()
    if not cred or not cred.encrypted_api_key:
        raise HTTPException(status_code=400, detail=f"No API key configured for {provider.display_name}.")

    try:
        adapter = get_llm_adapter(provider.name, db)
        is_ok, msg = await adapter.test_connection()
        cred.is_valid = is_ok
        cred.last_tested_at = datetime.now(timezone.utc)
        cred.last_error = None if is_ok else msg
        db.commit()
        return TestConnectionResponse(success=is_ok, message=msg)
    except Exception as e:
        cred.is_valid = False
        cred.last_tested_at = datetime.now(timezone.utc)
        cred.last_error = str(e)
        db.commit()
        return TestConnectionResponse(success=False, message=str(e))

@router.get("/models", response_model=List[ModelOut])
def list_admin_models(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    models = db.query(Model).join(Provider).order_by(Provider.name, Model.display_name).all()
    results = []
    for m in models:
        results.append(ModelOut(
            id=m.id,
            provider_id=m.provider_id,
            provider_name=m.provider.name,
            model_identifier=m.model_identifier,
            display_name=m.display_name,
            is_enabled=m.is_enabled,
            context_window=m.context_window,
            supports_streaming=m.supports_streaming,
            supports_rag=m.supports_rag
        ))
    return results

@router.patch("/models/{model_id}", response_model=ModelOut)
def toggle_model_status(
    model_id: int,
    toggle: ModelToggle,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_active_admin)
):
    model = db.query(Model).filter(Model.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found.")

    model.is_enabled = toggle.is_enabled
    db.commit()
    db.refresh(model)

    log_audit(db, "TOGGLE_MODEL", "model", str(model.id), user=admin, details={"enabled": toggle.is_enabled})

    return ModelOut(
        id=model.id,
        provider_id=model.provider_id,
        provider_name=model.provider.name,
        model_identifier=model.model_identifier,
        display_name=model.display_name,
        is_enabled=model.is_enabled,
        context_window=model.context_window,
        supports_streaming=model.supports_streaming,
        supports_rag=model.supports_rag
    )
