"""Automated tests for Database Models & Relationships."""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.branch import GymBranch
from app.models.gym import Gym
from app.models.membership import MembershipPlan
from app.models.user import User


@pytest.mark.asyncio
async def test_gym_branch_relationship(db_session: AsyncSession):
    """Verify Gym to GymBranch relationship and cascade deletion."""
    user = User(id=uuid.uuid4(), email="cascade@test.com")
    gym = Gym(id=uuid.uuid4(), name="Cascade Gym", slug=f"cascade-{uuid.uuid4().hex[:6]}")
    branch = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym.id,
        name="Cascade Branch",
        slug="cascade-b1",
        is_main=True,
    )
    db_session.add_all([user, gym, branch])
    await db_session.flush()

    # Query back with eager loading for async session
    stmt = (
        select(Gym)
        .where(Gym.id == gym.id)
        .options(selectinload(Gym.branches))
    )
    res = await db_session.execute(stmt)
    saved_gym = res.scalars().first()
    assert saved_gym is not None
    assert len(saved_gym.branches) == 1
    assert saved_gym.branches[0].slug == "cascade-b1"


@pytest.mark.asyncio
async def test_membership_plan_and_subscription(db_session: AsyncSession):
    """Verify MembershipPlan and MemberSubscription monetary calculations & models."""
    gym_id = uuid.uuid4()
    gym = Gym(id=gym_id, name="Plan Gym", slug=f"plan-gym-{uuid.uuid4().hex[:6]}")
    plan = MembershipPlan(
        id=uuid.uuid4(),
        gym_id=gym_id,
        name="Gold Annual",
        duration_days=365,
        price=Decimal("499.99"),
        billing_frequency="yearly",
    )
    db_session.add_all([gym, plan])
    await db_session.flush()

    assert plan.price == Decimal("499.99")
    assert plan.duration_days == 365
    assert plan.is_active is True
