from pathlib import Path
import sqlite3

from fastapi.testclient import TestClient

from web.server.main import create_app

ORIGIN = {"Origin": "http://127.0.0.1:5173"}


def register(client: TestClient, name: str) -> None:
    assert client.post("/api/auth/register", json={"username": name, "password": "pass"}, headers=ORIGIN).status_code == 201


def folder(client: TestClient, name: str) -> str:
    response = client.post("/api/folders", json={"name": name}, headers=ORIGIN)
    assert response.status_code == 201
    return response.json()["id"]


def item(client: TestClient, folder_id: str, category: str, text: str, meaning: str) -> str:
    response = client.post("/api/items", json={"folder_id": folder_id, "category": category, "text": text, "meaning": meaning}, headers=ORIGIN)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_learner_links_existing_items_across_folders_and_removes_link_without_deleting_items(tmp_path: Path) -> None:
    app = create_app(tmp_path / "links.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        first, second = folder(alice, "First"), folder(alice, "Second")
        word = item(alice, first, "word", "学习", "học")
        sentence = item(alice, second, "sentence", "今天天气好。", "Hôm nay đẹp trời.")
        other = item(alice, second, "sentence", "我去学校。", "Tôi đến trường.")
        for target in (sentence, other):
            assert alice.post(f"/api/items/{word}/links", json={"item_id": target}, headers=ORIGIN).status_code == 201
        listed = {entry["id"]: entry for entry in alice.get("/api/items").json()}
        assert set(listed[word]["linked_item_ids"]) == {sentence, other}
        assert listed[sentence]["linked_item_ids"] == [word]
        assert alice.patch(f"/api/items/{word}", json={"category": "sentence"}, headers=ORIGIN).status_code == 409
        assert alice.patch(f"/api/items/{sentence}", json={"folder_id": first}, headers=ORIGIN).status_code == 200
        assert bob.post(f"/api/items/{word}/links", json={"item_id": sentence}, headers=ORIGIN).status_code == 404
        assert alice.delete(f"/api/items/{word}/links/{sentence}", headers=ORIGIN).status_code == 204
        listed = {entry["id"]: entry for entry in alice.get("/api/items").json()}
        assert listed[word]["linked_item_ids"] == [other]
        assert listed[sentence]["linked_item_ids"] == []
        assert listed[sentence]["folder_id"] == first


def test_word_save_with_multiple_examples_reuses_same_folder_sentence_and_rolls_back_on_error(tmp_path: Path) -> None:
    app = create_app(tmp_path / "examples.sqlite3")
    with TestClient(app) as client:
        register(client, "learner")
        first, second = folder(client, "First"), folder(client, "Second")
        reused = item(client, first, "sentence", "我学习。", "Original meaning")
        elsewhere = item(client, second, "sentence", "我读书。", "Elsewhere")
        payload = {"item": {"folder_id": first, "category": "word", "text": "学习", "meaning": "học"},
                   "examples": [{"text": "我学习。", "meaning": "New meaning"}, {"text": "我读书。", "meaning": "Tôi đọc sách."}, {"item_id": elsewhere}]}
        saved = client.post("/api/items/with-examples", json=payload, headers=ORIGIN)
        assert saved.status_code == 201, saved.text
        listed = client.get("/api/items").json()
        assert len(listed) == 4
        assert next(entry for entry in listed if entry["id"] == reused)["meaning"] == "Original meaning"
        assert set(saved.json()["linked_item_ids"]) == {reused, elsewhere, next(entry["id"] for entry in listed if entry["text"] == "我读书。" and entry["folder_id"] == first)}
        failed = client.post("/api/items/with-examples", json={"item": payload["item"], "examples": [{"text": "新句子。", "meaning": "New"}]}, headers=ORIGIN)
        assert failed.status_code == 409
        assert all(entry["text"] != "新句子。" for entry in client.get("/api/items").json())


def test_grammar_can_save_without_examples_or_with_multiple_examples_and_duplicate_structure_is_rejected(tmp_path: Path) -> None:
    app = create_app(tmp_path / "grammar.sqlite3")
    with TestClient(app) as client:
        register(client, "learner")
        first, second = folder(client, "First"), folder(client, "Second")
        standalone = client.post("/api/items", json={"folder_id": first, "category": "grammar", "text": "把 + đồ vật", "meaning": "Chuyển đồ vật"}, headers=ORIGIN)
        assert standalone.status_code == 201, standalone.text
        assert standalone.json()["pinyin"] == ""
        existing = item(client, second, "sentence", "我把书放下。", "Tôi đặt sách xuống.")
        saved = client.post("/api/items/with-examples", json={"item": {"folder_id": second, "category": "grammar", "text": "把 + đồ vật", "meaning": "Cấu trúc khác"}, "examples": [{"item_id": existing}, {"text": "把门关上。", "meaning": "Đóng cửa lại."}]}, headers=ORIGIN)
        assert saved.status_code == 201, saved.text
        assert len(saved.json()["linked_item_ids"]) == 2
        assert client.post("/api/items", json={"folder_id": second, "category": "grammar", "text": "把 + đồ vật", "meaning": "Mô tả mới"}, headers=ORIGIN).status_code == 409


def test_notes_keep_multiline_body_allow_duplicates_and_cannot_convert_or_link(tmp_path: Path) -> None:
    app = create_app(tmp_path / "notes.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        first, second = folder(alice, "First"), folder(alice, "Second")
        payload = {"folder_id": first, "category": "note", "text": "Nhắc nhớ", "meaning": "Dòng 1\n**Dòng 2**"}
        one = alice.post("/api/items", json=payload, headers=ORIGIN)
        two = alice.post("/api/items", json=payload, headers=ORIGIN)
        assert one.status_code == two.status_code == 201
        note_id = one.json()["id"]
        assert one.json()["pinyin"] == ""
        assert alice.patch(f"/api/items/{note_id}", json={"folder_id": second, "meaning": "Sửa\nDòng hai"}, headers=ORIGIN).status_code == 200
        assert next(entry for entry in alice.get("/api/items").json() if entry["id"] == note_id)["meaning"] == "Sửa\nDòng hai"
        assert alice.patch(f"/api/items/{note_id}", json={"category": "word"}, headers=ORIGIN).status_code == 422
        assert alice.post(f"/api/items/{note_id}/links", json={"item_id": two.json()["id"]}, headers=ORIGIN).status_code == 422
        assert bob.patch(f"/api/items/{note_id}", json={"text": "stolen"}, headers=ORIGIN).status_code == 404
        assert alice.delete(f"/api/items/{note_id}", headers=ORIGIN).status_code == 204
        assert any(entry["id"] == note_id for entry in alice.get("/api/trash").json())
        restored = alice.post(f"/api/trash/items/{note_id}/restore", headers=ORIGIN)
        assert restored.status_code == 200
        assert restored.json()["folder_id"] == second


def test_editing_grammar_adds_new_example_atomically(tmp_path: Path) -> None:
    app = create_app(tmp_path / "edit-grammar.sqlite3")
    with TestClient(app) as client:
        register(client, "learner")
        place = folder(client, "HSK")
        grammar = item(client, place, "grammar", "把 + N", "Original")
        saved = client.patch(f"/api/items/{grammar}/with-examples", json={"item": {"meaning": "Updated"}, "examples": [{"text": "把门关上。", "meaning": "Đóng cửa."}]}, headers=ORIGIN)
        assert saved.status_code == 200, saved.text
        assert len(saved.json()["linked_item_ids"]) == 1
        failed = client.patch(f"/api/items/{grammar}/with-examples", json={"item": {"meaning": "Should roll back"}, "examples": [{"text": "Thiếu nghĩa", "meaning": " "}]}, headers=ORIGIN)
        assert failed.status_code == 422
        unchanged = next(entry for entry in client.get("/api/items").json() if entry["id"] == grammar)
        assert unchanged["meaning"] == "Updated"


def test_note_restores_to_original_folder_even_when_title_matches_another_note(tmp_path: Path) -> None:
    app = create_app(tmp_path / "restore-note.sqlite3")
    with TestClient(app) as client:
        register(client, "learner")
        place = folder(client, "HSK")
        first = item(client, place, "note", "Same title", "First body")
        item(client, place, "note", "Same title", "Second body")
        assert client.delete(f"/api/items/{first}", headers=ORIGIN).status_code == 204
        restored = client.post(f"/api/trash/items/{first}/restore", headers=ORIGIN)
        assert restored.status_code == 200
        assert restored.json()["folder_id"] == place


def test_existing_database_migrates_without_losing_learning_links(tmp_path: Path) -> None:
    path = tmp_path / "legacy.sqlite3"
    app = create_app(path)
    with TestClient(app) as client:
        register(client, "learner")
        place = folder(client, "HSK")
        word = item(client, place, "word", "学习", "học")
        sentence = item(client, place, "sentence", "我学习。", "Tôi học.")
        assert client.post(f"/api/items/{word}/links", json={"item_id": sentence}, headers=ORIGIN).status_code == 201
    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA foreign_keys = OFF")
        links = connection.execute("SELECT word_id, sentence_id FROM learning_item_links").fetchall()
        connection.execute("DROP TABLE learning_item_links")
        connection.execute("ALTER TABLE learning_items RENAME TO learning_items_current")
        connection.execute("""CREATE TABLE learning_items (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), folder_id TEXT NOT NULL REFERENCES folders(id),
            category TEXT NOT NULL CHECK (category IN ('word', 'sentence')), text TEXT NOT NULL,
            meaning TEXT NOT NULL, pinyin TEXT NOT NULL, created_at INTEGER NOT NULL,
            deleted_at INTEGER, trash_root_id TEXT)""")
        connection.execute("INSERT INTO learning_items SELECT * FROM learning_items_current")
        connection.execute("DROP TABLE learning_items_current")
        connection.execute("CREATE TABLE learning_item_links (word_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE, sentence_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE, PRIMARY KEY (word_id, sentence_id))")
        connection.executemany("INSERT INTO learning_item_links VALUES (?, ?)", links)
    app = create_app(path)
    with TestClient(app) as client:
        assert client.post("/api/auth/login", json={"username": "learner", "password": "pass"}, headers=ORIGIN).status_code == 200
        assert client.post("/api/items", json={"folder_id": place, "category": "note", "text": "T", "meaning": "Body"}, headers=ORIGIN).status_code == 201
        listed = {entry["id"]: entry for entry in client.get("/api/items").json()}
        assert listed[word]["linked_item_ids"] == [sentence]


def test_extension_cannot_create_web_only_categories(tmp_path: Path) -> None:
    app = create_app(tmp_path / "extension-categories.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        place = folder(browser, "HSK")
        started = extension.post("/api/link/start").json()
        assert browser.post(f"/api/link/approve/{started['request_id']}", headers=ORIGIN).status_code == 204
        token = extension.post("/api/link/poll", json={"request_id": started["request_id"], "poll_secret": started["poll_secret"]}).json()["token"]
        response = extension.post("/api/extension/items", json={"folder_id": place, "category": "note", "text": "Title", "meaning": "Body"}, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 422
