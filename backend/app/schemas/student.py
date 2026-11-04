from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator


StudentName = Annotated[str, StringConstraints(min_length=1, max_length=200)]
ClassName = Annotated[str, StringConstraints(min_length=1, max_length=50)]
HealthText = Annotated[str, StringConstraints(max_length=2000)]
StudentId = Annotated[str, StringConstraints(
    min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$"
)]


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    class_name: str


class StudentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: StudentId
    full_name: StudentName
    class_name: ClassName
    allergies: HealthText | None = None
    medical_notes: HealthText | None = None


class StudentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    full_name: StudentName | None = None
    class_name: ClassName | None = None
    allergies: HealthText | None = None
    medical_notes: HealthText | None = None

    @field_validator("full_name", "class_name")
    @classmethod
    def require_text_when_provided(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class StudentProfile(StudentSummary):
    allergies: str | None
    medical_notes: str | None
