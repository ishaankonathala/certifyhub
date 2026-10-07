"""Template endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.template import TemplateCreate, TemplateResponse
from app.services.template_service import (
    TemplateConflictError,
    TemplateNotFoundError,
    TemplateService,
)

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.post(
    "",
    response_model=TemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a certificate template",
)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
) -> TemplateResponse:
    service = TemplateService(db)
    try:
        template = service.create(payload)
    except TemplateConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return TemplateResponse.model_validate(template)


@router.get(
    "",
    response_model=list[TemplateResponse],
    summary="List certificate templates",
)
def list_templates(db: Session = Depends(get_db)) -> list[TemplateResponse]:
    service = TemplateService(db)
    return [TemplateResponse.model_validate(t) for t in service.list_all()]


@router.get(
    "/{template_id}",
    response_model=TemplateResponse,
    summary="Get a certificate template",
)
def get_template(template_id: int, db: Session = Depends(get_db)) -> TemplateResponse:
    service = TemplateService(db)
    try:
        template = service.get(template_id)
    except TemplateNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return TemplateResponse.model_validate(template)
