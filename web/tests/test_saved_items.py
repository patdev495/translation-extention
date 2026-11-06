from pathlib import Path
from io import BytesIO

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
        assert isinstance(saved.json()["created_at"], int)
        assert alice.get("/api/items").json()[0]["created_at"] == saved.json()["created_at"]
        assert alice.get("/api/items").json()[0]["text"] == "你好"
        assert bob.get("/api/items").json() == []
        duplicate = extension.post("/api/extension/items", json=payload, headers=bearer)
        assert duplicate.status_code == 409
        assert duplicate.json()["detail"]["existing_item"]["id"] == saved.json()["id"]
        assert extension.post("/api/extension/items", json=payload).status_code == 401


def test_learner_creates_word_on_website_and_reads_it_back(tmp_path: Path) -> None:
    app = create_app(tmp_path / "web-word.sqlite3")
    with TestClient(app) as browser:
        register(browser, "learner")
        folder = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        created = browser.post("/api/items", json={
            "folder_id": folder, "category": "word", "text": "学习", "meaning": "học",
        }, headers=ORIGIN)
        assert created.status_code == 201, created.text
        assert created.json()["pinyin"] == "xué xí"
        assert any(item["id"] == created.json()["id"] for item in browser.get("/api/items").json())


def test_bulk_trash_only_removes_chosen_items_or_all_direct_items_in_owned_folder(tmp_path: Path) -> None:
    app = create_app(tmp_path / "bulk-trash.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        folder = alice.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        child = alice.post("/api/folders", json={"name": "Child", "parent_id": folder}, headers=ORIGIN).json()["id"]
        def create(folder_id: str, text: str) -> str:
            return alice.post("/api/items", json={"folder_id": folder_id, "category": "word", "text": text, "meaning": text}, headers=ORIGIN).json()["id"]
        first, second, nested = create(folder, "学习"), create(folder, "朋友"), create(child, "你好")
        endpoint = f"/api/folders/{folder}/trash-items"
        assert bob.post(endpoint, json={"item_ids": [first]}, headers=ORIGIN).status_code == 404
        assert alice.post(endpoint, json={"item_ids": [first, nested]}, headers=ORIGIN).status_code == 404
        assert {item["id"] for item in alice.get("/api/items").json()} == {first, second, nested}
        selected = alice.post(endpoint, json={"item_ids": [first]}, headers=ORIGIN)
        assert selected.status_code == 200 and selected.json() == {"count": 1}
        all_direct = alice.post(endpoint, json={}, headers=ORIGIN)
        assert all_direct.status_code == 200 and all_direct.json() == {"count": 1}
        assert {item["id"] for item in alice.get("/api/items").json()} == {nested}
        assert {item["id"] for item in alice.get("/api/trash").json() if item["kind"] == "item"} == {first, second}
        assert alice.post(endpoint, json={}).status_code == 403


def test_web_word_creation_enforces_folder_ownership_and_duplicate_scope(tmp_path: Path) -> None:
    app = create_app(tmp_path / "web-word-rules.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        one = alice.post("/api/folders", json={"name": "One"}, headers=ORIGIN).json()["id"]
        two = alice.post("/api/folders", json={"name": "Two"}, headers=ORIGIN).json()["id"]
        payload = {"folder_id": one, "category": "word", "text": "你好", "meaning": "xin chào"}
        first = alice.post("/api/items", json=payload, headers=ORIGIN)
        assert first.status_code == 201
        assert alice.post("/api/items", json=payload, headers=ORIGIN).status_code == 409
        assert alice.post("/api/items", json={**payload, "folder_id": two}, headers=ORIGIN).status_code == 201
        assert bob.post("/api/items", json=payload, headers=ORIGIN).status_code == 404
        assert alice.post("/api/items", json={**payload, "meaning": "  "}, headers=ORIGIN).status_code == 422
        assert alice.post("/api/items", json=payload).status_code == 403


def test_learner_gets_editable_meaning_suggestion_for_word(tmp_path: Path, monkeypatch) -> None:
    def translated_response(_request, timeout: int):
        assert timeout <= 10
        return BytesIO(b'[[["hoc tap","\xe5\xad\xa6\xe4\xb9\xa0",null,null,1]],null,"zh"]')

    monkeypatch.setattr("urllib.request.urlopen", translated_response)
    app = create_app(tmp_path / "suggestion.sqlite3")
    with TestClient(app) as browser:
        register(browser, "learner")
        suggested = browser.post("/api/items/meaning-suggestion", json={"text": "学习"}, headers=ORIGIN)
        assert suggested.status_code == 200, suggested.text
        assert suggested.json() == {"meaning": "hoc tap"}


def test_learner_can_enter_word_meaning_when_suggestion_unavailable(tmp_path: Path, monkeypatch) -> None:
    def unavailable(_request, timeout: int):
        raise OSError("translation service unavailable")

    monkeypatch.setattr("urllib.request.urlopen", unavailable)
    app = create_app(tmp_path / "suggestion-unavailable.sqlite3")
    with TestClient(app) as browser:
        register(browser, "learner")
        folder = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        assert browser.post("/api/items/meaning-suggestion", json={"text": "学习"}, headers=ORIGIN).status_code == 503
        saved = browser.post("/api/items", json={
            "folder_id": folder, "category": "word", "text": "学习", "meaning": "học",
        }, headers=ORIGIN)
        assert saved.status_code == 201, saved.text


def test_learner_creates_standalone_sentence_on_website(tmp_path: Path) -> None:
    app = create_app(tmp_path / "web-sentence.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        one = alice.post("/api/folders", json={"name": "One"}, headers=ORIGIN).json()["id"]
        two = alice.post("/api/folders", json={"name": "Two"}, headers=ORIGIN).json()["id"]
        payload = {"folder_id": one, "category": "sentence", "text": "我喜欢学习中文。", "meaning": "Tôi thích học tiếng Trung."}
        saved = alice.post("/api/items", json=payload, headers=ORIGIN)
        assert saved.status_code == 201, saved.text
        assert saved.json()["linked_item_ids"] == []
        assert saved.json()["pinyin"].startswith("wǒ xǐ huān")
        assert alice.post("/api/items", json=payload, headers=ORIGIN).status_code == 409
        assert alice.post("/api/items", json={**payload, "folder_id": two}, headers=ORIGIN).status_code == 201
        assert bob.post("/api/items", json=payload, headers=ORIGIN).status_code == 404
        assert alice.post("/api/items", json={**payload, "meaning": " "}, headers=ORIGIN).status_code == 422
        assert any(item["id"] == saved.json()["id"] for item in alice.get("/api/items").json())


def test_both_links_existing_word_and_edit_rechecks_collisions(tmp_path: Path) -> None:
    app = create_app(tmp_path / "both.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        one = browser.post("/api/folders", json={"name": "One"}, headers=ORIGIN).json()["id"]
        two = browser.post("/api/folders", json={"name": "Two"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        word = extension.post("/api/extension/items", json={"folder_id": one, "category": "word", "text": "学习", "meaning": "học"}, headers=bearer).json()
        both = extension.post("/api/extension/items/both", json={"folder_id": one, "word_text": "学习", "word_meaning": "nghĩa gợi ý khác", "sentence_text": "我喜欢学习中文。", "sentence_meaning": "Tôi thích học tiếng Trung."}, headers=bearer)
        assert both.status_code == 201, both.text
        assert both.json()["word"]["id"] == word["id"]
        assert both.json()["word"]["meaning"] == "học"
        corrected = extension.post("/api/extension/sync", json={
            "request_id": "corrected-word", "choice": "both", "item": {
                "folder_id": one, "word_text": "学习", "word_meaning": "học tập",
                "sentence_text": "我喜欢学习中文。", "sentence_meaning": "Tôi thích học tiếng Trung.",
                "update_existing_word_meaning": True,
            },
        }, headers=bearer)
        assert corrected.status_code == 201, corrected.text
        assert corrected.json()["word"]["id"] == word["id"]
        assert corrected.json()["word"]["meaning"] == "học tập"
        assert extension.post("/api/extension/sync", json={
            "request_id": "corrected-word", "choice": "both", "item": {
                "folder_id": one, "word_text": "学习", "word_meaning": "học tập",
                "sentence_text": "我喜欢学中文。", "sentence_meaning": "Tôi thích học tiếng Trung.",
                "update_existing_word_meaning": True,
            },
        }, headers=bearer).status_code == 409
        assert next(item for item in browser.get("/api/items").json() if item["id"] == word["id"])["meaning"] == "học tập"
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


def test_both_reuses_existing_sentence_and_only_updates_its_meaning_when_requested(tmp_path: Path) -> None:
    app = create_app(tmp_path / "reuse-sentence.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        first = extension.post("/api/extension/items/both", json={
            "folder_id": folder, "word_text": "标准", "word_meaning": "tiêu chuẩn",
            "sentence_text": "标准教程", "sentence_meaning": "giáo trình chuẩn",
        }, headers=bearer)
        assert first.status_code == 201, first.text
        sentence_id = first.json()["sentence"]["id"]
        existing = extension.get("/api/extension/items/existing", params={"folder_id": folder, "text": "标准教程"}, headers=bearer)
        assert existing.status_code == 200
        assert existing.json()["meaning"] == "giáo trình chuẩn"

        second_payload = {"request_id": "second-word", "choice": "both", "item": {
            "folder_id": folder, "word_text": "教程", "word_meaning": "giáo trình",
            "sentence_text": "标准教程", "sentence_meaning": "nghĩa gợi ý khác",
        }}
        second = extension.post("/api/extension/sync", json=second_payload, headers=bearer)
        assert second.status_code == 201, second.text
        assert second.json()["sentence"]["id"] == sentence_id
        assert second.json()["sentence"]["meaning"] == "giáo trình chuẩn"
        assert len(second.json()["sentence"]["linked_item_ids"]) == 2
        assert extension.post("/api/extension/sync", json=second_payload, headers=bearer).json() == second.json()

        edited = extension.post("/api/extension/items/both", json={
            "folder_id": folder, "word_text": "教程", "word_meaning": "giáo trình",
            "sentence_text": "标准教程", "sentence_meaning": "giáo trình tiêu chuẩn",
            "update_existing_sentence_meaning": True,
        }, headers=bearer)
        assert edited.status_code == 201, edited.text
        assert edited.json()["sentence"]["id"] == sentence_id
        assert edited.json()["sentence"]["meaning"] == "giáo trình tiêu chuẩn"
        assert len(edited.json()["sentence"]["linked_item_ids"]) == 2
        assert len(browser.get("/api/items").json()) == 3

        assert extension.get("/api/extension/items/existing", params={"folder_id": folder, "text": "khác"}, headers=bearer).json() is None
        assert extension.get("/api/extension/items/existing", params={"folder_id": folder, "text": "标准教程"}).status_code == 401


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
