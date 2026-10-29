import os
import logging
import httpx
from typing import Optional, Tuple
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    """
    Unified Storage Service supporting:
    1. Supabase Storage (Persistent cloud storage on free tier)
    2. Local Filesystem (Fallback development storage)
    """

    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.bucket = settings.SUPABASE_STORAGE_BUCKET or "agent-documents"

    @property
    def is_supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    async def _ensure_bucket(self, client: httpx.AsyncClient):
        """Ensures the Supabase Storage bucket exists."""
        if not self.is_supabase_enabled:
            return
        url = f"{self.supabase_url.rstrip('/')}/storage/v1/bucket"
        headers = {
            "Authorization": f"Bearer {self.supabase_key}",
            "apikey": self.supabase_key,
            "Content-Type": "application/json"
        }
        try:
            # Check if bucket exists
            res = await client.get(f"{url}/{self.bucket}", headers=headers)
            if res.status_code == 404:
                # Create bucket
                payload = {"id": self.bucket, "name": self.bucket, "public": False}
                create_res = await client.post(url, json=payload, headers=headers)
                if create_res.status_code in (200, 201):
                    logger.info(f"Created Supabase Storage bucket '{self.bucket}'.")
        except Exception as e:
            logger.warning(f"Could not verify/create Supabase bucket: {e}")

    async def upload_file(self, filename: str, content: bytes, content_type: str = "application/octet-stream") -> Tuple[str, bool]:
        """
        Uploads a file to Supabase Storage if configured, otherwise saves locally.
        Returns (storage_path, is_remote).
        """
        if self.is_supabase_enabled:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    await self._ensure_bucket(client)
                    upload_url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{self.bucket}/{filename}"
                    headers = {
                        "Authorization": f"Bearer {self.supabase_key}",
                        "apikey": self.supabase_key,
                        "Content-Type": content_type,
                        "x-upsert": "true"
                    }
                    res = await client.post(upload_url, content=content, headers=headers)
                    if res.status_code in (200, 201):
                        logger.info(f"Uploaded {filename} to Supabase bucket '{self.bucket}'.")
                        return f"supabase://{self.bucket}/{filename}", True
                    else:
                        logger.warning(f"Supabase upload returned {res.status_code}: {res.text}. Falling back to local disk.")
            except Exception as e:
                logger.warning(f"Failed to upload to Supabase Storage: {e}. Falling back to local disk.")

        # Local storage fallback
        os.makedirs(settings.STORAGE_DIR, exist_ok=True)
        local_path = os.path.join(settings.STORAGE_DIR, filename)
        with open(local_path, "wb") as f:
            f.write(content)
        return local_path, False

    async def get_file_bytes(self, storage_path: str) -> bytes:
        """Retrieves raw file bytes from Supabase Storage or local filesystem."""
        if storage_path.startswith("supabase://"):
            parts = storage_path.replace("supabase://", "").split("/", 1)
            bucket = parts[0]
            file_name = parts[1]
            url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{file_name}"
            headers = {
                "Authorization": f"Bearer {self.supabase_key}",
                "apikey": self.supabase_key
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.content
                raise RuntimeError(f"Failed to download file from Supabase Storage: {res.status_code}")

        # Local file
        if os.path.exists(storage_path):
            with open(storage_path, "rb") as f:
                return f.read()
        raise FileNotFoundError(f"File not found at storage path: {storage_path}")

storage_service = StorageService()
