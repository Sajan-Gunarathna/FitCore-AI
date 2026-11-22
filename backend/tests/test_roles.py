"""Automated tests for Role Assignment & Privilege Escalation Prevention."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_owner_assigns_trainer_role(client: AsyncClient, seed_data: dict):
    """Gym owner can assign trainer role to an existing or new user."""
    owner_token = seed_data["tokens"]["owner"]
    gym_id = seed_data["gym_alpha"].id

    payload = {
        "email": "newtrainer@gym-alpha.com",
        "role": "trainer",
        "full_name": "Coach Marcus",
    }
    headers = {**auth_header(owner_token), "X-Gym-ID": str(gym_id)}
    response = await client.post(
        f"/api/v1/gyms/{gym_id}/users", json=payload, headers=headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "trainer"
    assert data["user_email"] == "newtrainer@gym-alpha.com"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_admin_cannot_escalate_to_owner(client: AsyncClient, seed_data: dict):
    """Gym admin cannot assign the 'owner' role; only owners can grant owner."""
    admin_token = seed_data["tokens"]["admin"]
    gym_id = seed_data["gym_alpha"].id

    payload = {
        "email": "candidate@gym-alpha.com",
        "role": "owner",
        "full_name": "Wannabe Owner",
    }
    headers = {**auth_header(admin_token), "X-Gym-ID": str(gym_id)}
    response = await client.post(
        f"/api/v1/gyms/{gym_id}/users", json=payload, headers=headers
    )
    assert response.status_code == 403
    assert "only gym owners" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_member_cannot_assign_roles(client: AsyncClient, seed_data: dict):
    """A regular member cannot assign any roles (fails closed with 403)."""
    member_token = seed_data["tokens"]["member"]
    gym_id = seed_data["gym_alpha"].id

    payload = {
        "email": "friend@gym-alpha.com",
        "role": "member",
    }
    headers = {**auth_header(member_token), "X-Gym-ID": str(gym_id)}
    response = await client.post(
        f"/api/v1/gyms/{gym_id}/users", json=payload, headers=headers
    )
    assert response.status_code == 403
    assert "insufficient permissions" in response.json()["detail"].lower()
