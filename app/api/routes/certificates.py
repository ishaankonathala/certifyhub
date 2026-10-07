"""Certificate download endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.certificate_service import (
    CertificateNotFoundError,
    CertificateNotReadyError,
    CertificateService,
)

router = APIRouter(prefix="/certificates", tags=["Certificates"])


@router.get(
    "/{certificate_id}/download",
    summary="Download a generated certificate PDF",
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "PDF certificate file",
        }
    },
)
def download_certificate(certificate_id: int, db: Session = Depends(get_db)) -> FileResponse:
    service = CertificateService(db)
    try:
        path = service.resolve_download_path(certificate_id)
        certificate = service.get(certificate_id)
    except CertificateNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CertificateNotReadyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    filename = f"{certificate.certificate_code}.pdf"
    return FileResponse(
        path=path,
        media_type="application/pdf",
        filename=filename,
    )
