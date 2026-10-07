# CertifyHub - Complete Codebase Documentation 

## Project Overview

**CertifyHub** is a bulk certificate generation API built with FastAPI (Python) and React (TypeScript). It enables users to:
- Create certificate templates
- Submit bulk jobs with recipient lists
- Generate PDF certificates asynchronously
- Download individual or batch certificates

**Tech Stack:**
- **Backend**: FastAPI, SQLAlchemy ORM, Celery (async), SQLite
- **Frontend**: React 19, TypeScript, Vite, React Router
- **PDF Generation**: ReportLab
- **Async Broker**: Celery + Redis (or in-process for dev)

---

## 1. Data Models (SQLAlchemy + Pydantic)

### 1.1 Database Models (SQLAlchemy)

#### Template Model
```python
# app/models/template.py
from datetime import datetime
from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Template(Base):
    """Reusable certificate layout and wording."""
    __tablename__ = "templates"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    issuer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    
    jobs = relationship("Job", back_populates="template")
```

#### Job Model
```python
# app/models/job.py
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Job(Base):
    """Tracks a bulk certificate generation request."""
    __tablename__ = "jobs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("templates.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    
    template = relationship("Template", back_populates="jobs")
    certificates = relationship(
        "Certificate", back_populates="job", cascade="all, delete-orphan"
    )
```

#### Certificate Model
```python
# app/models/certificate.py
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Certificate(Base):
    """One generated (or attempted) certificate for a recipient."""
    __tablename__ = "certificates"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    recipient_name: Mapped[str] = mapped_column(String(200), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    certificate_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    job = relationship("Job", back_populates="certificates")
```

### 1.2 Pydantic Schemas (API Request/Response)

#### Template Schemas
```python
# app/schemas/template.py
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
```

#### Job Schemas
```python
# app/schemas/job.py
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
```

#### Certificate Schema
```python
# app/schemas/certificate.py
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
```

### 1.3 Frontend TypeScript Types

```typescript
// frontend/src/types/index.ts
export interface Template {
  id: number
  name: string
  title: string
  body_text: string
  issuer_name: string
  created_at: string
}

export interface TemplateCreate {
  name: string
  title: string
  body_text: string
  issuer_name: string
}

export interface Recipient {
  name: string
  email: string
  notes?: string
}

export interface RecipientRow extends Recipient {
  id: string
  valid: boolean
  error?: string
}

export interface Job {
  id: number
  template_id: number
  status: string
  total_count: number
  completed_count: number
  failed_count: number
  progress_percent?: number
  created_at: string
  updated_at?: string
  message?: string
}

export interface Certificate {
  id: number
  job_id: number
  recipient_name: string
  recipient_email: string
  certificate_code: string
  status: string
  error_message: string | null
  created_at: string
  completed_at: string | null
  download_url: string | null
}

export interface CertificateDetails {
  eventName: string
  courseName: string
  issuerName: string
  date: string
  description: string
  templateId: number | null
}
```

---

## 2. Backend Architecture

### 2.1 Configuration

```python
# app/config.py
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""
    
    app_name: str = "CertifyHub"
    app_version: str = "1.0.0"
    debug: bool = True
    
    database_url: str = f"sqlite:///{BASE_DIR / 'certifyhub.db'}"
    
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    celery_task_always_eager: bool = False
    
    storage_dir: Path = BASE_DIR / "storage"
    certificates_dir: Path = BASE_DIR / "storage" / "certificates"
    
    api_prefix: str = "/api/v1"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    settings = Settings()
    settings.certificates_dir.mkdir(parents=True, exist_ok=True)
    return settings
```

### 2.2 Database Setup

```python
# app/database.py
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from app.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""

def get_db() -> Generator[Session, None, None]:
    """Yield a database session for FastAPI dependency injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db() -> None:
    """Create all database tables."""
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
```

### 2.3 Main Application

