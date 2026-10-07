"""Template endpoint tests."""


def test_create_template(client, sample_template_payload):
    response = client.post("/api/v1/templates", json=sample_template_payload)
    assert response.status_code == 201
    body = response.json()
    assert body["id"] >= 1
    assert body["name"] == sample_template_payload["name"]
    assert body["title"] == sample_template_payload["title"]
    assert body["issuer_name"] == sample_template_payload["issuer_name"]
    assert "created_at" in body


def test_get_template(client, created_template):
    template_id = created_template["id"]
    response = client.get(f"/api/v1/templates/{template_id}")
    assert response.status_code == 200
    assert response.json()["name"] == created_template["name"]


def test_get_template_not_found(client):
    response = client.get("/api/v1/templates/9999")
    assert response.status_code == 404


def test_create_template_duplicate_name(client, sample_template_payload):
    first = client.post("/api/v1/templates", json=sample_template_payload)
    assert first.status_code == 201
    second = client.post("/api/v1/templates", json=sample_template_payload)
    assert second.status_code == 409


def test_create_template_validation_error(client):
    response = client.post(
        "/api/v1/templates",
        json={"name": "", "title": "x", "body_text": "y", "issuer_name": "z"},
    )
    assert response.status_code == 422
