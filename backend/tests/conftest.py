"""Pytest fixtures for FitCore AI backend.

Sets up an in-memory SQLite database via aiosqlite for isolated test runs,
overrides FastAPI dependencies, and provides JWT helper generators.
"""

import time
import uuid
from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models.branch import GymBranch
from app.models.gym import Gym
from app.models.role import GymUserRole, UserRole
from app.models.user import User

# Test secret for symmetric HMAC signing in tests
TEST_JWT_SECRET = "fitcore-super-secret-test-key-32-chars-long!"
TEST_AUDIENCE = "authenticated"

# Configure test environment settings
settings.supabase_jwt_secret = TEST_JWT_SECRET
settings.supabase_jwt_audience = TEST_AUDIENCE
settings.supabase_jwt_issuer = ""

# In-memory SQLite async engine
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(autouse=True)
async def prepare_database(request):
    """Create SQLite tables before each unit test; skipped for integration tests."""
    if "integration" in request.keywords:
        yield
        return
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session per test with clean isolation."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test client with get_db overridden to use test database session."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


def make_jwt(
    user_id: uuid.UUID,
    email: str = "user@test.fitcore.ai",
    expires_in: int = 3600,
    audience: str = TEST_AUDIENCE,
    secret: str = TEST_JWT_SECRET,
    algorithm: str = "HS256",
) -> str:
    """Helper to generate JWT tokens for testing."""
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "aud": audience,
        "exp": now + expires_in,
        "iat": now,
        "user_metadata": {"full_name": "Test User"},
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def seed_data(db_session: AsyncSession):
    """Seed initial users, gyms, branches, and roles for testing."""
    # 1. Users
    owner_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    member_id = uuid.uuid4()
    stranger_id = uuid.uuid4()

    owner = User(id=owner_id, email="owner@gym-alpha.com", full_name="Gym Owner")
    admin = User(id=admin_id, email="admin@gym-alpha.com", full_name="Gym Admin")
    member = User(id=member_id, email="member@gym-alpha.com", full_name="Gym Member")
    stranger = User(id=stranger_id, email="stranger@gym-beta.com", full_name="Gym Stranger")

    db_session.add_all([owner, admin, member, stranger])
    await db_session.flush()

    # 2. Gym Alpha (Owned by owner)
    gym_alpha_id = uuid.uuid4()
    gym_alpha = Gym(
        id=gym_alpha_id,
        name="FitCore Alpha Gym",
        slug="alpha-gym",
        created_by=owner_id,
        is_active=True,
    )
    db_session.add(gym_alpha)
    await db_session.flush()

    # 3. Roles in Gym Alpha
    role_owner = GymUserRole(
        id=uuid.uuid4(), gym_id=gym_alpha_id, user_id=owner_id, role=UserRole.OWNER.value
    )
    role_admin = GymUserRole(
        id=uuid.uuid4(), gym_id=gym_alpha_id, user_id=admin_id, role=UserRole.ADMIN.value
    )
    role_member = GymUserRole(
        id=uuid.uuid4(), gym_id=gym_alpha_id, user_id=member_id, role=UserRole.MEMBER.value
    )
    db_session.add_all([role_owner, role_admin, role_member])

    # 4. Main Branch in Gym Alpha
    branch_alpha = GymBranch(
        id=uuid.uuid4(),
        gym_id=gym_alpha_id,
        name="Alpha Downtown",
        slug="downtown",
        is_main=True,
        is_active=True,
    )
    db_session.add(branch_alpha)

    # 5. Gym Beta (Owned by stranger)
    gym_beta_id = uuid.uuid4()
    gym_beta = Gym(
        id=gym_beta_id,
        name="FitCore Beta Gym",
        slug="beta-gym",
        created_by=stranger_id,
        is_active=True,
    )
    db_session.add(gym_beta)
    await db_session.flush()

    role_stranger = GymUserRole(
        id=uuid.uuid4(), gym_id=gym_beta_id, user_id=stranger_id, role=UserRole.OWNER.value
    )
    db_session.add(role_stranger)

    await db_session.commit()

    return {
        "owner": owner,
        "admin": admin,
        "member": member,
        "stranger": stranger,
        "gym_alpha": gym_alpha,
        "gym_beta": gym_beta,
        "branch_alpha": branch_alpha,
        "tokens": {
            "owner": make_jwt(owner_id, email=owner.email),
            "admin": make_jwt(admin_id, email=admin.email),
            "member": make_jwt(member_id, email=member.email),
            "stranger": make_jwt(stranger_id, email=stranger.email),
        },
    }
