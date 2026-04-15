import logging
import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# In-memory rate limiter (fallback when Redis is unavailable)
# For production, use Redis-based rate limiting
_requests: dict[str, list[float]] = {}

# Config: max requests per window per IP
RATE_LIMITS = {
    "/api/search": {"max": 100, "window": 60},  # 100 req/min
    "/api/documents/upload": {"max": 10, "window": 60},  # 10 req/min
    "default": {"max": 300, "window": 60},  # 300 req/min
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Find matching rate limit
        limit_config = RATE_LIMITS.get("default")
        for prefix, config in RATE_LIMITS.items():
            if prefix != "default" and path.startswith(prefix):
                limit_config = config
                break

        if limit_config:
            key = f"{client_ip}:{path}"
            now = time.time()
            window = limit_config["window"]
            max_req = limit_config["max"]

            # Clean old entries
            if key in _requests:
                _requests[key] = [
                    t for t in _requests[key] if now - t < window
                ]
            else:
                _requests[key] = []

            if len(_requests[key]) >= max_req:
                return Response(
                    content='{"detail":"Rate limit exceeded. Try again later."}',
                    status_code=429,
                    media_type="application/json",
                    headers={
                        "Retry-After": str(window),
                        "X-RateLimit-Limit": str(max_req),
                    },
                )

            _requests[key].append(now)

        response = await call_next(request)
        return response
