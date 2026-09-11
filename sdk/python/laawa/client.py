from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json

class LaaWaApiError(RuntimeError):
    def __init__(self, status: int, message: str, code: Optional[str] = None, details: Any = None):
        super().__init__(message)
        self.status, self.code, self.details = status, code, details

@dataclass
class LaaWaClient:
    base_url: str
    api_key: str
    timeout: float = 30.0

    def _request(self, path: str, method: str = "GET", payload: Any = None) -> Any:
        body = None if payload is None else json.dumps(payload).encode()
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}
        if body is not None: headers["Content-Type"] = "application/json"
        request = Request(self.base_url.rstrip("/") + path, data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                result = json.loads(response.read().decode())
        except HTTPError as exc:
            raw = exc.read().decode(errors="replace")
            try: result = json.loads(raw)
            except json.JSONDecodeError: result = {"error": {"message": raw or "Request failed"}}
            error = result.get("error", {})
            raise LaaWaApiError(exc.code, error.get("message", "Request failed"), error.get("code"), error.get("details")) from exc
        if not result.get("ok", False):
            error = result.get("error", {})
            raise LaaWaApiError(200, error.get("message", "Request failed"), error.get("code"), error.get("details"))
        return result.get("data")

    def health(self): return self._request("/health")
    def engines(self): return self._request("/engines")
    def messages(self, account_id: str, chat_id: str):
        from urllib.parse import urlencode
        return self._request("/messages?" + urlencode({"accountId": account_id, "chatId": chat_id}))
    def send_message(self, **message):
        message.setdefault("action", "send")
        return self._request("/messages", "POST", message)
