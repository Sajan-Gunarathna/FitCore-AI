"""Health-check endpoint."""

import time
from typing import Dict, Any

from fastapi import APIRouter

router = APIRouter()

_START_TIME = time.time()


@router.get("", summary="Health check")
async def health_check() -> Dict[str, Any]:
    """
    Returns service health status and basic metadata.
    Used by load-balancers, monitoring tools and CI smoke-tests.
    """
    return {
        "status": "healthy",
        "service": "FitCore AI API",
        "version": "0.1.0",
        "uptime_seconds": round(time.time() - _START_TIME, 2),
    }
