"""Async SQLAlchemy engine, session factory, and transaction-scoped tenant context."""

import uuid
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Engine setup
engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


async def set_tenant_session_context(
    session: AsyncSession,
    gym_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    clear_gym_id: bool = False,
    clear_user_id: bool = False,
) -> None:
    """
    Set transaction-scoped PostgreSQL session configuration for RLS enforcement.
    Uses 'SET LOCAL' so variables automatically reset at the end of the transaction
    and never leak into subsequent connection-pool usages.
    """
    bind = session.bind or engine
    if bind.dialect.name == "postgresql":
        if gym_id is not None:
            await session.execute(
                text("SELECT set_config('app.current_gym_id', :gym_id, true)"),
                {"gym_id": str(gym_id)},
            )
        elif clear_gym_id:
            await session.execute(
                text("SELECT set_config('app.current_gym_id', '', true)")
            )

        if user_id is not None:
            await session.execute(
                text("SELECT set_config('app.current_user_id', :user_id, true)"),
                {"user_id": str(user_id)},
            )
        elif clear_user_id:
            await session.execute(
                text("SELECT set_config('app.current_user_id', '', true)")
            )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a managed database session per request."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