```python
# app/main.py
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import certificates, jobs, templates
from app.config import get_settings
from app.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize database tables on startup."""
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    init_db()
    yield
    logger.info("Shutting down %s", settings.app_name)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "CertifyHub is a REST API for bulk certificate generation. "
        "Submit recipients in one request, process PDFs asynchronously, "
        "and track progress in real time."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(templates.router, prefix=settings.api_prefix)
app.include_router(jobs.router, prefix=settings.api_prefix)
app.include_router(certificates.router, prefix=settings.api_prefix)

@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Simple health endpoint for uptime checks."""
    return {"status": "ok", "service": settings.app_name}
```

### 2.4 Business Logic Services

#### Template Service
```python
# app/services/template_service.py
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
```

#### Job Service
```python
# app/services/job_service.py
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
```

#### Certificate Service
```python
# app/services/certificate_service.py
from pathlib import Path
from datetime import datetime, timezone
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
```

#### PDF Service
```python
# app/services/pdf_service.py
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

class PDFService:
    """Renders professional certificate PDFs."""
    
    BORDER = HexColor("#1a365d")
    ACCENT = HexColor("#c9a227")
    TEXT = HexColor("#1a202c")
    MUTED = HexColor("#4a5568")
    
    def generate(
        self,
        *,
        output_path: Path,
        recipient_name: str,
        title: str,
        body_text: str,
        issuer_name: str,
        certificate_code: str,
        issued_date: str,
    ) -> Path:
        """Create a landscape certificate PDF and return its path."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        width, height = landscape(letter)
        c = canvas.Canvas(str(output_path), pagesize=landscape(letter))
        
        # Outer border
        c.setStrokeColor(self.BORDER)
        c.setLineWidth(4)
        c.rect(0.4 * inch, 0.4 * inch, width - 0.8 * inch, height - 0.8 * inch)
        
        # Inner accent border
        c.setStrokeColor(self.ACCENT)
        c.setLineWidth(1.5)
        c.rect(0.55 * inch, 0.55 * inch, width - 1.1 * inch, height - 1.1 * inch)
        
        # Header
        c.setFillColor(self.BORDER)
        c.setFont("Times-Bold", 18)
        c.drawCentredString(width / 2, height - 1.2 * inch, issuer_name.upper())
        
        c.setStrokeColor(self.ACCENT)
        c.setLineWidth(1)
        c.line(width / 2 - 2.5 * inch, height - 1.4 * inch, width / 2 + 2.5 * inch, height - 1.4 * inch)
        
        # Title
        c.setFillColor(self.BORDER)
        c.setFont("Times-Bold", 32)
        c.drawCentredString(width / 2, height - 2.1 * inch, title)
        
        # Intro line
        c.setFillColor(self.MUTED)
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2, height - 2.7 * inch, "This is to certify that")
        
        # Recipient name
        c.setFillColor(self.TEXT)
        c.setFont("Times-BoldItalic", 28)
        c.drawCentredString(width / 2, height - 3.4 * inch, recipient_name)
        
        # Body
        c.setFillColor(self.MUTED)
        c.setFont("Helvetica", 12)
        self._draw_wrapped_centered(
            c, body_text, width / 2, height - 4.0 * inch, max_width=6.5 * inch, leading=16
        )
        
        # Date and code
        c.setFillColor(self.TEXT)
        c.setFont("Helvetica", 10)
        c.drawString(1.0 * inch, 1.0 * inch, f"Issued: {issued_date}")
        c.drawRightString(width - 1.0 * inch, 1.0 * inch, f"ID: {certificate_code}")
        
        # Signature line
        c.setStrokeColor(self.BORDER)
        c.line(width / 2 - 1.5 * inch, 1.5 * inch, width / 2 + 1.5 * inch, 1.5 * inch)
        c.setFont("Helvetica-Oblique", 10)
        c.setFillColor(self.MUTED)
        c.drawCentredString(width / 2, 1.25 * inch, "Authorized Signature")
        
        c.save()
        return output_path
    
    def _draw_wrapped_centered(
        self,
        c: canvas.Canvas,
        text: str,
        x: float,
        y: float,
        max_width: float,
        leading: float,
    ) -> None:
        """Draw centered multi-line text within max_width."""
        words = text.split()
        lines: list[str] = []
        current = ""
        
        for word in words:
            candidate = f"{current} {word}".strip()
            if c.stringWidth(candidate, "Helvetica", 12) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        
        for index, line in enumerate(lines):
            c.drawCentredString(x, y - index * leading, line)
```

