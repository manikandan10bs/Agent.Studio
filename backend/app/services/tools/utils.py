import os
import uuid
import socket
import ipaddress
from urllib.parse import urlparse
from typing import Tuple, Optional
from app.core.config import settings

OUTPUT_DIR = os.path.join(settings.STORAGE_DIR, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def resolve_safe_file_path(file_path_or_name: str) -> str:
    """
    Safely resolves a file path or filename to a valid file inside STORAGE_DIR or uploads.
    Prevents directory traversal attacks.
    """
    if not file_path_or_name or not isinstance(file_path_or_name, str):
        raise ValueError("Invalid file path specified.")

    clean_name = os.path.basename(file_path_or_name.strip())
    
    # 1. Check directly in STORAGE_DIR
    target = os.path.join(settings.STORAGE_DIR, clean_name)
    if os.path.isfile(target):
        return os.path.abspath(target)

    # 2. Check in STORAGE_DIR outputs
    output_target = os.path.join(OUTPUT_DIR, clean_name)
    if os.path.isfile(output_target):
        return os.path.abspath(output_target)

    # 3. Check if full path was provided and is inside allowed directories
    import tempfile
    normalized = os.path.abspath(file_path_or_name)
    allowed_roots = [
        os.path.abspath(settings.STORAGE_DIR),
        os.path.abspath(tempfile.gettempdir()),
        os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "uploads")),
        os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
    ]
    
    for root in allowed_roots:
        if normalized.startswith(root) and os.path.isfile(normalized):
            return normalized

    # 4. Search recursively in STORAGE_DIR
    for root_dir, _, files in os.walk(settings.STORAGE_DIR):
        if clean_name in files:
            found = os.path.join(root_dir, clean_name)
            if os.path.isfile(found):
                return os.path.abspath(found)

    raise FileNotFoundError(f"File '{clean_name}' not found in storage. Please upload the file first.")

def save_output_file(content_bytes: bytes, prefix: str = "processed", ext: str = ".txt") -> Tuple[str, str]:
    """
    Saves an output file to the secure outputs directory and returns (abs_path, download_url).
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if not ext.startswith("."):
        ext = f".{ext}"
    filename = f"{prefix}_{uuid.uuid4().hex[:10]}{ext}"
    abs_path = os.path.join(OUTPUT_DIR, filename)
    
    with open(abs_path, "wb") as f:
        f.write(content_bytes)

    download_url = f"/api/tools/download/{filename}"
    return abs_path, download_url

def is_ssrf_safe_url(url: str) -> Tuple[bool, str, Optional[str]]:
    """
    Validates a URL and enforces strict SSRF protections.
    Blocks private IP ranges, loopbacks, link-locals, and local hostnames.
    Returns (is_safe, message, resolved_ip).
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, f"Unsupported scheme '{parsed.scheme}'. Only http and https are allowed.", None

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: Missing hostname.", None

        # Disallow obvious loopback/local names
        if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal"):
            return False, "Access to localhost and internal loopback addresses is strictly forbidden.", None

        # Resolve hostname to IP address
        try:
            ip_str = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip_str)
        except Exception as e:
            return False, f"Could not resolve hostname '{hostname}': {str(e)}", None

        # Check for private or reserved IPs
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
            return False, f"Access to private/internal network IP ({ip_str}) is strictly forbidden (SSRF Protection).", ip_str

        return True, "URL is public and safe to access.", ip_str
    except Exception as e:
        return False, f"Malformed URL: {str(e)}", None
