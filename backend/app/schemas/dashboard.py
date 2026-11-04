"""Safe, school-level response contract for the Admin dashboard."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

Count = Annotated[int, Field(strict=True, ge=0, le=1_000_000)]


class CheckupStatusCounts(BaseModel):
    model_config = ConfigDict(extra="forbid")

    normal: Count
    needs_follow_up: Count


class SchoolHealthOverview(BaseModel):
    """Aggregate metrics only; no student-level information is returned."""

    model_config = ConfigDict(extra="forbid")

    total_students: Count
    completed_checkups: Count
    status_counts: CheckupStatusCounts

    @model_validator(mode="after")
    def completed_matches_status_counts(self):
        if self.completed_checkups != self.status_counts.normal + self.status_counts.needs_follow_up:
            raise ValueError("Completed checkups must equal the two reported status counts")
        return self
