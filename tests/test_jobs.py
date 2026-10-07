"""Job endpoint and async processing tests."""


def _recipients(*names_emails: tuple[str, str]) -> list[dict]:
    return [{"name": name, "email": email} for name, email in names_emails]


def test_create_job_and_process(client, created_template):
    payload = {
        "template_id": created_template["id"],
        "recipients": _recipients(
            ("Ada Lovelace", "ada@example.com"),
            ("Alan Turing", "alan@example.com"),
        ),
    }
    response = client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending" or body["status"] in {
        "processing",
        "completed",
        "partial",
    }
    assert body["total_count"] == 2
    assert body["id"] >= 1

    job_id = body["id"]
    status_response = client.get(f"/api/v1/jobs/{job_id}")
    assert status_response.status_code == 200
    status_body = status_response.json()
    assert status_body["total_count"] == 2
    assert status_body["completed_count"] == 2
    assert status_body["failed_count"] == 0
    assert status_body["status"] == "completed"
    assert status_body["progress_percent"] == 100.0


def test_create_job_template_not_found(client):
    payload = {
        "template_id": 9999,
        "recipients": _recipients(("Test User", "test@example.com")),
    }
    response = client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 404


def test_create_job_requires_recipients(client, created_template):
    payload = {"template_id": created_template["id"], "recipients": []}
    response = client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 422


def test_create_job_invalid_email(client, created_template):
    payload = {
        "template_id": created_template["id"],
        "recipients": [{"name": "Bad Email", "email": "not-an-email"}],
    }
    response = client.post("/api/v1/jobs", json=payload)
    assert response.status_code == 422


def test_get_job_not_found(client):
    response = client.get("/api/v1/jobs/9999")
    assert response.status_code == 404


def test_list_job_certificates(client, created_template):
    payload = {
        "template_id": created_template["id"],
        "recipients": _recipients(
            ("Grace Hopper", "grace@example.com"),
            ("Katherine Johnson", "kathy@example.com"),
        ),
    }
    create = client.post("/api/v1/jobs", json=payload)
    job_id = create.json()["id"]

    response = client.get(f"/api/v1/jobs/{job_id}/certificates")
    assert response.status_code == 200
    certificates = response.json()
    assert len(certificates) == 2
    assert all(cert["status"] == "completed" for cert in certificates)
    assert all(cert["download_url"] for cert in certificates)
    assert all(cert["certificate_code"].startswith("CH-") for cert in certificates)


def test_list_certificates_job_not_found(client):
    response = client.get("/api/v1/jobs/9999/certificates")
    assert response.status_code == 404
