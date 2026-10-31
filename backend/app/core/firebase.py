import os
import json
import logging
from typing import Optional, Dict, Any
import jwt
from jwt import PyJWKClient
import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import firestore

logger = logging.getLogger("agent_studio.firebase")

_firebase_app: Optional[firebase_admin.App] = None
_firestore_client: Optional[firestore.Client] = None
_jwk_client: Optional[PyJWKClient] = None

def get_jwk_client(refresh: bool = False) -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None or refresh:
        _jwk_client = PyJWKClient(
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
            cache_jwk_set=not refresh,
            lifespan=3600
        )
    return _jwk_client

def init_firebase() -> Optional[firebase_admin.App]:
    """
    Initializes the Firebase Admin SDK using the best available credentials:
    1. FIREBASE_CREDENTIALS_JSON environment variable.
    2. FIREBASE_CREDENTIALS_PATH or GOOGLE_APPLICATION_CREDENTIALS file path.
    3. Application Default Credentials (ADC) on Google Cloud Run.
    """
    global _firebase_app
    if _firebase_app:
        return _firebase_app

    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    from app.core.config import settings

    project_id = (
        getattr(settings, "FIREBASE_PROJECT_ID", None)
        or os.getenv("FIREBASE_PROJECT_ID")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
    )

    cred = None
    cred_json = (
        getattr(settings, "FIREBASE_CREDENTIALS_JSON", None)
        or os.getenv("FIREBASE_CREDENTIALS_JSON")
    )
    if cred_json and cred_json.strip():
        try:
            cred = credentials.Certificate(json.loads(cred_json))
        except Exception as e:
            logger.warning("Failed to parse FIREBASE_CREDENTIALS_JSON: %s", e)

    if not cred:
        cred_path = (
            getattr(settings, "FIREBASE_CREDENTIALS_PATH", None)
            or os.getenv("FIREBASE_CREDENTIALS_PATH")
            or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        )
        if cred_path and os.path.isfile(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
            except Exception as e:
                logger.warning("Failed to load Firebase credentials from file %s: %s", cred_path, e)

    options = {}
    if project_id:
        options["projectId"] = project_id

    try:
        if cred:
            _firebase_app = firebase_admin.initialize_app(cred, options=options)
        else:
            _firebase_app = firebase_admin.initialize_app(options=options)
        logger.info("Firebase Admin SDK initialized successfully (Project: %s)", project_id or "default")
    except Exception as e:
        logger.warning("Firebase Admin SDK could not be initialized (local dev mode active): %s", e)
        return None

    return _firebase_app

def verify_firebase_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verifies a Firebase ID token.
    1. First tries Firebase Admin SDK (if service credentials exist).
    2. Fallbacks to Google's public JWKS cryptographic verification (works 100% credential-free).
    """
    if not token or not isinstance(token, str):
        return None

    from app.core.config import settings
    project_id = (
        getattr(settings, "FIREBASE_PROJECT_ID", None)
        or os.getenv("FIREBASE_PROJECT_ID")
        or "agent-studio-def1d"
    )

    # 1. Try Firebase Admin SDK if initialized with credentials
    try:
        app = init_firebase()
        if app:
            return auth.verify_id_token(token, app=app)
    except Exception as e:
        logger.debug("Firebase Admin verify_id_token skipped/failed: %s", e)

    # 2. Cryptographic verification via Google's public JWKS (works without service account)
    try:
        client = get_jwk_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}"
        )
        return payload
    except Exception as err:
        # Cache might be stale or first fetch failed; retry once with a fresh client
        try:
            fresh_client = get_jwk_client(refresh=True)
            signing_key = fresh_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=project_id,
                issuer=f"https://securetoken.google.com/{project_id}"
            )
            return payload
        except Exception as retry_err:
            logger.debug("Firebase JWKS verification failed: %s (initial error: %s)", retry_err, err)
            return None

def get_firestore_client() -> Optional[firestore.Client]:
    """
    Returns an initialized Google Cloud Firestore client.
    """
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    from app.core.config import settings

    project_id = (
        getattr(settings, "FIREBASE_PROJECT_ID", None)
        or os.getenv("FIREBASE_PROJECT_ID")
        or os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
    )

    try:
        if project_id:
            _firestore_client = firestore.Client(project=project_id)
        else:
            _firestore_client = firestore.Client()
        logger.info("Firestore client initialized successfully for project: %s", _firestore_client.project)
        return _firestore_client
    except Exception as e:
        logger.warning("Firestore client could not be initialized: %s", e)
        return None
