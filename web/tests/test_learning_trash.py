from pathlib import Path

from fastapi.testclient import TestClient

from web.server.main import create_app
from web.tests.test_saved_items import ORIGIN, link, register


def test_deleted_item_moves_to_trash_and_can_be_restored(tmp_path: Path) -> None:
    app = create_app(tmp_path / "trash.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder_id = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        saved = extension.post("/api/extension/items", json={
            "folder_id": folder_id, "category": "word", "text": "你好", "meaning": "xin chào",
        }, headers=bearer).json()

        assert browser.delete(f"/api/items/{saved['id']}", headers=ORIGIN).status_code == 204
        assert browser.get("/api/items").json() == []
        assert browser.get("/api/trash").json() == [{
            "id": saved["id"], "kind": "item", "name": "你好", "category": "word", "folder_id": folder_id,
        }]
        restored = browser.post(f"/api/trash/items/{saved['id']}/restore", headers=ORIGIN)
        assert restored.status_code == 200, restored.text
        assert restored.json()["id"] == saved["id"]
        assert browser.get("/api/trash").json() == []
        assert browser.get("/api/items").json()[0]["text"] == "你好"


def test_deleted_folder_restores_nested_tree_and_linked_pair(tmp_path: Path) -> None:
    app = create_app(tmp_path / "nested.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        root = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        child = browser.post("/api/folders", json={"name": "Bài 1", "parent_id": root}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        pair = extension.post("/api/extension/items/both", json={
            "folder_id": child, "word_text": "学习", "word_meaning": "học",
            "sentence_text": "我学习中文。", "sentence_meaning": "Tôi học tiếng Trung.",
        }, headers=bearer).json()

        assert browser.delete(f"/api/folders/{root}", headers=ORIGIN).status_code == 204
        assert browser.get("/api/folders").json() == []
        assert browser.get("/api/items").json() == []
        assert [(entry["kind"], entry["id"]) for entry in browser.get("/api/trash").json()] == [("folder", root)]
        assert browser.post(f"/api/trash/folders/{root}/restore", headers=ORIGIN).status_code == 200
        assert {folder["id"] for folder in browser.get("/api/folders").json()} == {root, child}
        items = browser.get("/api/items").json()
        assert {item["id"] for item in items} == {pair["word"]["id"], pair["sentence"]["id"]}
        assert next(item for item in items if item["id"] == pair["word"]["id"])["linked_item_ids"] == [pair["sentence"]["id"]]


def test_restore_folder_with_unavailable_parent_moves_tree_to_root(tmp_path: Path) -> None:
    app = create_app(tmp_path / "missing-parent.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        parent = browser.post("/api/folders", json={"name": "Parent"}, headers=ORIGIN).json()["id"]
        child = browser.post("/api/folders", json={"name": "Child", "parent_id": parent}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        item_id = extension.post("/api/extension/items", json={
            "folder_id": child, "category": "word", "text": "学习", "meaning": "học",
        }, headers=bearer).json()["id"]
        assert browser.delete(f"/api/folders/{child}", headers=ORIGIN).status_code == 204
        assert browser.delete(f"/api/folders/{parent}", headers=ORIGIN).status_code == 204

        restored = browser.post(f"/api/trash/folders/{child}/restore", headers=ORIGIN)

        assert restored.status_code == 200, restored.text
        assert restored.json()["parent_id"] is None
        assert browser.get("/api/items").json()[0]["id"] == item_id
        assert {entry["id"] for entry in browser.get("/api/trash").json()} == {parent}


def test_restore_item_with_unavailable_folder_uses_recovery_folder(tmp_path: Path) -> None:
    app = create_app(tmp_path / "recover-item.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder_id = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        item_id = extension.post("/api/extension/items", json={
            "folder_id": folder_id, "category": "word", "text": "你好", "meaning": "xin chào",
        }, headers=bearer).json()["id"]
        assert browser.delete(f"/api/items/{item_id}", headers=ORIGIN).status_code == 204
        assert browser.delete(f"/api/folders/{folder_id}", headers=ORIGIN).status_code == 204

        restored = browser.post(f"/api/trash/items/{item_id}/restore", headers=ORIGIN)

        assert restored.status_code == 200, restored.text
        assert restored.json()["folder_id"] != folder_id
        assert browser.get("/api/items").json()[0]["id"] == item_id
        assert {folder["id"] for folder in browser.get("/api/folders").json()} == {restored.json()["folder_id"]}


def test_permanent_delete_and_empty_trash_require_explicit_calls(tmp_path: Path) -> None:
    app = create_app(tmp_path / "permanent.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        child = browser.post("/api/folders", json={"name": "Bài 1", "parent_id": folder}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        item = extension.post("/api/extension/items", json={
            "folder_id": child, "category": "word", "text": "你好", "meaning": "xin chào",
        }, headers=bearer).json()["id"]
        assert browser.delete(f"/api/items/{item}", headers=ORIGIN).status_code == 204
        assert browser.get("/api/trash").json()[0]["id"] == item
        assert browser.delete(f"/api/trash/items/{item}", headers=ORIGIN).status_code == 204
        assert browser.post(f"/api/trash/items/{item}/restore", headers=ORIGIN).status_code == 404
        assert browser.delete(f"/api/folders/{folder}", headers=ORIGIN).status_code == 204
        assert browser.get("/api/trash").json()[0]["id"] == folder
        assert browser.delete("/api/trash", headers=ORIGIN).status_code == 204
        assert browser.get("/api/trash").json() == []
        assert browser.post(f"/api/trash/folders/{folder}/restore", headers=ORIGIN).status_code == 404


