from datetime import date, datetime
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

    height_cm: float = Field(gt=0, allow_inf_nan=False)
    weight_kg: float = Field(gt=0, allow_inf_nan=False)
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
