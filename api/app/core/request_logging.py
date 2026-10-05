"""Portable request summaries without URLs, query strings, bodies or exception text."""

import json
import logging
import sys
from time import monotonic
from uuid import uuid4

logger = logging.getLogger("app.requests")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


class SafeRequestLogging:
    def __init__(self, app, sanitize_errors=True):
        self.app = app
        self.sanitize_errors = sanitize_errors

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started_at = monotonic()
        request_id = uuid4().hex
        status = 500
        started = False
        error_type = None

        async def safe_send(message):
            nonlocal status, started
            if message["type"] == "http.response.start":
                started = True
                status = message["status"]
                message = dict(message)
                message["headers"] = list(message.get("headers", [])) + [
                    (b"x-request-id", request_id.encode())
                ]
            await send(message)

        try:
            await self.app(scope, receive, safe_send)
        except Exception as error:
            error_type = type(error).__name__
            status = 500
            if not self.sanitize_errors:
                raise
            if started:
                raise RuntimeError("Request failed after response started") from None
            await safe_send(
                {
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            await safe_send(
                {"type": "http.response.body", "body": b'{"detail":"Internal server error"}'}
            )
        finally:
            route = scope.get("route")
            method = scope.get("method")
            record = {
                "request_id": request_id,
                "method": method
                if method in ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
                else "OTHER",
                "route": getattr(route, "path", "unmatched"),
                "status": status,
                "duration_ms": round((monotonic() - started_at) * 1000, 2),
            }
            if error_type:
                record["error_type"] = error_type
            logger.info(json.dumps(record))
