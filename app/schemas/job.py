"""Job schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RecipientInput(BaseModel):
    """A single certificate recipient."""

    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr


class JobCreate(BaseModel):
    """Payload for submitting a bulk generation job."""

    template_id: int = Field(..., gt=0)
    recipients: list[RecipientInput] = Field(..., min_length=1, max_length=500)


class JobResponse(BaseModel):
    """Response after creating a job."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    status: str
    total_count: int
    completed_count: int
    failed_count: int
    created_at: datetime
    message: str = "Job accepted and queued for processing"


class JobStatusResponse(BaseModel):
    """Detailed job progress."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    status: str
    total_count: int
    completed_count: int
    failed_count: int
    progress_percent: float
    created_at: datetime
    updated_at: datetime
