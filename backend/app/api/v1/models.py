from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.provider import Model, Provider, ProviderCredential
from app.schemas.provider import ModelOut, ProviderOut, ProviderCredentialOut
from app.api.deps import get_current_user_optional

router = APIRouter()

@router.get("", response_model=List[ModelOut])
def list_enabled_models(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """
    Returns only models enabled by the administrator.
    Creators and visitors can select from these models.
    """
    models = (
        db.query(Model)
        .join(Provider)
        .filter(Model.is_enabled == True)
        .order_by(Provider.name, Model.display_name)
        .all()
    )
    result = []
    for m in models:
        result.append(ModelOut(
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
    return result

@router.get("/providers-status", response_model=List[ProviderOut])
def get_providers_status(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional)
):
    """
    Returns providers and their model status for creators and admins.
    Shows configured status without exposing raw secrets.
    """
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
