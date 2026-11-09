from pathlib import Path

from fastapi.testclient import TestClient

from web.server.main import create_app

ORIGIN = {"Origin": "http://127.0.0.1:5173"}


def folder(client: TestClient, name: str, parent: str | None = None) -> str:
    response = client.post("/api/folders", json={"name": name, "parent_id": parent}, headers=ORIGIN)
    assert response.status_code == 201
    return response.json()["id"]


def entry(client: TestClient, folder_id: str, category: str) -> str:
    response = client.post("/api/items", json={
        "folder_id": folder_id, "category": category, "text": "学习", "meaning": "học",
    }, headers=ORIGIN)
    assert response.status_code == 201
    return response.json()["id"]


def test_aggregate_bulk_trash_is_opt_in_and_keeps_folders_and_unrelated_items(tmp_path: Path) -> None:
    with TestClient(create_app(tmp_path / "aggregate.sqlite3")) as client:
        assert client.post("/api/auth/register", json={"username": "alice", "password": "test-password"}, headers=ORIGIN).status_code == 201
        root = folder(client, "Root")
        child = folder(client, "Child", root)
        deep = folder(client, "Deep", child)
        outside = folder(client, "Outside")
        direct = entry(client, root, "word")
        sentence = entry(client, child, "sentence")
        grammar = entry(client, deep, "grammar")
        note = entry(client, deep, "note")
        other = entry(client, outside, "word")
        endpoint = f"/api/folders/{root}/trash-items"
        assert client.post(endpoint, json={}, headers=ORIGIN).json() == {"count": 1}
        assert client.post(f"/api/trash/items/{direct}/restore", headers=ORIGIN).status_code == 200
        response = client.post(endpoint, json={"item_ids": [direct, note], "include_descendants": True}, headers=ORIGIN)
        assert response.status_code == 200, response.text
        assert response.json() == {"count": 2}
        assert {item["id"] for item in client.get("/api/items").json()} == {sentence, grammar, other}
        response = client.post(endpoint, json={"include_descendants": True}, headers=ORIGIN)
        assert response.status_code == 200
        assert response.json() == {"count": 2}
        assert {item["id"] for item in client.get("/api/items").json()} == {other}
        assert {item["id"] for item in client.get("/api/folders").json()} == {root, child, deep, outside}
        assert client.post(f"/api/trash/items/{note}/restore", headers=ORIGIN).json()["folder_id"] == deep


def test_aggregate_bulk_trash_rejects_outside_and_other_account_items_atomically(tmp_path: Path) -> None:
    app = create_app(tmp_path / "isolation.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        for client, name in [(alice, "alice"), (bob, "bob")]:
            assert client.post("/api/auth/register", json={"username": name, "password": "test-password"}, headers=ORIGIN).status_code == 201
        root = folder(alice, "Root")
        child = folder(alice, "Child", root)
        inside = entry(alice, child, "word")
        outside = entry(alice, folder(alice, "Outside"), "word")
        bobs = entry(bob, folder(bob, "Root"), "word")
        for foreign in [outside, bobs]:
            response = alice.post(f"/api/folders/{root}/trash-items", json={
                "item_ids": [inside, foreign], "include_descendants": True,
            }, headers=ORIGIN)
            assert response.status_code == 404
            assert {item["id"] for item in alice.get("/api/items").json()} == {inside, outside}
        assert bob.post(f"/api/folders/{root}/trash-items", json={"include_descendants": True}, headers=ORIGIN).status_code == 404
        assert {item["id"] for item in bob.get("/api/items").json()} == {bobs}
