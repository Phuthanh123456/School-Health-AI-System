"""Response schemas for read-only checkup session endpoints."""

from datetime import date

from pydantic import BaseModel, ConfigDict


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    class_name: str


class CheckupSessionSummary(BaseModel):
    id: str
    title: str
    checkup_date: date
    class_name: str | None
    participant_count: int


class CheckupSessionDetail(CheckupSessionSummary):
    students: list[StudentSummary]
