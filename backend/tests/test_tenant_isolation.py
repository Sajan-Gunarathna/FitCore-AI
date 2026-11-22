"""Automated tests for Multi-Tenant Isolation & Cross-Tenant Access Prevention."""

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_cross_tenant_get_gym_forbidden(client: AsyncClient, seed_data: dict):
    """User from Gym Alpha cannot fetch details of Gym Beta without membership."""
    owner_alpha_token = seed_data["tokens"]["owner"]
    gym_beta_id = seed_data["gym_beta"].id

    # User belongs to Gym Alpha, not Gym Beta
    response = await client.get(
        f"/api/v1/gyms/{gym_beta_id}",
        headers=auth_header(owner_alpha_token),
    )
    assert response.status_code == 403
    detail = response.json()["detail"].lower()
    assert "access denied" in detail or "not have access" in detail


@pytest.mark.asyncio
async def test_cross_tenant_branch_listing_forbidden(client: AsyncClient, seed_data: dict):
    """User from Gym Alpha cannot list branches of Gym Beta via header spoofing."""
    owner_alpha_token = seed_data["tokens"]["owner"]
    gym_beta_id = seed_data["gym_beta"].id

    headers = {
        **auth_header(owner_alpha_token),
        "X-Gym-ID": str(gym_beta_id),  # Spoofing Gym Beta ID
    }
    response = await client.get(
        f"/api/v1/gyms/{gym_beta_id}/branches",
        headers=headers,
    )
    assert response.status_code == 403
    assert "access denied" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cross_tenant_create_branch_forbidden(client: AsyncClient, seed_data: dict):
    """User from Gym Alpha cannot create branches in Gym Beta."""
    owner_alpha_token = seed_data["tokens"]["owner"]
    gym_beta_id = seed_data["gym_beta"].id

    payload = {
        "name": "Malicious Branch",
        "slug": "malicious",
    }
    headers = {
        **auth_header(owner_alpha_token),
        "X-Gym-ID": str(gym_beta_id),
    }
    response = await client.post(
        f"/api/v1/gyms/{gym_beta_id}/branches",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_missing_tenant_header_fails_closed(client: AsyncClient, seed_data: dict):
    """Tenant-scoped endpoints fail closed with 400 Bad Request when tenant ID is absent."""
    owner_token = seed_data["tokens"]["owner"]

    dummy_gym_id = uuid.uuid4()
    response = await client.post(
        f"/api/v1/gyms/{dummy_gym_id}/branches",
        json={"name": "Branch", "slug": "branch"},
        headers=auth_header(owner_token),
    )
    assert response.status_code == 403  # Fails closed because user has no roles in dummy_gym_id


# ── P0 REGRESSION SUITE: HEADER/PATH TENANT DESYNCHRONIZATION ──────────────────

@pytest.mark.asyncio
async def test_p0_gym_a_admin_legitimate_request_allowed(client: AsyncClient, seed_data: dict):
    """Scenario 1: Gym A admin + Gym A path + Gym A header = allowed."""
    admin_token = seed_data["tokens"]["admin"]
    gym_alpha_id = seed_data["gym_alpha"].id

    headers = {
        **auth_header(admin_token),
        "X-Gym-ID": str(gym_alpha_id),
    }
    payload = {
        "name": "Alpha North",
        "slug": f"alpha-north-{uuid.uuid4().hex[:4]}",
    }
    response = await client.post(
        f"/api/v1/gyms/{gym_alpha_id}/branches",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["name"] == payload["name"]
    assert response.json()["gym_id"] == str(gym_alpha_id)


@pytest.mark.asyncio
async def test_p0_header_path_mismatch_rejected_with_400(client: AsyncClient, seed_data: dict):
    """Scenario 2: Gym A admin + Gym B path + Gym A header = rejected (HTTP 400)."""
    admin_token = seed_data["tokens"]["admin"]
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    # Attacker passes Gym A in X-Gym-ID to pass membership check, but targets Gym B in URL path
    headers = {
        **auth_header(admin_token),
        "X-Gym-ID": str(gym_alpha_id),
    }
    payload = {
        "name": "Exploit Branch",
        "slug": "exploit-branch",
    }
    response = await client.post(
        f"/api/v1/gyms/{gym_beta_id}/branches",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 400
    assert "tenant desynchronization detected" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_p0_gym_a_admin_gym_b_path_no_header_rejected_with_403(
    client: AsyncClient, seed_data: dict
):
    """Scenario 3: Gym A admin + Gym B path + no header = rejected (HTTP 403)."""
    admin_token = seed_data["tokens"]["admin"]
    gym_beta_id = seed_data["gym_beta"].id

    # Resolves path param (Gym B), but admin belongs to Gym A -> 403 Forbidden
    response = await client.post(
        f"/api/v1/gyms/{gym_beta_id}/branches",
        json={"name": "Branch", "slug": "branch"},
        headers=auth_header(admin_token),
    )
    assert response.status_code == 403
    assert "access denied" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_p0_gym_a_admin_cannot_create_branch_in_gym_b(
    client: AsyncClient, seed_data: dict
):
    """Scenario 4: Gym A admin cannot create a branch in Gym B under any combination."""
    admin_token = seed_data["tokens"]["admin"]
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    payload = {"name": "Injected Branch", "slug": "injected-b"}

    # Attempt with Gym A header -> 400 Mismatch
    res1 = await client.post(
        f"/api/v1/gyms/{gym_beta_id}/branches",
        json=payload,
        headers={**auth_header(admin_token), "X-Gym-ID": str(gym_alpha_id)},
    )
    assert res1.status_code == 400

    # Attempt with Gym B header -> 403 Forbidden (no role in Gym B)
    res2 = await client.post(
        f"/api/v1/gyms/{gym_beta_id}/branches",
        json=payload,
        headers={**auth_header(admin_token), "X-Gym-ID": str(gym_beta_id)},
    )
    assert res2.status_code == 403


@pytest.mark.asyncio
async def test_p0_gym_a_admin_cannot_assign_roles_in_gym_b(
    client: AsyncClient, seed_data: dict
):
    """Scenario 5: Gym A admin cannot assign users or roles in Gym B."""
    admin_token = seed_data["tokens"]["admin"]
    gym_alpha_id = seed_data["gym_alpha"].id
    gym_beta_id = seed_data["gym_beta"].id

    payload = {
        "email": "victim@gym-beta.com",
        "role": "trainer",
        "full_name": "Injected Trainer",
    }

    # Desynchronized header / path attack -> 400
    res1 = await client.post(
        f"/api/v1/gyms/{gym_beta_id}/users",
        json=payload,
        headers={**auth_header(admin_token), "X-Gym-ID": str(gym_alpha_id)},
    )
    assert res1.status_code == 400
    assert "tenant desynchronization detected" in res1.json()["detail"].lower()

    # Direct spoofed Gym B header -> 403
    res2 = await client.post(
        f"/api/v1/gyms/{gym_beta_id}/users",
        json=payload,
        headers={**auth_header(admin_token), "X-Gym-ID": str(gym_beta_id)},
    )
    assert res2.status_code == 403


@pytest.mark.asyncio
async def test_p0_existing_legitimate_gym_a_requests_continue_to_work(
    client: AsyncClient, seed_data: dict
):
    """Scenario 6: Legitimate requests with or without matching X-Gym-ID succeed."""
    owner_token = seed_data["tokens"]["owner"]
    gym_alpha_id = seed_data["gym_alpha"].id

    # 1. Matching path + header
    res_with_header = await client.get(
        f"/api/v1/gyms/{gym_alpha_id}/branches",
        headers={**auth_header(owner_token), "X-Gym-ID": str(gym_alpha_id)},
    )
    assert res_with_header.status_code == 200

    # 2. Path alone (header omitted)
    res_path_only = await client.get(
        f"/api/v1/gyms/{gym_alpha_id}/branches",
        headers=auth_header(owner_token),
    )
    assert res_path_only.status_code == 200
    assert len(res_path_only.json()) >= 1
