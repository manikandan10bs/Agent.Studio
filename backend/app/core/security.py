import os
import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

# --- Password Hashing (PBKDF2-HMAC-SHA256 NIST Compliant) ---
ITERATIONS = 600000

def get_password_hash(password: str) -> str:
    """Hash password using salt + PBKDF2-HMAC-SHA256."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"pbkdf2:sha256:{ITERATIONS}${base64.b64encode(salt).decode('utf-8')}${base64.b64encode(key).decode('utf-8')}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        meta, salt_b64, key_b64 = parts
        salt = base64.b64decode(salt_b64)
        expected_key = base64.b64decode(key_b64)
        derived_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, ITERATIONS)
        return secrets.compare_digest(derived_key, expected_key)
    except Exception:
        return False

# --- JWT Tokens ---
def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except Exception:
        return None

# --- Provider Credential Encryption (AES-256-GCM) ---
def _get_aes_key() -> bytes:
    """Derive a fixed 32-byte key from master key using SHA-256."""
    return hashlib.sha256(settings.ENCRYPTION_MASTER_KEY.encode("utf-8")).digest()

def encrypt_credential(plain_text: str) -> str:
    """Encrypt a secret string using AES-256-GCM. Returns base64 nonce+ciphertext+tag."""
    if not plain_text:
        return ""
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # Standard 96-bit nonce for GCM
    encrypted = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
    payload = nonce + encrypted
    return base64.b64encode(payload).decode("utf-8")

def decrypt_credential(cipher_text_b64: str) -> str:
    """Decrypt an AES-256-GCM encrypted base64 payload."""
    if not cipher_text_b64:
        return ""
    try:
        key = _get_aes_key()
        aesgcm = AESGCM(key)
        payload = base64.b64decode(cipher_text_b64.encode("utf-8"))
        nonce = payload[:12]
        ciphertext = payload[12:]
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decrypt credential: {str(e)}")

def mask_api_key(key: str) -> str:
    """Display masked API key for safe UI visualization (e.g. sk-...a1b2)."""
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:3]}...{key[-4:]}"

# --- User Invitations ---
def generate_invitation_token() -> str:
    """Generate a secure, URL-safe invitation token."""
    return secrets.token_urlsafe(32)

def hash_invitation_token(token: str) -> str:
    """Store hash of invitation token for single-use lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
