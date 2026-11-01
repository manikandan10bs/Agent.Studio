import time
import json
import httpx
from typing import List, Optional, AsyncGenerator, Tuple
from app.services.llm.base import BaseLLMAdapter, LLMMessage, LLMResponse, LLMUsage, LLMStreamChunk

class GroqAdapter(BaseLLMAdapter):
    DEFAULT_MODEL = "llama-3.3-70b-versatile"
    BASE_URL = "https://api.groq.com/openai/v1"

    async def generate(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> LLMResponse:
        model_name = model or self.DEFAULT_MODEL
        url = f"{self.BASE_URL}/chat/completions"

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            formatted_messages.append({"role": m.role, "content": m.content})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_name,
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }

        start_time = time.time()
        res = None
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    res = await client.post(url, headers=headers, json=payload)
                    latency_ms = int((time.time() - start_time) * 1000)
                    break
            except (httpx.ConnectError, httpx.NetworkError) as e:
                if attempt == 0:
                    import asyncio
                    await asyncio.sleep(1.0)
                    continue
                raise RuntimeError(
                    f"Network connection to Groq API failed (DNS lookup or timeout). Please check your internet connection."
                )

        if res is None:
            raise RuntimeError("Failed to receive response from Groq API.")

            if res.status_code != 200:
                try:
                    err_json = res.json()
                    err_msg = err_json.get("error", {}).get("message", res.text)
                except Exception:
                    err_msg = res.text
                raise RuntimeError(f"Groq API error ({res.status_code}): {err_msg}")

            data = res.json()
            content = data["choices"][0]["message"]["content"]
            usage_data = data.get("usage", {})
            usage = LLMUsage(
                prompt_tokens=usage_data.get("prompt_tokens", 0),
                completion_tokens=usage_data.get("completion_tokens", 0),
                total_tokens=usage_data.get("total_tokens", 0)
            )

            return LLMResponse(
                content=content,
                usage=usage,
                model=model_name,
                latency_ms=latency_ms
            )

    async def generate_stream(
        self,
        messages: List[LLMMessage],
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[LLMStreamChunk, None]:
        model_name = model or self.DEFAULT_MODEL
        url = f"{self.BASE_URL}/chat/completions"

        formatted_messages = []
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            formatted_messages.append({"role": m.role, "content": m.content})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model_name,
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        try:
                            err_json = json.loads(err_body)
                            err_msg = err_json.get("error", {}).get("message", err_body.decode())
                        except Exception:
                            err_msg = err_body.decode()
                        yield LLMStreamChunk(error=f"Groq API error ({response.status_code}): {err_msg}", is_done=True)
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk_json = json.loads(data_str)
                                choices = chunk_json.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {}).get("content", "")
                                    if delta:
                                        yield LLMStreamChunk(delta=delta)
                            except Exception:
                                continue
            yield LLMStreamChunk(is_done=True)
        except (httpx.ConnectError, httpx.NetworkError) as e:
            yield LLMStreamChunk(
                error=f"Network connection to Groq API failed (DNS lookup or timeout). Please check your internet connection.",
                is_done=True
            )
        except Exception as e:
            yield LLMStreamChunk(error=str(e), is_done=True)

    async def test_connection(self) -> Tuple[bool, str]:
        try:
            url = f"{self.BASE_URL}/models"
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return True, "Successfully connected to GroqCloud API"
                return False, f"Groq API error {res.status_code}: {res.text}"
        except Exception as e:
            return False, f"Connection failed: {str(e)}"
