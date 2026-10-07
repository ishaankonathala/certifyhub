"""Certificate download and PDF generation tests."""

from pathlib import Path
from unittest.mock import patch

from app.services.pdf_service import PDFService


def test_download_certificate(client, created_template):
    payload = {
        "template_id": created_template["id"],
        "recipients": [{"name": "Lin Manuel", "email": "lin@example.com"}],
    }
    create = client.post("/api/v1/jobs", json=payload)
    job_id = create.json()["id"]

    certs = client.get(f"/api/v1/jobs/{job_id}/certificates").json()
    certificate_id = certs[0]["id"]

    response = client.get(f"/api/v1/certificates/{certificate_id}/download")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content[:4] == b"%PDF"


def test_download_certificate_not_found(client):
    response = client.get("/api/v1/certificates/9999/download")
    assert response.status_code == 404


def test_pdf_service_writes_file(tmp_path: Path):
    output = tmp_path / "sample.pdf"
    service = PDFService()
    path = service.generate(
        output_path=output,
        recipient_name="Test Recipient",
        title="Certificate of Achievement",
        body_text="has demonstrated excellence in software engineering.",
        issuer_name="CertifyHub",
        certificate_code="CH-TESTCODE",
        issued_date="October 07, 2026",
    )
    assert path.exists()
    assert path.read_bytes()[:4] == b"%PDF"


def test_partial_failure_isolates_errors(client, created_template):
    """One PDF failure must not prevent other certificates from completing."""
    payload = {
        "template_id": created_template["id"],
        "recipients": [
            {"name": "Success One", "email": "one@example.com"},
            {"name": "Will Fail", "email": "fail@example.com"},
            {"name": "Success Two", "email": "two@example.com"},
        ],
    }

    original_generate = PDFService.generate
    call_count = {"n": 0}

    def flaky_generate(self, *args, **kwargs):
        call_count["n"] += 1
        if kwargs.get("recipient_name") == "Will Fail":
            raise RuntimeError("simulated PDF renderer failure")
        return original_generate(self, *args, **kwargs)

    with patch.object(PDFService, "generate", flaky_generate):
        create = client.post("/api/v1/jobs", json=payload)

    assert create.status_code == 202
    job_id = create.json()["id"]

    status = client.get(f"/api/v1/jobs/{job_id}").json()
    assert status["status"] == "partial"
    assert status["completed_count"] == 2
    assert status["failed_count"] == 1
    assert status["progress_percent"] == 100.0

    certificates = client.get(f"/api/v1/jobs/{job_id}/certificates").json()
    by_name = {cert["recipient_name"]: cert for cert in certificates}
    assert by_name["Success One"]["status"] == "completed"
    assert by_name["Success Two"]["status"] == "completed"
    assert by_name["Will Fail"]["status"] == "failed"
    assert "simulated PDF renderer failure" in by_name["Will Fail"]["error_message"]


def test_download_failed_certificate_conflict(client, created_template):
    payload = {
        "template_id": created_template["id"],
        "recipients": [{"name": "Will Fail", "email": "fail@example.com"}],
    }

    with patch.object(PDFService, "generate", side_effect=RuntimeError("boom")):
        create = client.post("/api/v1/jobs", json=payload)

    job_id = create.json()["id"]
    certs = client.get(f"/api/v1/jobs/{job_id}/certificates").json()
    certificate_id = certs[0]["id"]

    response = client.get(f"/api/v1/certificates/{certificate_id}/download")
    assert response.status_code == 409
