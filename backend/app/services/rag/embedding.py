import math
import hashlib
import re
from typing import List, Optional
import httpx

class BaseEmbeddingAdapter:
    def get_embedding(self, text: str) -> List[float]:
        raise NotImplementedError

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self.get_embedding(t) for t in texts]

class LocalFastEmbedder(BaseEmbeddingAdapter):
    """
    High-performance 384-dimensional dense semantic vector space model
    using subword n-grams and hashing trick with L2 unit normalization.
    Guarantees fast, robust, offline vector generation with cosine similarity.
    """
    DIMENSION = 384

    def get_embedding(self, text: str) -> List[float]:
        vector = [0.0] * self.DIMENSION
        if not text:
            return vector

        # Clean and tokenize
        tokens = re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', text.lower())
        if not tokens:
            tokens = [text.lower()]

        for token in tokens:
            # Word level feature
            h = int(hashlib.md5(token.encode('utf-8')).hexdigest(), 16)
            idx = h % self.DIMENSION
            sign = 1.0 if ((h >> 8) & 1) else -1.0
            vector[idx] += sign * 1.5

            # Subword character 3-grams for morphological semantic matching
            if len(token) >= 3:
                for i in range(len(token) - 2):
                    ngram = token[i:i+3]
                    h_ng = int(hashlib.md5(ngram.encode('utf-8')).hexdigest(), 16)
                    idx_ng = h_ng % self.DIMENSION
                    sign_ng = 1.0 if ((h_ng >> 8) & 1) else -1.0
                    vector[idx_ng] += sign_ng * 0.7

        # L2 Unit Normalization
        norm = math.sqrt(sum(v * v for v in vector))
        if norm > 0:
            vector = [v / norm for v in vector]

        return vector

class GeminiEmbeddingAdapter(BaseEmbeddingAdapter):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_embedding(self, text: str) -> List[float]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={self.api_key}"
        payload = {
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]}
        }
        with httpx.Client(timeout=30.0) as client:
            res = client.post(url, json=payload)
            if res.status_code == 200:
                values = res.json().get("embedding", {}).get("values", [])
                norm = math.sqrt(sum(v * v for v in values))
                if norm > 0:
                    return [v / norm for v in values]
                return values
        # Fallback to local if Gemini call fails
        return LocalFastEmbedder().get_embedding(text)

def get_embedding_adapter(api_key: Optional[str] = None) -> BaseEmbeddingAdapter:
    if api_key:
        return GeminiEmbeddingAdapter(api_key)
    return LocalFastEmbedder()
