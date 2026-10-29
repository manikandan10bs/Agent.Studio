import pytest
from app.core.security import encrypt_credential, decrypt_credential, mask_api_key
from app.services.llm.factory import get_llm_adapter

def test_credential_encryption():
    raw_key = "gsk_live_secret_sample_token_123456789"
    encrypted = encrypt_credential(raw_key)
    assert encrypted != raw_key
    assert len(encrypted) > 20

    decrypted = decrypt_credential(encrypted)
    assert decrypted == raw_key

def test_mask_api_key():
    assert mask_api_key("sk-abcdefgh12345678") == "sk-...5678"
    assert mask_api_key("short") == "****"

def test_unconfigured_provider_error(db_session, monkeypatch):
    from app.core.config import settings
    from app.models.provider import Provider, ProviderCredential

    # Ensure no env key or credential exists for test provider
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    cred = db_session.query(ProviderCredential).join(Provider).filter(Provider.name == "groq").first()
    if cred:
        db_session.delete(cred)
        db_session.commit()

    with pytest.raises(ValueError) as exc:
        get_llm_adapter("groq", db_session)
    assert "is not configured" in str(exc.value)
