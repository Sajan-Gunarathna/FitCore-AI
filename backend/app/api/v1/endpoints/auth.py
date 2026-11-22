"""Authentication & Profile endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.schemas.user import UserProfileResponse
from app.services.user_service import UserService

router = APIRouter()


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Get authenticated user profile",
)
async def get_my_profile(
    current_user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserProfileResponse:
    """
    Returns the authenticated user's profile, including their active
    gym affiliations, branches, and granted roles.
    """
    user_service = UserService(session)
    return await user_service.get_profile(current_user.id)
