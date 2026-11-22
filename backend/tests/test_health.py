"""Smoke test: health-check endpoint."""

import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["service"] == "FitCore AI API"
    assert "version" in body
    assert "uptime_seconds" in body
