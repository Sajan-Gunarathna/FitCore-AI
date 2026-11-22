"""Dashboard and Analytics Pydantic v2 schemas."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class DashboardKpis(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_members: int
    active_members: int
    active_subscriptions: int
    expiring_subscriptions: int
    total_trainers: int
    total_branches: int


class RecentMemberSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    member_code: str
    full_name: str | None = None
    email: str
    status: str
    joined_at: datetime


class UpcomingExpirationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    member_id: uuid.UUID
    member_code: str
    full_name: str | None = None
    email: str
    plan_name: str
    end_date: date
    status: str


class RegistrationTrendPoint(BaseModel):
    period: str
    count: int


class StatusDistributionPoint(BaseModel):
    status: str
    count: int


class BranchSummaryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    is_main: bool
    is_active: bool
    member_count: int


class DashboardSummaryResponse(BaseModel):
    gym_id: uuid.UUID
    gym_name: str
    kpis: DashboardKpis
    recent_members: list[RecentMemberSummary]
    upcoming_expirations: list[UpcomingExpirationSummary]
    registration_trend: list[RegistrationTrendPoint]
    status_distribution: list[StatusDistributionPoint]
    branches: list[BranchSummaryItem]
