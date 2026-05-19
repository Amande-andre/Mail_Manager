from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class EmailItem(BaseModel):
    id: str
    threadId: str | None = None
    sender: str = ""
    subject: str = ""
    date: str = ""
    snippet: str = ""


class FilterSortRequest(BaseModel):
    instructions: str = Field(min_length=1)
    emails: list[EmailItem]


class FilterSortResponse(BaseModel):
    keep_ids: list[str]
    ordered_ids: list[str]
    summary: str = ""
    raw: dict[str, Any] = Field(default_factory=dict)
