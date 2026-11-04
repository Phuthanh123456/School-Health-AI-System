from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


FollowUpStatus = Literal["Normal", "Needs Follow-up"]


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    checkup_date: date
    class_name: str | None
    participant_count: int


class StudentRead(BaseModel):
    id: str
    student_code: str
    full_name: str
    class_name: str


class SessionDetailRead(SessionRead):
    students: list[StudentRead]


class ResultWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Match NUMERIC(5, 1) / NUMERIC(4, 1); reject values the DB would round.
    height_cm: Decimal = Field(gt=0, le=Decimal("9999.9"), max_digits=5, decimal_places=1, allow_inf_nan=False)
    weight_kg: Decimal = Field(gt=0, le=Decimal("999.9"), max_digits=4, decimal_places=1, allow_inf_nan=False)
    vision: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=5000)
    status: FollowUpStatus


class ResultRead(BaseModel):
    session_id: str
    student_id: str
    height_cm: float
    weight_kg: float
    bmi: float
    vision: str | None
    notes: str | None
    status: FollowUpStatus
    created_at: datetime | None = None
    updated_at: datetime | None = None
