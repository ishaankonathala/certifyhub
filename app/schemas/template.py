"""Template schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TemplateCreate(BaseModel):
    """Payload for creating a certificate template."""

    name: str = Field(..., min_length=1, max_length=150, examples=["completion-2026"])
    title: str = Field(..., min_length=1, max_length=255, examples=["Certificate of Completion"])
    body_text: str = Field(
        ...,
        min_length=1,
        examples=["has successfully completed the Backend Engineering Internship Program."],
    )
    issuer_name: str = Field(..., min_length=1, max_length=150, examples=["CertifyHub Academy"])


class TemplateResponse(BaseModel):
    """Template returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    title: str
    body_text: str
    issuer_name: str
    created_at: datetime
