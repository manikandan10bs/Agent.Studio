from app.core.config import settings

def test_admin_login_success(client):
    response = client.post("/api/auth/login", json={
        "email": settings.DEFAULT_ADMIN_EMAIL,
        "password": settings.DEFAULT_ADMIN_PASSWORD
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == settings.DEFAULT_ADMIN_EMAIL
    assert data["user"]["role"] == "admin"

def test_login_invalid_password(client):
    response = client.post("/api/auth/login", json={
        "email": settings.DEFAULT_ADMIN_EMAIL,
        "password": "WrongPassword123"
    })
    assert response.status_code == 401

def test_get_current_user_me(client, admin_headers):
    response = client.get("/api/auth/me", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == settings.DEFAULT_ADMIN_EMAIL

def test_invitation_flow(client, admin_headers):
    # Admin generates invitation
    invite_res = client.post("/api/admin/invitations", headers=admin_headers, json={
        "email": "invitee@agent.studio",
        "role": "creator"
    })
    assert invite_res.status_code == 200
    invite_data = invite_res.json()
    invite_url = invite_data["invitation_url"]
    raw_token = invite_url.split("token=")[-1]

    # Invitee accepts invitation
    accept_res = client.post("/api/auth/accept-invitation", json={
        "token": raw_token,
        "password": "NewUserPassword123!",
        "full_name": "Invited Creator"
    })
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["user"]["email"] == "invitee@agent.studio"
    assert accept_data["user"]["role"] == "creator"
