"""Closed contracts: no free-text fields or individual records are accepted."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Count = Annotated[int, Field(strict=True, ge=0, le=1_000_000)]
Metric = Literal["checkups_completed", "followups_pending"]
Action = Literal["checkup_planning", "followup_capacity", "data_review"]


class Aggregates(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total_students: Count
    checkups_completed: Count
    followups_pending: Count

    @model_validator(mode="after")
    def consistent_counts(self):
        if self.checkups_completed > self.total_students:
            raise ValueError("Completed checkups exceed total students")
        if self.followups_pending > self.checkups_completed:
            raise ValueError("Follow-up count cannot exceed completed checkups")
        return self


class DashboardSnapshot(BaseModel):
    aggregates: Aggregates
    session_title: str | None
    session_date: date | None


class InsightSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    highlights: list[Metric] = Field(min_length=1, max_length=2)
    recommendations: list[Action] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def unique_selections(self):
        if len(set(self.highlights)) != len(self.highlights) or len(set(self.recommendations)) != len(self.recommendations):
            raise ValueError("Duplicate selections")
        return self


class InsightResponse(BaseModel):
    summary: str
    recommendations: list[str]
    disclaimer: str
    aggregates: Aggregates
