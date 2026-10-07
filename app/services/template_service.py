"""Template business logic."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.template import Template
from app.schemas.template import TemplateCreate


class TemplateNotFoundError(Exception):
    """Raised when a template does not exist."""


class TemplateConflictError(Exception):
    """Raised when a template name already exists."""


class TemplateService:
    """Create and fetch certificate templates."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, payload: TemplateCreate) -> Template:
        template = Template(
            name=payload.name.strip(),
            title=payload.title.strip(),
            body_text=payload.body_text.strip(),
            issuer_name=payload.issuer_name.strip(),
        )
        self.db.add(template)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise TemplateConflictError(
                f"Template with name '{payload.name}' already exists"
            ) from exc
        self.db.refresh(template)
        return template

    def get(self, template_id: int) -> Template:
        template = self.db.get(Template, template_id)
        if template is None:
            raise TemplateNotFoundError(f"Template {template_id} not found")
        return template

    def list_all(self) -> list[Template]:
        return self.db.query(Template).order_by(Template.created_at.desc()).all()