### 2.5 API Routes

#### Templates Routes
```python
# app/api/routes/templates.py
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
```

#### Jobs Routes
```python
# app/api/routes/jobs.py
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
```

#### Certificates Routes
```python
# app/api/routes/certificates.py
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
```

### 2.6 Async Task Processing (Celery)

```python
# app/tasks/celery_app.py
from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "certifyhub",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.certificate_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_always_eager=settings.celery_task_always_eager,
    task_eager_propagates=True,
)
```

```python
# app/tasks/certificate_tasks.py
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
```

---

## 3. Frontend Architecture

### 3.1 API Client Layer

```typescript
// frontend/src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let detail: unknown = null
  try {
    detail = await response.json()
  } catch {
    detail = await response.text()
  }

  const message =
    typeof detail === 'object' &&
    detail !== null &&
    'detail' in detail &&
    typeof (detail as { detail: unknown }).detail === 'string'
      ? (detail as { detail: string }).detail
      : `Request failed (${response.status})`

  return new ApiError(message, response.status, detail)
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function downloadUrl(path: string): string {
  return `${API_BASE}${path}`
}

export async function downloadBlob(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw await parseError(response)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
```

#### Template API
```typescript
// frontend/src/api/templates.ts
import { apiRequest } from './client'
import type { Template, TemplateCreate } from '../types'

export function listTemplates(): Promise<Template[]> {
  return apiRequest<Template[]>('/api/v1/templates')
}

export function getTemplate(id: number): Promise<Template> {
  return apiRequest<Template>(`/api/v1/templates/${id}`)
}

export function createTemplate(payload: TemplateCreate): Promise<Template> {
  return apiRequest<Template>('/api/v1/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
```

#### Job API
```typescript
// frontend/src/api/jobs.ts
import { apiRequest, downloadBlob } from './client'
import type { Certificate, Job, Recipient } from '../types'

export function listJobs(): Promise<Job[]> {
  return apiRequest<Job[]>('/api/v1/jobs')
}

export function getJob(jobId: number): Promise<Job> {
  return apiRequest<Job>(`/api/v1/jobs/${jobId}`)
}

export function createJob(templateId: number, recipients: Recipient[]): Promise<Job> {
  return apiRequest<Job>('/api/v1/jobs', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      recipients: recipients.map((r) => ({
        name: r.name.trim(),
        email: r.email.trim(),
      })),
    }),
  })
}

export function listJobCertificates(jobId: number): Promise<Certificate[]> {
  return apiRequest<Certificate[]>(`/api/v1/jobs/${jobId}/certificates`)
}

export function downloadAllCertificates(jobId: number): Promise<void> {
  return downloadBlob(`/api/v1/jobs/${jobId}/download-all`, `certifyhub-job-${jobId}.zip`)
}
```

#### Certificate API
```typescript
// frontend/src/api/certificates.ts
import { downloadBlob } from './client'

export function downloadCertificate(certificateId: number, filename: string): Promise<void> {
  return downloadBlob(`/api/v1/certificates/${certificateId}/download`, filename)
}
```

