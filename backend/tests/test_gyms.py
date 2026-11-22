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


@pytest.mark.asyncio
async def test_list_branches(client: AsyncClient, seed_data: dict):
    """Listing branches returns all branches belonging to authorized gym."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    headers = {**auth_header(owner_token), "X-Gym-ID": str(gym_id)}
    response = await client.get(f"/api/v1/gyms/{gym_id}/branches", headers=headers)
    assert response.status_code == 200
    branches = response.json()
    assert len(branches) >= 1
    assert branches[0]["slug"] == "downtown"
    assert branches[0]["is_main"] is True


@pytest.mark.asyncio
async def test_get_branch_detail(client: AsyncClient, seed_data: dict):
    """Retrieve detailed information for a single branch."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id
    branch_id = seed_data["branch_alpha"].id

    headers = {**auth_header(owner_token), "X-Gym-ID": str(gym_id)}
    response = await client.get(
        f"/api/v1/gyms/{gym_id}/branches/{branch_id}", headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(branch_id)
    assert data["name"] == "Alpha Downtown"


@pytest.mark.asyncio
async def test_update_branch(client: AsyncClient, seed_data: dict):
    """Gym admin/owner can update branch details."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id
    branch_id = seed_data["branch_alpha"].id

    payload = {
        "name": "Alpha Downtown Updated",
        "address": "789 Main Blvd",
        "phone": "+1 555-999-1234",
    }
    headers = {**auth_header(admin_token), "X-Gym-ID": str(gym_id)}
    response = await client.patch(
        f"/api/v1/gyms/{gym_id}/branches/{branch_id}", json=payload, headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Alpha Downtown Updated"
    assert data["address"] == "789 Main Blvd"
    assert data["phone"] == "+1 555-999-1234"


@pytest.mark.asyncio
async def test_cross_gym_branch_access_rejected(client: AsyncClient, seed_data: dict):
    """User in Gym A cannot access or update branch in Gym B."""
    owner_token = seed_data["tokens"]["owner"]
    gym_alpha_id = seed_data["gym_alpha"].id
    fake_branch_id = uuid.uuid4()

    # Non-existent or other gym's branch ID returns 404
    headers = {**auth_header(owner_token), "X-Gym-ID": str(gym_alpha_id)}
    response = await client.get(
        f"/api/v1/gyms/{gym_alpha_id}/branches/{fake_branch_id}", headers=headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_non_admin_cannot_update_branch(client: AsyncClient, seed_data: dict):
    """Member role cannot update branch details."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id
    branch_id = seed_data["branch_alpha"].id

    payload = {"name": "Hacked Branch"}
    headers = {**auth_header(member_token), "X-Gym-ID": str(gym_id)}
    response = await client.patch(
        f"/api/v1/gyms/{gym_id}/branches/{branch_id}", json=payload, headers=headers
    )
    assert response.status_code == 403
