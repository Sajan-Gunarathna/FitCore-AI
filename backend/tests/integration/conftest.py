"""Pytest fixtures for live PostgreSQL integration tests.

Connects to a live PostgreSQL test database (local or via TEST_DATABASE_URL).
Ensures tests never target production by validating the connection string.
Provides both privileged (postgres) and unprivileged (fitcore_test_user) sessions.
"""

import os
import subprocess
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

PRODUCTION_HOST_SUBSTRINGS = ["supabase.co", "pooler.supabase.com", "supabase.in", "aws.neon.tech"]


def get_default_test_url(role: str = "postgres", password: str = "postgres") -> str:
    """Retrieve WSL IP or localhost for local PostgreSQL test database."""
    env_url = os.getenv("TEST_DATABASE_URL")
    if env_url:
        for bad_host in PRODUCTION_HOST_SUBSTRINGS:
            if bad_host in env_url.lower():
                raise ValueError(
                    f"CRITICAL SAFETY CHECK: TEST_DATABASE_URL targets production ({bad_host}). "
                    "Testing against production is strictly prohibited."
                )
        return env_url

    # Automatic discovery of local PostgreSQL in WSL2
    try:
        wsl_out = subprocess.check_output(
            ["wsl", "-d", "Ubuntu", "--", "hostname", "-I"],
            text=True,
            timeout=5,
        )
        host = wsl_out.strip().split()[0]
    except Exception:
        host = "127.0.0.1"

    return f"postgresql+asyncpg://{role}:{password}@{host}:5432/fitcore_test"


@pytest.fixture
def admin_db_url() -> str:
    return get_default_test_url(role="postgres", password="postgres")


@pytest.fixture
def user_db_url() -> str:
    return get_default_test_url(role="fitcore_test_user", password="testpass")


@pytest_asyncio.fixture
async def pg_admin_engine(admin_db_url: str) -> AsyncGenerator[AsyncEngine, None]:
    """Yield a privileged AsyncEngine (superuser) for seeding and schema inspection."""
    engine = create_async_engine(admin_db_url, echo=False, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"Could not connect to PostgreSQL superuser: {exc}")
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def pg_user_engine(user_db_url: str) -> AsyncGenerator[AsyncEngine, None]:
    """Yield an unprivileged AsyncEngine (fitcore_test_user) for genuine RLS verification."""
    engine = create_async_engine(user_db_url, echo=False, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        pytest.skip(f"Could not connect to PostgreSQL unprivileged user: {exc}")
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def admin_session(pg_admin_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Yield an isolated transaction-managed AsyncSession under superuser for data seeding."""
    session_factory = async_sessionmaker(
        pg_admin_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def user_session(pg_user_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Yield an isolated transaction-managed AsyncSession under unprivileged role for RLS tests."""
    session_factory = async_sessionmaker(
        pg_user_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_factory() as session:
        yield session
        await session.rollback()
