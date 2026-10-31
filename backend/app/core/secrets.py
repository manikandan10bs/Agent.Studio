import os
import logging
from typing import Optional

logger = logging.getLogger("agent_studio.secrets")

_cached_secrets: dict[str, str] = {}

def get_secret(secret_name: str, default: Optional[str] = None) -> Optional[str]:
    """
    Retrieves a secret with hierarchical resolution:
    1. In-memory cache.
    2. Local environment variable.
    3. Google Cloud Secret Manager (if available and project is configured).
    4. Fallback default.
    """
    if secret_name in _cached_secrets:
        return _cached_secrets[secret_name]

    # 1. Environment variable check
    env_val = os.getenv(secret_name)
    if env_val and env_val.strip():
        _cached_secrets[secret_name] = env_val.strip()
        return _cached_secrets[secret_name]

    # 2. Check Google Cloud Secret Manager
    project_id = (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("GCP_PROJECT")
        or os.getenv("FIREBASE_PROJECT_ID")
    )
    if project_id:
        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            resource_name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
            response = client.access_secret_version(name=resource_name)
            secret_value = response.payload.data.decode("UTF-8").strip()
            if secret_value:
                _cached_secrets[secret_name] = secret_value
                logger.info("Loaded secret '%s' from Google Secret Manager", secret_name)
                return secret_value
        except Exception as e:
            # Secret Manager not accessible or secret doesn't exist
            logger.debug("Secret Manager lookup for '%s' in project '%s' skipped: %s", secret_name, project_id, e)

    return default
