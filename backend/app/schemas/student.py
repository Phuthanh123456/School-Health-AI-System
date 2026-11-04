from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


StudentName = Annotated[str, StringConstraints(min_length=1, max_length=200)]
ClassName = Annotated[str, StringConstraints(min_length=1, max_length=50)]
HealthText = Annotated[str, StringConstraints(max_length=2000)]
StudentId = Annotated[str, StringConstraints(
    min_length=1, max_length=50, pattern=r"^[A-Za-z0-9]+$"
)]
VisionValue = Annotated[str, StringConstraints(max_length=100)]
CheckupStatus = Literal["completed", "follow_up", "pending", "absent"]


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    class_name: str
    parentid: str | None = None
    nurseid: str | None = None


class StudentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: StudentId
    full_name: StudentName
    class_name: ClassName
    allergies: HealthText | None = None
    medical_notes: HealthText | None = None
    parentid: ClassName
    nurseid: ClassName


class StudentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: StudentName | None = None
    class_name: ClassName | None = None
    allergies: HealthText | None = None
    medical_notes: HealthText | None = None
    parentid: ClassName | None = None
    nurseid: ClassName | None = None

    @field_validator("full_name", "class_name", "parentid", "nurseid")
    @classmethod
    def require_text_when_provided(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class StudentProfile(StudentSummary):
    allergies: str | None
    medical_notes: str | None


class CheckupSessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    checkup_date: date


class CheckupResultInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    status: CheckupStatus = "completed"
    height_cm: Annotated[float, Field(gt=0, le=300)] | None = None
    weight_kg: Annotated[float, Field(gt=0, le=500)] | None = None
    vision_left: VisionValue | None = None
    vision_right: VisionValue | None = None
    notes: HealthText | None = None


class CheckupRosterItem(StudentSummary):
    allergies: str | None = None
    medical_notes: str | None = None
    status: CheckupStatus
    height_cm: float | None = None
    weight_kg: float | None = None
    bmi: float | None = None
    vision_left: str | None = None
    vision_right: str | None = None
    notes: str | None = None
