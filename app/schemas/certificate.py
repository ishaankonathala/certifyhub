"""Certificate schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CertificateResponse(BaseModel):
    """Certificate metadata returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    recipient_name: str
    recipient_email: str
    certificate_code: str
    status: str
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
    download_url: str | None = None
