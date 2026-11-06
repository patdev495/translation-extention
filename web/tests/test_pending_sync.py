from pathlib import Path

from fastapi.testclient import TestClient

from web.server.main import create_app
from web.tests.test_saved_items import ORIGIN, link, register


def test_retry_after_lost_response_creates_one_item(tmp_path: Path) -> None:
    app = create_app(tmp_path / "sync.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder_id = browser.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        payload = {
            "request_id": "save-1",
            "choice": "word",
            "item": {"folder_id": folder_id, "category": "word", "text": "你好", "meaning": "xin chào"},
        }

        first = extension.post("/api/extension/sync", json=payload, headers=bearer)
        retry = extension.post("/api/extension/sync", json=payload, headers=bearer)

        assert first.status_code == 201, first.text
        assert retry.status_code == 201, retry.text
        assert retry.json() == first.json()
        assert [(item["text"], item["folder_id"], item["pinyin"]) for item in browser.get("/api/items").json()] == [
            ("你好", folder_id, "nǐ hǎo"),
        ]


def test_paired_retry_keeps_one_linked_word_and_sentence(tmp_path: Path) -> None:
    app = create_app(tmp_path / "pair.sqlite3")
    with TestClient(app) as browser, TestClient(app) as extension:
        register(browser, "learner")
        folder_id = browser.post("/api/folders", json={"name": "Bài 1"}, headers=ORIGIN).json()["id"]
        bearer = link(browser, extension)
        payload = {
            "request_id": "paired-1", "choice": "both",
            "item": {"folder_id": folder_id, "word_text": "学习", "word_meaning": "học",
                     "sentence_text": "我学习中文。", "sentence_meaning": "Tôi học tiếng Trung."},
        }

        first = extension.post("/api/extension/sync", json=payload, headers=bearer)
        retry = extension.post("/api/extension/sync", json=payload, headers=bearer)

        assert first.status_code == retry.status_code == 201
        assert retry.json() == first.json()
        items = browser.get("/api/items").json()
        assert len(items) == 2
        word = next(item for item in items if item["category"] == "word")
        sentence = next(item for item in items if item["category"] == "sentence")
        assert word["linked_item_ids"] == [sentence["id"]]
        assert sentence["linked_item_ids"] == [word["id"]]


def test_request_id_is_scoped_to_account_and_cannot_be_reused_for_other_content(tmp_path: Path) -> None:
    app = create_app(tmp_path / "account-sync.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob, TestClient(app) as extension:
        register(alice, "alice")
        register(bob, "bob")
        alice_folder = alice.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        bob_folder = bob.post("/api/folders", json={"name": "HSK"}, headers=ORIGIN).json()["id"]
        alice_bearer = link(alice, extension)
        bob_bearer = link(bob, extension)
        alice_payload = {"request_id": "same-id", "choice": "word", "item": {
            "folder_id": alice_folder, "category": "word", "text": "你好", "meaning": "xin chào",
        }}
        bob_payload = {"request_id": "same-id", "choice": "word", "item": {
            "folder_id": bob_folder, "category": "word", "text": "学习", "meaning": "học",
        }}

        assert extension.post("/api/extension/sync", json=alice_payload, headers=alice_bearer).status_code == 201
        assert extension.post("/api/extension/sync", json=bob_payload, headers=bob_bearer).status_code == 201
        assert extension.post("/api/extension/sync", json=bob_payload, headers=alice_bearer).status_code == 409
        assert [item["text"] for item in alice.get("/api/items").json()] == ["你好"]
        assert [item["text"] for item in bob.get("/api/items").json()] == ["学习"]
