from sqlalchemy.orm import Session
from app.models.provider import Provider, ProviderCredential
from app.core.security import decrypt_credential
from app.services.llm.base import BaseLLMAdapter
from app.services.llm.gemini_adapter import GeminiAdapter
from app.services.llm.groq_adapter import GroqAdapter
from app.services.llm.openrouter_adapter import OpenRouterAdapter
from app.services.llm.mistral_adapter import MistralAdapter

ADAPTER_MAP = {
    "gemini": GeminiAdapter,
    "groq": GroqAdapter,
    "openrouter": OpenRouterAdapter,
    "mistral": MistralAdapter,
}

def get_llm_adapter(provider_name: str, db: Session) -> BaseLLMAdapter:
    provider = db.query(Provider).filter(Provider.name == provider_name.lower()).first()
    if not provider:
        raise ValueError(f"Provider '{provider_name}' does not exist in the system.")
    
    api_key = None
    cred = db.query(ProviderCredential).filter(ProviderCredential.provider_id == provider.id).first()
    if cred and cred.encrypted_api_key:
        try:
            api_key = decrypt_credential(cred.encrypted_api_key)
        except Exception as e:
            raise ValueError(f"Failed to decrypt credentials for provider '{provider.display_name}': {str(e)}")
    
    if not api_key:
        from app.core.config import settings
        env_key = getattr(settings, f"{provider.name.upper()}_API_KEY", None)
        if env_key and env_key.strip():
            api_key = env_key.strip()

    if not api_key:
        raise ValueError(
            f"Provider '{provider.display_name}' ({provider.name}) is not configured. "
            f"Please configure an API key in the Admin Portal (/admin) or set {provider.name.upper()}_API_KEY in .env."
        )
    
    adapter_cls = ADAPTER_MAP.get(provider.name.lower())
    if not adapter_cls:
        raise ValueError(f"No adapter implementation found for provider '{provider.name}'.")
    
    return adapter_cls(api_key=api_key)

def get_adapter_for_model(model_identifier: str, db: Session) -> tuple[BaseLLMAdapter, str]:
    """Resolve model identifier to its provider and return adapter and identifier."""
    from app.models.provider import Model
    model = db.query(Model).filter(Model.model_identifier == model_identifier).first()
    if not model:
        raise ValueError(f"Model '{model_identifier}' is not registered in the system.")
    if not model.is_enabled:
        raise ValueError(f"Model '{model.display_name}' ({model_identifier}) has been disabled by the administrator.")
    
    adapter = get_llm_adapter(model.provider.name, db)
    return adapter, model.model_identifier