def test_trash_cannot_be_read_restored_or_purged_by_other_account(tmp_path: Path) -> None:
    app = create_app(tmp_path / "isolation.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob, TestClient(app) as extension:
        register(alice, "alice")
        register(bob, "bob")
        folder = alice.post("/api/folders", json={"name": "Secret"}, headers=ORIGIN).json()["id"]
        bearer = link(alice, extension)
        item = extension.post("/api/extension/items", json={
            "folder_id": folder, "category": "word", "text": "秘密", "meaning": "bí mật",
        }, headers=bearer).json()["id"]
        assert alice.delete(f"/api/items/{item}", headers=ORIGIN).status_code == 204
        assert alice.delete(f"/api/folders/{folder}", headers=ORIGIN).status_code == 204

        assert bob.get("/api/trash").json() == []
        assert bob.post(f"/api/trash/items/{item}/restore", headers=ORIGIN).status_code == 404
        assert bob.delete(f"/api/trash/items/{item}", headers=ORIGIN).status_code == 404
        assert bob.post(f"/api/trash/folders/{folder}/restore", headers=ORIGIN).status_code == 404
        assert bob.delete(f"/api/trash/folders/{folder}", headers=ORIGIN).status_code == 404
        assert bob.delete("/api/trash", headers=ORIGIN).status_code == 204
        assert {entry["id"] for entry in alice.get("/api/trash").json()} == {item, folder}


def test_permanent_folder_delete_keeps_separately_trashed_item(tmp_path: Path) -> None:
    app = create_app(tmp_path / "separate-trash.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        child = browser.post("/api/folders", json={"name": "Bài 1", "parent_id": folder}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        item = extension.post("/api/extension/items", json={
            "folder_id": child, "category": "word", "text": "你好", "meaning": "xin chào",
        }, headers=bearer).json()["id"]
        browser.delete(f"/api/items/{item}", headers=ORIGIN)
        browser.delete(f"/api/folders/{folder}", headers=ORIGIN)

        deleted = browser.delete(f"/api/trash/folders/{folder}", headers=ORIGIN)

        assert deleted.status_code == 204, deleted.text
        assert [entry["id"] for entry in browser.get("/api/trash").json()] == [item]
        restored = browser.post(f"/api/trash/items/{item}/restore", headers=ORIGIN)
        assert restored.status_code == 200, restored.text
        assert restored.json()["text"] == "你好"


def test_restore_folder_with_missing_parent_and_name_collision_keeps_both_folders(tmp_path: Path) -> None:
    app = create_app(tmp_path / "folder-collision.sqlite3")
    with TestClient(app) as browser:
        register(browser, "learner")
        parent = browser.post("/api/folders", json={"name": "Parent"}, headers=ORIGIN).json()["id"]
        child = browser.post("/api/folders", json={"name": "HSK", "parent_id": parent}, headers=ORIGIN).json()["id"]
        browser.delete(f"/api/folders/{child}", headers=ORIGIN)
        browser.delete(f"/api/folders/{parent}", headers=ORIGIN)
        other = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]

        restored = browser.post(f"/api/trash/folders/{child}/restore", headers=ORIGIN)

        assert restored.status_code == 200, restored.text
        assert restored.json()["id"] == child
        assert restored.json()["name"] != "HSK"
        assert {folder["id"] for folder in browser.get("/api/folders").json()} == {child, other}


def test_individual_linked_item_recovers_navigation_when_restored(tmp_path: Path) -> None:
    app = create_app(tmp_path / "linked-recovery.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        pair = extension.post("/api/extension/items/both", json={
            "folder_id": folder, "word_text": "学习", "word_meaning": "học",
            "sentence_text": "我学习中文。", "sentence_meaning": "Tôi học tiếng Trung.",
        }, headers=bearer).json()
        word_id = pair["word"]["id"]
        sentence_id = pair["sentence"]["id"]

        browser.delete(f"/api/items/{word_id}", headers=ORIGIN)
        active = browser.get("/api/items").json()
        assert active[0]["linked_item_ids"] == []
        assert browser.post(f"/api/trash/items/{word_id}/restore", headers=ORIGIN).status_code == 200
        restored = {item["id"]: item for item in browser.get("/api/items").json()}
        assert restored[word_id]["linked_item_ids"] == [sentence_id]
        assert restored[sentence_id]["linked_item_ids"] == [word_id]
