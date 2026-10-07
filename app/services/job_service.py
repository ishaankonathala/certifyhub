"""Job orchestration business logic."""

import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.models.certificate import Certificate
from app.models.job import Job
from app.schemas.job import JobCreate
from app.services.template_service import TemplateNotFoundError, TemplateService


class JobNotFoundError(Exception):
    """Raised when a job does not exist."""


class JobService:
    """Create jobs and track generation progress."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.templates = TemplateService(db)

    def create(self, payload: JobCreate) -> Job:
        """Create a pending job and certificate rows in one transaction."""
        self.templates.get(payload.template_id)

        job = Job(
            template_id=payload.template_id,
            status="pending",
            total_count=len(payload.recipients),
            completed_count=0,
            failed_count=0,
        )
        self.db.add(job)
        self.db.flush()

        for recipient in payload.recipients:
            certificate = Certificate(
                job_id=job.id,
                recipient_name=recipient.name.strip(),
                recipient_email=str(recipient.email).lower(),
                certificate_code=self._generate_code(),
                status="pending",
            )
            self.db.add(certificate)

        self.db.commit()
        self.db.refresh(job)
        return job

    def get(self, job_id: int) -> Job:
        job = self.db.get(Job, job_id)
        if job is None:
            raise JobNotFoundError(f"Job {job_id} not found")
        return job

    def list_all(self) -> list[Job]:
        return self.db.query(Job).order_by(Job.created_at.desc()).all()

    def get_with_certificates(self, job_id: int) -> Job:
        job = (
            self.db.query(Job)
            .options(joinedload(Job.certificates))
            .filter(Job.id == job_id)
            .first()
        )
        if job is None:
            raise JobNotFoundError(f"Job {job_id} not found")
        return job

    def mark_processing(self, job_id: int) -> Job:
        job = self.get(job_id)
        job.status = "processing"
        job.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(job)
        return job

    def refresh_progress(self, job_id: int) -> Job:
        """Recompute counters and derive terminal status from certificate rows."""
        job = self.get_with_certificates(job_id)

        completed = sum(1 for cert in job.certificates if cert.status == "completed")
        failed = sum(1 for cert in job.certificates if cert.status == "failed")
        pending = sum(1 for cert in job.certificates if cert.status in {"pending", "processing"})

        job.completed_count = completed
        job.failed_count = failed
        job.updated_at = datetime.now(timezone.utc)

        if pending > 0:
            job.status = "processing"
        elif failed == 0:
            job.status = "completed"
        elif completed == 0:
            job.status = "failed"
        else:
            job.status = "partial"

        self.db.commit()
        self.db.refresh(job)
        return job

    @staticmethod
    def progress_percent(job: Job) -> float:
        if job.total_count == 0:
            return 0.0
        done = job.completed_count + job.failed_count
        return round((done / job.total_count) * 100, 2)

    @staticmethod
    def _generate_code() -> str:
        return f"CH-{secrets.token_hex(6).upper()}"
