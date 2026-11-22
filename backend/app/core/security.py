"""JWT verification and security utilities supporting Supabase JWKS & symmetric tokens."""

import logging
import time
from typing import Any

import httpx
from fastapi import HTTPException, status
from jose import ExpiredSignatureError, JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory JWKS cache: {"keys": [...], "fetched_at": float}
_JWKS_CACHE: dict[str, Any] = {"keys": [], "fetched_at": 0.0}


async def get_supabase_jwks(force_refresh: bool = False) -> list[dict[str, Any]]:
    """Fetch and cache Supabase JWKS public keys with TTL."""
    global _JWKS_CACHE
    now = time.time()
    cache_age = now - _JWKS_CACHE["fetched_at"]

    if not force_refresh and _JWKS_CACHE["keys"] and cache_age < settings.jwks_cache_ttl_seconds:
        return _JWKS_CACHE["keys"]

    jwks_url = settings.jwks_url
    if not jwks_url:
        logger.debug("Supabase URL not configured; JWKS unavailable.")
        return []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(jwks_url)
            if response.status_code == 200:
                data = response.json()
                keys = data.get("keys", [])
                _JWKS_CACHE = {"keys": keys, "fetched_at": now}
                logger.info("Successfully fetched %d JWKS public keys from Supabase", len(keys))
                return keys
            else:
                logger.warning(
                    "Failed to fetch Supabase JWKS: HTTP %d %s",
                    response.status_code,
                    response.text,
                )
    except Exception as exc:
        logger.warning("Error contacting Supabase JWKS endpoint: %s", exc)

    return _JWKS_CACHE.get("keys", [])


def _find_jwk_key(keys: list[dict[str, Any]], kid: str | None) -> dict[str, Any] | None:
    if not kid:
        return keys[0] if len(keys) == 1 else None
    for key in keys:
        if key.get("kid") == kid:
            return key
    return None


async def verify_supabase_jwt(token: str) -> dict[str, Any]:
    """
    Verify a Supabase-issued JWT token.
    Supports asymmetric JWKS (RS256, ES256) and fallback symmetric (HS256) signing.
    Strictly verifies signature, expiration, audience, and issuer.
    """
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed authorization token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        logger.warning("Failed to parse JWT header: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    alg = unverified_header.get("alg", "HS256")
    kid = unverified_header.get("kid")

    decode_kwargs: dict[str, Any] = {
        "algorithms": [alg],
        "options": {
            "verify_signature": True,
            "verify_exp": True,
            "verify_aud": bool(settings.supabase_jwt_audience),
            "verify_iss": bool(settings.supabase_jwt_issuer),
        },
    }

    if settings.supabase_jwt_audience:
        decode_kwargs["audience"] = settings.supabase_jwt_audience

    if settings.supabase_jwt_issuer:
        decode_kwargs["issuer"] = settings.supabase_jwt_issuer

    # 1. Asymmetric verification (RS256, ES256) via JWKS
    if alg.startswith("RS") or alg.startswith("ES"):
        keys = await get_supabase_jwks()
        matching_key = _find_jwk_key(keys, kid)

        # Retry once with refreshed keys if key ID was not found
        if not matching_key:
            keys = await get_supabase_jwks(force_refresh=True)
            matching_key = _find_jwk_key(keys, kid)

        if not matching_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Public key not found for token verification.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload = jwt.decode(token, matching_key, **decode_kwargs)
            return payload
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None
        except JWTError as exc:
            logger.warning("Asymmetric JWT verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature or claims.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None

    # 2. Symmetric verification (HS256) via SUPABASE_JWT_SECRET
    elif alg == "HS256":
        secret = settings.supabase_jwt_secret
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service secret not configured for symmetric tokens.",
            )

        try:
            payload = jwt.decode(token, secret, **decode_kwargs)
            return payload
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None
        except JWTError as exc:
            logger.warning("Symmetric JWT verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature or claims.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from None

    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unsupported signing algorithm: {alg}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def extract_user_id(payload: dict[str, Any]) -> str:
    """Extract and validate the Supabase user UUID from verified JWT claims."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identifier (sub claim).",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(sub)
