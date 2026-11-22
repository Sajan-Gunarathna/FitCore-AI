"""Automated tests for Gym Registration & Branch Management."""

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header, make_jwt


@pytest.mark.asyncio
async def test_gym_registration_atomic_success(client: AsyncClient):
    """Gym registration creates gym, auto-assigns owner role, and creates main branch."""
    creator_id = uuid.uuid4()
    token = make_jwt(user_id=creator_id, email="founder@ironpulse.com")

    payload = {
        "name": "Iron Pulse Fitness",
        "slug": f"iron-pulse-{uuid.uuid4().hex[:6]}",
        "description": "Elite strength & conditioning center",
    }
    response = await client.post("/api/v1/gyms", json=payload, headers=auth_header(token))
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["slug"] == payload["slug"]
    assert "owner" in data["current_user_roles"]
    assert len(data["branches"]) == 1
    assert data["branches"][0]["is_main"] is True


@pytest.mark.asyncio
async def test_duplicate_gym_slug_conflict(client: AsyncClient, seed_data: dict):
    """Registering a gym with an existing slug must return 409 Conflict."""
    token = seed_data["tokens"]["owner"]
    payload = {
        "name": "Duplicate Slug Gym",
        "slug": "alpha-gym",  # Already taken by gym_alpha
    }
    response = await client.post("/api/v1/gyms", json=payload, headers=auth_header(token))
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_accessible_gyms(client: AsyncClient, seed_data: dict):
    """Listing gyms returns only gyms the user has an active role in."""
    owner_token = seed_data["tokens"]["owner"]
    response = await client.get("/api/v1/gyms", headers=auth_header(owner_token))
    assert response.status_code == 200
    gyms = response.json()
    slugs = [g["slug"] for g in gyms]
    assert "alpha-gym" in slugs
    assert "beta-gym" not in slugs  # Belongs to stranger


@pytest.mark.asyncio
async def test_create_branch_success(client: AsyncClient, seed_data: dict):
    """Gym owner can create a branch in their gym."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    payload = {
        "name": "Alpha Westside",
        "slug": "westside",
        "address": "456 West Blvd",
        "is_main": False,
    }
    headers = {**auth_header(owner_token), "X-Gym-ID": str(gym_id)}
    response = await client.post(
        f"/api/v1/gyms/{gym_id}/branches", json=payload, headers=headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alpha Westside"
    assert data["slug"] == "westside"
    assert data["gym_id"] == str(gym_id)


@pytest.mark.asyncio
async def test_create_duplicate_branch_slug_conflict(client: AsyncClient, seed_data: dict):
    """Creating a duplicate branch slug in the same gym returns 409 Conflict."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    payload = {
        "name": "Another Downtown",
        "slug": "downtown",  # Already exists in seed_data
    }
    headers = {**auth_header(owner_token), "X-Gym-ID": str(gym_id)}
    response = await client.post(
        f"/api/v1/gyms/{gym_id}/branches", json=payload, headers=headers
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()
