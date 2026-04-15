import logging

import httpx

from app.llm.base import LLMProvider

logger = logging.getLogger(__name__)


class OllamaProvider(LLMProvider):
    provider_name = "ollama"

    def __init__(self, host: str, port: int, model: str = "qwen2.5:72b"):
        self.base_url = f"http://{host}:{port}"
        self.default_model = model

    async def _generate_impl(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        json_mode: bool = True,
    ) -> dict:
        use_model = model or self.default_model

        system = system_prompt
        if json_mode:
            system += "\n\nReturn ONLY valid JSON. No markdown, no explanation."

        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": use_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_prompt},
                    ],
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )
            response.raise_for_status()
            data = response.json()

        raw_text = data.get("message", {}).get("content", "")

        if json_mode:
            return self._parse_json_response(raw_text)
        return {"text": raw_text}

    def get_available_models(self) -> list[dict]:
        try:
            import httpx as sync_httpx

            resp = sync_httpx.get(f"{self.base_url}/api/tags", timeout=5)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                return [
                    {
                        "model_id": m["name"],
                        "model_name": m["name"],
                        "description": f"Ollama: {m.get('size', 'unknown size')}",
                    }
                    for m in models
                ]
        except Exception as e:
            logger.warning("Failed to list Ollama models: %s", e)
        return []
