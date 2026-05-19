from __future__ import annotations

from typing import List, Dict, Any

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
    emails: List[EmailItem]


class FilterSortResponse(BaseModel):
    keep_ids: List[str]
    ordered_ids: List[str]
    summary: str = ""
    raw: Dict[str, Any] = Field(default_factory=dict)
