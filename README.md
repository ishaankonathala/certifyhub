# CertifyHub

Bulk certificate generation — a simple web app for normal users, plus a FastAPI backend for developers.

Create certificates for many people in a few clicks: enter details, add recipients (or upload a CSV), watch progress, and download PDFs.

## What’s included

| Piece | Purpose |
|-------|---------|
| **Web UI** (`frontend/`) | User-friendly dashboard — no Swagger/JSON required |
| **API** (`app/`) | FastAPI backend with async job processing |
| **Swagger** | Developer docs at `/docs` |

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite + TypeScript |
| API | FastAPI |
| Async jobs | Celery (+ Redis in production) |
| ORM / DB | SQLAlchemy + SQLite |
| PDFs | ReportLab |
| Tests | Pytest |

## Project structure

```
app/                 # FastAPI backend
frontend/            # React UI
tests/               # Backend tests
storage/certificates/
```

## Quick start (UI + API)

### 1. Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

For local UI demos, `.env` can use:

```env
CELERY_TASK_ALWAYS_EAGER=true
```

That processes jobs in-process so Redis is optional for development.

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

The Vite dev server proxies `/api`, `/health`, and `/docs` to the API on port 8000.

### 3. Optional: Redis + Celery worker (production-style)

```bash
docker compose up -d
# set CELERY_TASK_ALWAYS_EAGER=false in .env, restart API
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
```

## Using the app (no API knowledge needed)

1. Open CertifyHub → **Generate Certificates**
2. Enter certificate details
3. Add recipients manually **or** upload a CSV (`name,email`)
4. Review → **Generate Certificates**
5. Watch live progress
6. Download individual PDFs or **Download All** (ZIP)

Swagger stays available for developers at http://localhost:8000/docs (also linked from the sidebar).

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/templates` | Create template |
| `GET` | `/api/v1/templates` | List templates |
| `GET` | `/api/v1/templates/{id}` | Get template |
| `POST` | `/api/v1/jobs` | Submit bulk job (`202`) |
| `GET` | `/api/v1/jobs` | List jobs |
| `GET` | `/api/v1/jobs/{id}` | Job status + progress |
| `GET` | `/api/v1/jobs/{id}/certificates` | List certificates |
| `GET` | `/api/v1/jobs/{id}/download-all` | ZIP of successful PDFs |
| `GET` | `/api/v1/certificates/{id}/download` | Download one PDF |
| `GET` | `/health` | Health check |

## Sample CSV

```csv
name,email
Ishaan Karthikeya,ishaan@example.com
Rahul Sharma,rahul@example.com
Priya Reddy,priya@example.com
```

## Tests

```bash
source .venv/bin/activate
pytest tests/ -v
```

## Design notes

- **UI talks only to the real API** via a small service layer (`frontend/src/api/`)
- **Jobs are async** — the API accepts work and returns immediately; the UI polls status every ~1.5s
- **Fault isolation** — one failed recipient does not stop the batch
- **Local fallback** — if Celery/Redis is unavailable, the API processes the job inline so demos still work

## License

MIT — internship / portfolio project.
