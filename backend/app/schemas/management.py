from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


class AccountReference(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    phone: str | None = None


class ParentProfile(AccountReference):
    relationship: str | None = None


class CheckupView(BaseModel):
    session_id: str
    title: str
    checkup_date: date
    status: str
    height_cm: float | None
    weight_kg: float | None
    bmi: float | None
    vision: str | None
    notes: str | None
    updated_at: datetime


class ChildHealth(BaseModel):
    id: str
    full_name: str
    class_name: str
    date_of_birth: date | None = None
    relationship: str | None = None
    allergies: str | None
    medical_notes: str | None
    latest_checkup: CheckupView | None


class HealthRecord(ChildHealth):
    parents: list[AccountReference]
    nurse: AccountReference | None
    assignment_version: str


class ParentChild(ChildHealth):
    checkups: list[CheckupView]


class ParentOverview(BaseModel):
    parent: ParentProfile
    children: list[ParentChild]


class RecordPage(BaseModel):
    items: list[HealthRecord]
    total: int
    page: int
    page_size: int


class ClassOption(BaseModel):
    id: str
    name: str


class ManagementOptions(BaseModel):
    classes: list[ClassOption]
    parents: list[AccountReference]
    nurses: list[AccountReference]


ExistingId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class AssignmentWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: ExistingId
