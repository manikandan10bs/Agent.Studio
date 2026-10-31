import time
import json
import httpx
from typing import List, Optional, AsyncGenerator, Tuple
from app.services.llm.base import BaseLLMAdapter, LLMMessage, LLMResponse, LLMUsage, LLMStreamChunk

class GeminiAdapter(BaseLLMAdapter):
    DEFAULT_MODEL = "gemini-flash-lite-latest"

    # Auto-map deprecated, preview, or replaced model identifiers to active working endpoints
    MODEL_ALIASES = {
        "gemini-2.5-flash": "gemini-2.5-flash-lite",
        "gemini-2.5-pro": "gemini-flash-lite-latest",
        "gemini-3.8-flash": "gemini-flash-lite-latest",
        "gemini-1.5-flash": "gemini-flash-lite-latest",
        "gemini-1.5-pro": "gemini-flash-lite-latest",
        "gemini-flash": "gemini-flash-lite-latest",
    }

    def _resolve_model(self, model: Optional[str]) -> str:
        target = model or self.DEFAULT_MODEL
        return self.MODEL_ALIASES.get(target, target)

    async def generate(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        tools: Optional[List[Dict[str, Any]]] = None,
        raw_contents: Optional[List[Dict[str, Any]]] = None,
    ) -> LLMResponse:
        model_name = self._resolve_model(model)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.api_key}"
        
        # Build contents
        if raw_contents is not None:
            contents = raw_contents
        else:
            contents = []
            for m in messages:
                role = "user" if m.role in ("user", "system") else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": m.content}]
                })

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }
        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }

        if tools and len(tools) > 0:
            payload["tools"] = [{"function_declarations": tools}]

        start_time = time.time()
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(url, json=payload)
            latency_ms = int((time.time() - start_time) * 1000)

            if res.status_code != 200:
                try:
                    err_json = res.json()
                    err_msg = err_json.get("error", {}).get("message", res.text)
                except Exception:
                    err_msg = res.text
                raise RuntimeError(f"Gemini API error ({res.status_code}): {err_msg}")

            data = res.json()
            candidates = data.get("candidates", [])
            content_text = ""
            tool_calls = []
            parts = []
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                for p in parts:
                    if "text" in p:
                        content_text += p.get("text", "")
                    if "functionCall" in p:
                        tool_calls.append(p["functionCall"])

            meta = data.get("usageMetadata", {})
            usage = LLMUsage(
                prompt_tokens=meta.get("promptTokenCount", 0),
                completion_tokens=meta.get("candidatesTokenCount", 0),
                total_tokens=meta.get("totalTokenCount", 0)
            )

            return LLMResponse(
                content=content_text,
                usage=usage,
                model=model_name,
                latency_ms=latency_ms,
                tool_calls=tool_calls if tool_calls else None,
                raw_parts=parts
            )

    async def generate_stream(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        model_name = self._resolve_model(model)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={self.api_key}"

        contents = []
        for m in messages:
            role = "user" if m.role in ("user", "system") else "model"
            contents.append({
                "role": role,
                "parts": [{"text": m.content}]
            })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }
        if system_prompt:
            payload["system_instruction"] = {
                "parts": [{"text": system_prompt}]
            }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        try:
                            err_json = json.loads(err_body)
                            err_msg = err_json.get("error", {}).get("message", err_body.decode())
                        except Exception:
                            err_msg = err_body.decode()
                        yield LLMStreamChunk(error=f"Gemini API error ({response.status_code}): {err_msg}", is_done=True)
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if not data_str:
                                continue
                            try:
                                chunk_json = json.loads(data_str)
                                candidates = chunk_json.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    delta = "".join(p.get("text", "") for p in parts)
                                    if delta:
                                        yield LLMStreamChunk(delta=delta)
                            except Exception:
                                continue
            yield LLMStreamChunk(is_done=True)
        except Exception as e:
            yield LLMStreamChunk(error=str(e), is_done=True)

    async def test_connection(self) -> Tuple[bool, str]:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={self.api_key}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    return True, "Successfully connected to Google Gemini API"
                else:
                    return False, f"Gemini API error {res.status_code}: {res.text}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
