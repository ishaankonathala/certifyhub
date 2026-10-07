"""Certificate lookup and download helpers."""

from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.certificate import Certificate
from app.models.job import Job
from app.models.template import Template
from app.services.pdf_service import PDFService


class CertificateNotFoundError(Exception):
    """Raised when a certificate does not exist."""


class CertificateNotReadyError(Exception):
    """Raised when a certificate PDF is not available yet."""


class CertificateService:
    """Fetch certificates and generate PDFs."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.pdf = PDFService()
        self.settings = get_settings()

    def get(self, certificate_id: int) -> Certificate:
        certificate = self.db.get(Certificate, certificate_id)
        if certificate is None:
            raise CertificateNotFoundError(f"Certificate {certificate_id} not found")
        return certificate

    def list_for_job(self, job_id: int) -> list[Certificate]:
        job = self.db.get(Job, job_id)
        if job is None:
            from app.services.job_service import JobNotFoundError

            raise JobNotFoundError(f"Job {job_id} not found")
        return (
            self.db.query(Certificate)
            .filter(Certificate.job_id == job_id)
            .order_by(Certificate.id.asc())
            .all()
        )

    def generate_pdf(self, certificate_id: int) -> Certificate:
        """Generate a PDF for one certificate. Isolates failures per recipient."""
        from datetime import datetime, timezone

        certificate = self.get(certificate_id)
        job = self.db.get(Job, certificate.job_id)
        if job is None:
            raise CertificateNotFoundError(f"Job for certificate {certificate_id} not found")

        template = self.db.get(Template, job.template_id)
        if template is None:
            raise CertificateNotFoundError(
                f"Template for certificate {certificate_id} not found"
            )

        certificate.status = "processing"
        self.db.commit()

        try:
            output_path = (
                self.settings.certificates_dir
                / f"job_{job.id}"
                / f"{certificate.certificate_code}.pdf"
            )
            issued_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
            self.pdf.generate(
                output_path=output_path,
                recipient_name=certificate.recipient_name,
                title=template.title,
                body_text=template.body_text,
                issuer_name=template.issuer_name,
                certificate_code=certificate.certificate_code,
                issued_date=issued_date,
            )
            certificate.file_path = str(output_path)
            certificate.status = "completed"
            certificate.error_message = None
            certificate.completed_at = datetime.now(timezone.utc)
        except Exception as exc:  # noqa: BLE001 - isolate per-certificate failures
            certificate.status = "failed"
            certificate.error_message = str(exc)
            certificate.file_path = None
            certificate.completed_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(certificate)
        return certificate

    def resolve_download_path(self, certificate_id: int) -> Path:
        certificate = self.get(certificate_id)
        if certificate.status != "completed" or not certificate.file_path:
            raise CertificateNotReadyError(
                f"Certificate {certificate_id} is not ready for download "
                f"(status={certificate.status})"
            )
        path = Path(certificate.file_path)
        if not path.exists():
            raise CertificateNotReadyError(
                f"Certificate file missing for id {certificate_id}"
            )
        return path
