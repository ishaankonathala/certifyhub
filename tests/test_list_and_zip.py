"""Tests for list endpoints and ZIP download."""

from pathlib import Path
import zipfile
import io


def test_list_templates_empty(client):
    response = client.get("/api/v1/templates")
    assert response.status_code == 200
    assert response.json() == []


def test_list_templates_after_create(client, created_template):
    response = client.get("/api/v1/templates")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == created_template["id"]


def test_list_jobs_and_download_zip(client, created_template):
    create = client.post(
        "/api/v1/jobs",
        json={
            "template_id": created_template["id"],
            "recipients": [
                {"name": "Ada Lovelace", "email": "ada@example.com"},
                {"name": "Alan Turing", "email": "alan@example.com"},
            ],
        },
    )
    assert create.status_code == 202
    job_id = create.json()["id"]

    listed = client.get("/api/v1/jobs")
    assert listed.status_code == 200
    jobs = listed.json()
    assert any(job["id"] == job_id for job in jobs)

    status = client.get(f"/api/v1/jobs/{job_id}").json()
    assert status["status"] == "completed"

    zip_response = client.get(f"/api/v1/jobs/{job_id}/download-all")
    assert zip_response.status_code == 200
    assert "application/zip" in zip_response.headers["content-type"]

    archive = zipfile.ZipFile(io.BytesIO(zip_response.content))
    names = archive.namelist()
    assert len(names) == 2
    assert all(name.endswith(".pdf") for name in names)


def test_download_all_no_certificates(client, created_template):
    # Job that fails entirely — no zip content
    from unittest.mock import patch
    from app.services.pdf_service import PDFService

    with patch.object(PDFService, "generate", side_effect=RuntimeError("boom")):
        create = client.post(
            "/api/v1/jobs",
            json={
                "template_id": created_template["id"],
                "recipients": [{"name": "Fail", "email": "fail@example.com"}],
            },
        )
    job_id = create.json()["id"]
    response = client.get(f"/api/v1/jobs/{job_id}/download-all")
    assert response.status_code == 409
