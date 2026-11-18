from pathlib import Path

from fastapi.testclient import TestClient

from web.server.database import connect
from web.server.main import create_app
from web.tests.test_folder_aggregate import entry, folder
from web.tests.test_learning_api import ORIGIN, register


def test_shared_subtree_is_visible_only_to_granted_account_and_cannot_be_edited(tmp_path: Path) -> None:
    app = create_app(tmp_path / "shares.sqlite3")
    with TestClient(app) as owner, TestClient(app) as viewer, TestClient(app) as stranger:
        owner_account = register(owner, "alice")
        viewer_account = register(viewer, "bob")
        register(stranger, "carol")
        parent = folder(owner, "Private parent")
        root = folder(owner, "Shared", parent)
        child = folder(owner, "Child", root)
        outside = folder(owner, "Private sibling", parent)
        private_sentence = entry(owner, outside, "sentence")
        shared_sentence = entry(owner, child, "sentence")
        shared_word = entry(owner, root, "word")
        for target in (private_sentence, shared_sentence):
            assert owner.post(f"/api/items/{shared_word}/links", json={"item_id": target}, headers=ORIGIN).status_code == 201

        viewers = f"/api/folders/{root}/viewers"
        contents = f"/api/shared-folders/{root}"
        assert viewer.get(contents).status_code == 404
        assert stranger.get("/api/shared-folders").json() == []
        assert owner.post(viewers, json={"username": "bob"}).status_code == 403
        assert owner.post(viewers, json={"username": "nobody"}, headers=ORIGIN).status_code == 404
        assert owner.post(viewers, json={"username": owner_account["username"]}, headers=ORIGIN).status_code == 400
        for username in (" BOB ", "bob"):
            assert owner.post(viewers, json={"username": username}, headers=ORIGIN).json() == viewer_account
        assert owner.get(viewers).json() == [viewer_account]
        assert viewer.get("/api/shared-folders").json() == [
            {"id": root, "name": "Shared", "parent_id": None, "owner_username": "alice"},
        ]
        response = viewer.get(contents)
        assert response.status_code == 200
        assert "no-store" in response.headers["Cache-Control"]
        data = response.json()
        assert {f["id"]: f["parent_id"] for f in data["folders"]} == {root: None, child: root}
        assert {i["id"]: i["linked_item_ids"] for i in data["items"]} == {
            shared_word: [shared_sentence], shared_sentence: [shared_word],
        }

        assert stranger.get(contents).status_code == 404
        assert viewer.get(f"/api/shared-folders/{parent}").status_code == 404
        assert viewer.get(f"/api/shared-folders/{outside}").status_code == 404
        assert viewer.get("/api/folders").json() == []
        assert viewer.get("/api/items").json() == []
        assert viewer.get(f"/api/review/overview?folder_id={root}").status_code == 404
        assert viewer.get(viewers).status_code == 404
        assert viewer.post(viewers, json={"username": "carol"}, headers=ORIGIN).status_code == 404
        assert viewer.delete(f"{viewers}/{viewer_account['id']}", headers=ORIGIN).status_code == 404
        assert viewer.patch(f"/api/folders/{child}", json={"name": "Edited"}, headers=ORIGIN).status_code == 404
        assert viewer.patch(f"/api/items/{shared_word}", json={"meaning": "Edited"}, headers=ORIGIN).status_code == 404
        assert viewer.delete(f"/api/items/{shared_word}", headers=ORIGIN).status_code == 404

        assert owner.delete(f"{viewers}/{viewer_account['id']}", headers=ORIGIN).status_code == 204
        assert viewer.get(contents).status_code == 404
        assert viewer.get("/api/shared-folders").json() == []


def test_share_follows_live_tree_and_is_removed_on_permanent_deletion(tmp_path: Path) -> None:
    db = tmp_path / "shares.sqlite3"
    app = create_app(db)
    with TestClient(app) as owner, TestClient(app) as viewer:
        register(owner, "alice")
        register(viewer, "bob")
        root = folder(owner, "Shared")
        child = folder(owner, "Child", root)
        assert owner.post(f"/api/folders/{root}/viewers", json={"username": "bob"}, headers=ORIGIN).status_code == 200
        assert owner.patch(f"/api/folders/{child}", json={"parent_id": None}, headers=ORIGIN).status_code == 200
        assert [f["id"] for f in viewer.get(f"/api/shared-folders/{root}").json()["folders"]] == [root]

        assert owner.delete(f"/api/folders/{root}", headers=ORIGIN).status_code == 204
        assert viewer.get("/api/shared-folders").json() == []
        assert viewer.get(f"/api/shared-folders/{root}").status_code == 404
        assert owner.post(f"/api/trash/folders/{root}/restore", headers=ORIGIN).status_code == 200
        assert viewer.get(f"/api/shared-folders/{root}").status_code == 200
        assert owner.delete(f"/api/folders/{root}", headers=ORIGIN).status_code == 204
        assert owner.delete(f"/api/trash/folders/{root}", headers=ORIGIN).status_code == 204
        with connect(db) as connection:
            assert connection.execute("SELECT COUNT(*) FROM folder_viewers").fetchone()[0] == 0
