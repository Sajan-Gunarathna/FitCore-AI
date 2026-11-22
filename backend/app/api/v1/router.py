"""API v1 root router — includes all v1 sub-routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, gyms, health, members, plans, subscriptions

api_v1_router = APIRouter()

api_v1_router.include_router(health.router, prefix="/health", tags=["Health"])
api_v1_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_v1_router.include_router(gyms.router, prefix="/gyms", tags=["Gyms"])
api_v1_router.include_router(
    members.router, prefix="/gyms/{gym_id}/members", tags=["Members"]
)
api_v1_router.include_router(
    plans.router,
    prefix="/gyms/{gym_id}/membership-plans",
    tags=["Membership Plans"],
)
api_v1_router.include_router(
    subscriptions.router,
    prefix="/gyms/{gym_id}/subscriptions",
    tags=["Subscriptions"],
)
