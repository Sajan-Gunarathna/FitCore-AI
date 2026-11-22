"""Automated tests for Authentication & JWT verification."""

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header, make_jwt


@pytest.mark.asyncio
async def test_missing_authentication(client: AsyncClient):
    """Endpoints requiring authentication must return 401/403 when no token is passed."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_valid_jwt_authenticates(client: AsyncClient, seed_data: dict):
    """A valid JWT must successfully authenticate and return 200."""
    token = seed_data["tokens"]["owner"]
    response = await client.get("/api/v1/auth/me", headers=auth_header(token))
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "owner@gym-alpha.com"
    assert data["full_name"] == "Gym Owner"
    assert len(data["gyms"]) >= 1
    assert data["gyms"][0]["role"] == "owner"


@pytest.mark.asyncio
async def test_invalid_jwt_signature(client: AsyncClient):
    """A token with an invalid signature must be rejected with 401."""
    tampered_token = make_jwt(
        user_id=uuid.uuid4(),
        secret="completely-wrong-tampered-signature-key!",
    )
    response = await client.get("/api/v1/auth/me", headers=auth_header(tampered_token))
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]


@pytest.mark.asyncio
async def test_expired_jwt(client: AsyncClient):
    """An expired token must return 401 Token has expired."""
    expired_token = make_jwt(
        user_id=uuid.uuid4(),
        expires_in=-300,  # Expired 5 minutes ago
    )
    response = await client.get("/api/v1/auth/me", headers=auth_header(expired_token))
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_audience(client: AsyncClient):
    """A token with an unexpected audience claim must return 401."""
    bad_aud_token = make_jwt(
        user_id=uuid.uuid4(),
        audience="wrong-audience-scope",
    )
    response = await client.get("/api/v1/auth/me", headers=auth_header(bad_aud_token))
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_auto_provision_user_profile(client: AsyncClient):
    """First-time authenticating user is automatically provisioned in users table."""
    new_user_id = uuid.uuid4()
    new_token = make_jwt(
        user_id=new_user_id,
        email="newuser@example.com",
    )
    response = await client.get("/api/v1/auth/me", headers=auth_header(new_token))
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["id"] == str(new_user_id)
    assert data["gyms"] == []