### 3.2 Main App Router

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Dashboard } from './pages/Dashboard'
import { GenerateCertificates } from './pages/GenerateCertificates'
import { JobDetail } from './pages/JobDetail'
import { JobsHistory } from './pages/JobsHistory'
import { Templates } from './pages/Templates'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="generate" element={<GenerateCertificates />} />
          <Route path="jobs" element={<JobsHistory />} />
          <Route path="jobs/:jobId" element={<JobDetail />} />
          <Route path="templates" element={<Templates />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

---

## 4. Database Schema Diagram

```
┌─────────────────┐
│    templates    │
├─────────────────┤
│ id (PK)         │
│ name (UNIQUE)   │
│ title           │
│ body_text       │
│ issuer_name     │
│ created_at      │
└────────┬────────┘
         │ (1:N)
         │
         ▼
┌──────────────────┐
│      jobs        │
├──────────────────┤
│ id (PK)          │
│ template_id (FK) │
│ status           │
│ total_count      │
│ completed_count  │
│ failed_count     │
│ created_at       │
│ updated_at       │
└────────┬─────────┘
         │ (1:N)
         │
         ▼
┌────────────────────────┐
│    certificates        │
├────────────────────────┤
│ id (PK)                │
│ job_id (FK)            │
│ recipient_name         │
│ recipient_email        │
│ certificate_code (UNIQ)│
│ status                 │
│ file_path              │
│ error_message          │
│ created_at             │
│ completed_at           │
└────────────────────────┘
```

---

## 5. Request-Response Flow

### Creating a Job (Async Processing)

1. **User submits job:**
   ```
   POST /api/v1/jobs
   {
     "template_id": 1,
     "recipients": [
       {"name": "John Doe", "email": "john@example.com"},
       {"name": "Jane Smith", "email": "jane@example.com"}
     ]
   }
   ```

2. **Backend returns `202 Accepted`:**
   ```json
   {
     "id": 1,
     "template_id": 1,
     "status": "pending",
     "total_count": 2,
     "completed_count": 0,
     "failed_count": 0,
     "created_at": "2024-10-07T10:00:00Z",
     "message": "Job accepted and queued for processing"
   }
   ```

3. **Celery task processes:**
   - Creates initial certificates with status "pending"
   - Updates job to "processing"
   - Iterates through each certificate:
     - Generates PDF using ReportLab
     - Updates certificate status to "completed" or "failed"
   - Updates job with final counts and status ("completed", "failed", or "partial")

4. **Frontend polls for status:**
   ```
   GET /api/v1/jobs/1
   ```
   Returns current progress percentage and status.

---

## 6. Environment Variables

```env
# Backend (.env)
DATABASE_URL=sqlite:///./certifyhub.db
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
CELERY_TASK_ALWAYS_EAGER=false  # Set to true for local dev without Redis
STORAGE_DIR=./storage
API_PREFIX=/api/v1

# Frontend (.env)
VITE_API_BASE_URL=http://localhost:8000
```

---

## 7. Common Data Flows

### Certificate Status States

- **pending** → Initial state after job creation
- **processing** → When Celery task picks it up
- **completed** → PDF generated successfully, can be downloaded
- **failed** → PDF generation failed (error_message contains reason)

### Job Status States

- **pending** → Job created, waiting to be processed
- **processing** → At least one certificate is being processed
- **completed** → All certificates completed successfully
- **failed** → All certificates failed
- **partial** → Mix of successful and failed certificates

---

## 8. Key Design Patterns

1. **Layered Architecture**
   - Routes → Services → Models/Database
   - Frontend API client → Components → Pages

2. **Transactional Integrity**
   - Job + Certificates created atomically in one DB transaction
   - Progress tracking via certificate counts, not separate counters

3. **Fault Isolation**
   - One failed certificate doesn't stop the batch
   - Errors captured per-certificate, not bubbled up

4. **Async Processing with Local Fallback**
   - Tries Celery/Redis first
   - Falls back to in-process execution if broker unavailable
   - Good for local dev without external dependencies

5. **RESTful Polling**
   - Frontend polls job status every ~1.5s
   - No WebSocket/SSE complexity
   - Simple, stateless design

---

This codebase is well-structured for understanding by ChatGPT. All models, schemas, services, and APIs are documented with their exact implementations.
