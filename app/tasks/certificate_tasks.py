"""Celery tasks for asynchronous certificate generation."""

import logging

from app.database import SessionLocal
from app.services.certificate_service import CertificateService
from app.services.job_service import JobService
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="certifyhub.process_job", bind=True, max_retries=0)
def process_job(self, job_id: int) -> dict:
    """
    Process every certificate in a job.

    Failures are isolated: one bad recipient does not stop the rest.
    """
    db = SessionLocal()
    try:
        job_service = JobService(db)
        cert_service = CertificateService(db)

        job_service.mark_processing(job_id)
        job = job_service.get_with_certificates(job_id)
        certificate_ids = [cert.id for cert in job.certificates]

        logger.info("Processing job %s with %s certificates", job_id, len(certificate_ids))

        for certificate_id in certificate_ids:
            try:
                cert_service.generate_pdf(certificate_id)
            except Exception:  # noqa: BLE001
                logger.exception(
                    "Unexpected error generating certificate %s for job %s",
                    certificate_id,
                    job_id,
                )

        job = job_service.refresh_progress(job_id)
        return {
            "job_id": job.id,
            "status": job.status,
            "completed_count": job.completed_count,
            "failed_count": job.failed_count,
            "total_count": job.total_count,
        }
    finally:
        db.close()
