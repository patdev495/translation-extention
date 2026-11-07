from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from web.server.database import connect
from web.server.main import create_app

ORIGIN = {"Origin": "http://127.0.0.1:5173"}


def register(client: TestClient, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": "correct horse battery staple"},
        headers=ORIGIN,
    )
    assert response.status_code == 201, response.text
    assert "httponly" in response.headers["set-cookie"].lower()
    return response.json()


def test_accounts_are_isolated_and_sessions_revoke(tmp_path: Path) -> None:
    app = create_app(tmp_path / "accounts.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        first = register(alice, "alice")
        second = register(bob, "bob")
        assert first["id"] != second["id"]
        assert alice.get("/api/auth/me").json()["username"] == "alice"
        assert bob.get("/api/auth/me").json()["username"] == "bob"

        root = alice.post("/api/folders", json={"name": "HSK 1", "parent_id": None}, headers=ORIGIN)
        assert root.status_code == 201
        folder_id = root.json()["id"]
        assert bob.get("/api/folders").json() == []
        assert bob.patch(f"/api/folders/{folder_id}", json={"name": "stolen"}, headers=ORIGIN).status_code == 404
        assert bob.post("/api/folders", json={"name": "inside", "parent_id": folder_id}, headers=ORIGIN).status_code == 404
        assert alice.get("/api/folders").json()[0]["name"] == "HSK 1"

        assert alice.post("/api/auth/logout", headers=ORIGIN).status_code == 204
        assert alice.get("/api/auth/me").status_code == 401
        assert bob.get("/api/auth/me").status_code == 200


def test_link_requires_approval_and_token_can_be_revoked(tmp_path: Path) -> None:
    db_path = tmp_path / "link.sqlite3"
    app = create_app(db_path)
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        start = extension.post("/api/link/start")
        assert start.status_code == 200
        request = start.json()
        payload = {"request_id": request["request_id"], "poll_secret": request["poll_secret"]}
        assert extension.post("/api/link/poll", json=payload).json()["state"] == "pending"
        assert extension.post("/api/link/poll", json={**payload, "poll_secret": "wrong"}).status_code == 410
        assert browser.post(f"/api/link/approve/{request['request_id']}", headers=ORIGIN).status_code == 204
        linked = extension.post("/api/link/poll", json=payload)
        assert linked.status_code == 200
        token = linked.json()["token"]
        assert linked.json()["account"]["username"] == "learner"
        assert extension.post("/api/link/poll", json=payload).status_code == 410
        bearer = {"Authorization": f"Bearer {token}"}
        assert extension.get("/api/extension/me", headers=bearer).status_code == 200
        assert extension.post("/api/extension/revoke", headers=bearer).status_code == 204
        assert extension.get("/api/extension/me", headers=bearer).status_code == 401

        new_request = extension.post("/api/link/start").json()
        with connect(db_path) as connection:
            connection.execute("UPDATE link_requests SET expires_at = 0 WHERE id = ?", (new_request["request_id"],))
        assert browser.post(f"/api/link/approve/{new_request['request_id']}", headers=ORIGIN).status_code == 404
        assert extension.post("/api/link/poll", json={"request_id": new_request["request_id"], "poll_secret": new_request["poll_secret"]}).status_code == 410

        expiring = extension.post("/api/link/start").json()
        assert browser.post(f"/api/link/approve/{expiring['request_id']}", headers=ORIGIN).status_code == 204
        expiring_token = extension.post("/api/link/poll", json={"request_id": expiring["request_id"], "poll_secret": expiring["poll_secret"]}).json()["token"]
        with connect(db_path) as connection:
            connection.execute("UPDATE sessions SET expires_at = 0 WHERE kind = 'extension' AND revoked_at IS NULL")
        assert extension.get("/api/extension/me", headers={"Authorization": f"Bearer {expiring_token}"}).status_code == 401


def test_folder_tree_rename_move_and_cycle_guards(tmp_path: Path) -> None:
    app = create_app(tmp_path / "folders.sqlite3")
    with TestClient(app) as client:
        register(client, "folders")
        root = client.post("/api/folders", json={"name": "HSK 1", "parent_id": None}, headers=ORIGIN).json()
        child = client.post("/api/folders", json={"name": "Bài 01", "parent_id": root["id"]}, headers=ORIGIN).json()
        peer = client.post("/api/folders", json={"name": "Chủ đề", "parent_id": None}, headers=ORIGIN).json()
        assert client.post("/api/folders", json={"name": "hsk 1", "parent_id": None}, headers=ORIGIN).status_code == 409

        renamed = client.patch(f"/api/folders/{child['id']}", json={"name": "Bài 02"}, headers=ORIGIN)
        assert renamed.status_code == 200
        moved = client.patch(f"/api/folders/{child['id']}", json={"parent_id": peer["id"]}, headers=ORIGIN)
        assert moved.json()["parent_id"] == peer["id"]
        assert client.patch(f"/api/folders/{peer['id']}", json={"parent_id": child["id"]}, headers=ORIGIN).status_code == 400
        assert client.patch(f"/api/folders/{peer['id']}", json={"parent_id": peer["id"]}, headers=ORIGIN).status_code == 400
        assert client.patch(f"/api/folders/{child['id']}", json={"parent_id": None}, headers=ORIGIN).status_code == 200
        assert len(client.get("/api/folders").json()) == 3


def test_folders_are_listed_in_creation_order(tmp_path: Path) -> None:
    app = create_app(tmp_path / "folder-order.sqlite3")
    with TestClient(app) as client:
        register(client, "folder-order")
        older = client.post("/api/folders", json={"name": "Zebra"}, headers=ORIGIN).json()
        newer = client.post("/api/folders", json={"name": "Alpha"}, headers=ORIGIN).json()
        assert [folder["id"] for folder in client.get("/api/folders").json()] == [older["id"], newer["id"]]


def test_browser_mutations_reject_other_origins(tmp_path: Path) -> None:
    app = create_app(tmp_path / "origin.sqlite3")
    with TestClient(app) as client:
        assert client.post(
            "/api/auth/register",
            json={"username": "wrong", "password": "correct horse battery staple"},
            headers={"Origin": "https://untrusted.example"},
        ).status_code == 403


def test_browser_mutations_accept_localhost_alias(tmp_path: Path) -> None:
    app = create_app(tmp_path / "localhost-origin.sqlite3")
    with TestClient(app) as client:
        registered = client.post(
            "/api/auth/register",
            json={"username": "local", "password": "pass"},
            headers={"Origin": "http://localhost:5173"},
        )
        assert registered.status_code == 201, registered.text
        assert client.post("/api/auth/logout", headers={"Origin": "http://localhost:5173"}).status_code == 204
        assert client.post(
            "/api/auth/login", json={"username": "local", "password": "pass"},
            headers={"Origin": "http://localhost:5174"},
        ).status_code == 403


def test_username_login_does_not_require_email(tmp_path: Path) -> None:
    app = create_app(tmp_path / "usernames.sqlite3")
    with TestClient(app) as client:
        register(client, "HocVien_HSK1")
        assert client.get("/api/auth/me").json()["username"] == "hocvien_hsk1"
        assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 204
        assert client.post(
            "/api/auth/login",
            json={"username": "HOCVIEN_HSK1", "password": "correct horse battery staple"},
            headers=ORIGIN,
        ).status_code == 200
        assert client.get("/api/auth/me").json()["username"] == "hocvien_hsk1"
        assert client.post(
            "/api/auth/register",
            json={"username": "hocvien_hsk1", "password": "correct horse battery staple"},
            headers=ORIGIN,
        ).status_code == 409
        assert client.post(
            "/api/auth/register",
            json={"username": "new@example.com", "password": "correct horse battery staple"},
            headers=ORIGIN,
        ).status_code == 422


def test_account_credentials_have_no_length_limits(tmp_path: Path) -> None:
    app = create_app(tmp_path / "unlimited-credentials.sqlite3")
    with TestClient(app) as client:
        for username, password in (("u", "p"), ("u" * 300, " leading and trailing " * 30)):
            created = client.post(
                "/api/auth/register",
                json={"username": username, "password": password},
                headers=ORIGIN,
            )
            assert created.status_code == 201, created.text
            assert created.json()["username"] == username
            assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 204
            signed_in = client.post(
                "/api/auth/login",
                json={"username": username, "password": password},
                headers=ORIGIN,
            )
            assert signed_in.status_code == 200, signed_in.text
            assert signed_in.json()["username"] == username
            assert client.post("/api/auth/logout", headers=ORIGIN).status_code == 204


def test_existing_email_account_can_sign_in_after_migration(tmp_path: Path) -> None:
    db_path = tmp_path / "legacy.sqlite3"
    import sqlite3

    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL)"
        )
        connection.execute(
            "INSERT INTO users VALUES (?, ?, ?, ?)",
            ("legacy-id", "old@example.com", PasswordHash.recommended().hash("correct horse battery staple"), 1),
        )
    app = create_app(db_path)
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"username": "old@example.com", "password": "correct horse battery staple"},
            headers=ORIGIN,
        )
        assert response.status_code == 200
        assert response.json() == {"id": "legacy-id", "username": "old@example.com"}
