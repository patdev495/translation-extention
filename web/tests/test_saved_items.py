from pathlib import Path

from fastapi.testclient import TestClient

from web.server.main import create_app

ORIGIN = {"Origin": "http://127.0.0.1:5173"}


def register(client: TestClient, name: str) -> None:
    assert client.post("/api/auth/register", json={"username": name, "password": "pass"}, headers=ORIGIN).status_code == 201


def link(browser: TestClient, extension: TestClient) -> dict[str, str]:
    started = extension.post("/api/link/start").json()
    assert browser.post(f"/api/link/approve/{started['request_id']}", headers=ORIGIN).status_code == 204
    token = extension.post("/api/link/poll", json={"request_id": started["request_id"], "poll_secret": started["poll_secret"]}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_extension_save_is_account_owned_and_duplicate_is_visible(tmp_path: Path) -> None:
    app = create_app(tmp_path / "items.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob, TestClient(app) as extension:
        register(alice, "alice")
        register(bob, "bob")
        folder = alice.post("/api/folders", json={"name": "HSK", "parent_id": None}, headers=ORIGIN).json()["id"]
        bearer = link(alice, extension)
        payload = {"folder_id": folder, "category": "word", "text": "你好", "meaning": "xin chào"}
        saved = extension.post("/api/extension/items", json=payload, headers=bearer)
        assert saved.status_code == 201, saved.text
        assert saved.json()["pinyin"] == "nǐ hǎo"
        assert alice.get("/api/items").json()[0]["text"] == "你好"
        assert bob.get("/api/items").json() == []
        duplicate = extension.post("/api/extension/items", json=payload, headers=bearer)
        assert duplicate.status_code == 409
        assert duplicate.json()["detail"]["existing_item"]["id"] == saved.json()["id"]
        assert extension.post("/api/extension/items", json=payload).status_code == 401


def test_both_links_existing_word_and_edit_rechecks_collisions(tmp_path: Path) -> None:
    app = create_app(tmp_path / "both.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        one = browser.post("/api/folders", json={"name": "One"}, headers=ORIGIN).json()["id"]
        two = browser.post("/api/folders", json={"name": "Two"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        word = extension.post("/api/extension/items", json={"folder_id": one, "category": "word", "text": "学习", "meaning": "học"}, headers=bearer).json()
        both = extension.post("/api/extension/items/both", json={"folder_id": one, "word_text": "学习", "word_meaning": "học", "sentence_text": "我喜欢学习中文。", "sentence_meaning": "Tôi thích học tiếng Trung."}, headers=bearer)
        assert both.status_code == 201, both.text
        assert both.json()["word"]["id"] == word["id"]
        sentence = both.json()["sentence"]
        assert word["id"] in sentence["linked_item_ids"]
        changed = browser.patch(f"/api/items/{word['id']}", json={"text": "学中文", "meaning": "học tiếng Trung", "folder_id": two}, headers=ORIGIN)
        assert changed.status_code == 200, changed.text
        assert changed.json()["pinyin"] == "xué zhōng wén"
        assert browser.get("/api/items").json()[0]["id"]
        duplicate = extension.post("/api/extension/items", json={"folder_id": one, "category": "word", "text": "学中文", "meaning": "khác"}, headers=bearer)
        assert duplicate.status_code == 201
        collision = browser.patch(f"/api/items/{word['id']}", json={"folder_id": one}, headers=ORIGIN)
        assert collision.status_code == 409


def test_other_account_cannot_edit_item_and_category_change_detects_collision(tmp_path: Path) -> None:
    app = create_app(tmp_path / "isolation.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob, TestClient(app) as extension:
        register(alice, "alice")
        register(bob, "bob")
        folder = alice.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        bearer = link(alice, extension)
        word = extension.post("/api/extension/items", json={"folder_id": folder, "category": "word", "text": "你好", "meaning": "hello"}, headers=bearer).json()
        sentence = extension.post("/api/extension/items", json={"folder_id": folder, "category": "sentence", "text": "你好", "meaning": "hello sentence"}, headers=bearer).json()
        assert word["id"] != sentence["id"]
        assert bob.patch(f"/api/items/{word['id']}", json={"meaning": "stolen"}, headers=ORIGIN).status_code == 404
        assert alice.patch(f"/api/items/{word['id']}", json={"category": "sentence"}, headers=ORIGIN).status_code == 409
        assert next(item for item in alice.get("/api/items").json() if item["id"] == word["id"])["category"] == "word"
