"""Job endpoints."""

import io
import logging
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.schemas.certificate import CertificateResponse
from app.schemas.job import JobCreate, JobResponse, JobStatusResponse
from app.services.certificate_service import CertificateService
from app.services.job_service import JobNotFoundError, JobService
from app.services.template_service import TemplateNotFoundError
from app.tasks.certificate_tasks import process_job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["Jobs"])
settings = get_settings()


def _enqueue_job(job_id: int) -> None:
    """Queue Celery task; process inline if the broker is unavailable."""
    try:
        process_job.delay(job_id)
    except Exception as exc:  # noqa: BLE001 - local/dev fallback when Redis is down
        logger.warning(
            "Celery broker unavailable (%s); processing job %s inline",
            exc,
            job_id,
        )
        process_job(job_id)


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a bulk certificate generation job",
)
def create_job(payload: JobCreate, db: Session = Depends(get_db)) -> JobResponse:
    service = JobService(db)
    try:
        job = service.create(payload)
    except TemplateNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    _enqueue_job(job.id)

    return JobResponse(
        id=job.id,
        template_id=job.template_id,
        status=job.status,
        total_count=job.total_count,
        completed_count=job.completed_count,
        failed_count=job.failed_count,
        created_at=job.created_at,
        message="Job accepted and queued for processing",
    )


@router.get(
    "",
    response_model=list[JobStatusResponse],
    summary="List all certificate generation jobs",
)
def list_jobs(db: Session = Depends(get_db)) -> list[JobStatusResponse]:
    service = JobService(db)
    jobs = service.list_all()
    return [
        JobStatusResponse(
            id=job.id,
            template_id=job.template_id,
            status=job.status,
            total_count=job.total_count,
            completed_count=job.completed_count,
            failed_count=job.failed_count,
            progress_percent=JobService.progress_percent(job),
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
        for job in jobs
    ]


@router.get(
    "/{job_id}",
    response_model=JobStatusResponse,
    summary="Get job status and progress",
)
def get_job_status(job_id: int, db: Session = Depends(get_db)) -> JobStatusResponse:
    service = JobService(db)
    try:
        job = service.get(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return JobStatusResponse(
        id=job.id,
        template_id=job.template_id,
        status=job.status,
        total_count=job.total_count,
        completed_count=job.completed_count,
        failed_count=job.failed_count,
        progress_percent=JobService.progress_percent(job),
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


@router.get(
    "/{job_id}/certificates",
    response_model=list[CertificateResponse],
    summary="List certificates for a job",
)
def list_job_certificates(
    job_id: int, db: Session = Depends(get_db)
) -> list[CertificateResponse]:
    service = CertificateService(db)
    try:
        certificates = service.list_for_job(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    results: list[CertificateResponse] = []
    for cert in certificates:
        download_url = None
        if cert.status == "completed":
            download_url = f"{settings.api_prefix}/certificates/{cert.id}/download"
        results.append(
            CertificateResponse(
                id=cert.id,
                job_id=cert.job_id,
                recipient_name=cert.recipient_name,
                recipient_email=cert.recipient_email,
                certificate_code=cert.certificate_code,
                status=cert.status,
                error_message=cert.error_message,
                created_at=cert.created_at,
                completed_at=cert.completed_at,
                download_url=download_url,
            )
        )
    return results


@router.get(
    "/{job_id}/download-all",
    summary="Download all successful certificates for a job as a ZIP",
    responses={
        200: {
            "content": {"application/zip": {}},
            "description": "ZIP archive of completed certificate PDFs",
        }
    },
)
def download_all_certificates(job_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    service = CertificateService(db)
    try:
        certificates = service.list_for_job(job_id)
    except JobNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    completed = [
        cert
        for cert in certificates
        if cert.status == "completed" and cert.file_path and Path(cert.file_path).exists()
    ]
    if not completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No completed certificates are available to download yet",
        )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for cert in completed:
            file_path = Path(cert.file_path)
            archive.write(file_path, arcname=f"{cert.certificate_code}.pdf")
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="certifyhub-job-{job_id}.zip"'
        },
    )
