import os
import json
import logging
from typing import Optional, Dict, Any
import firebase_admin
from firebase_admin import credentials, auth
from google.cloud import firestore

logger = logging.getLogger("agent_studio.firebase")

_firebase_app: Optional[firebase_admin.App] = None
_firestore_client: Optional[firestore.Client] = None

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
    Verifies a Firebase ID token. Returns the decoded token payload dict if valid,
    or None if invalid or Firebase is not configured.
    """
    app = init_firebase()
    if not app:
        return None
    try:
        decoded_token = auth.verify_id_token(token, app=app)
        return decoded_token
    except Exception as e:
        logger.debug("Firebase ID token verification failed: %s", e)
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
