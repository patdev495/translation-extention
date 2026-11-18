from pathlib import Path

from fastapi.testclient import TestClient

from web.server.database import connect
from web.server.main import create_app
from web.tests.test_folder_aggregate import entry, folder
from web.tests.test_learning_api import ORIGIN, register


def test_public_link_grants_read_only_access_to_exact_subtree(tmp_path: Path) -> None:
    app = create_app(tmp_path / "shares.sqlite3")
    with TestClient(app) as owner, TestClient(app) as stranger, TestClient(app) as guest:
        register(owner, "alice")
        register(stranger, "bob")
        parent = folder(owner, "Private parent")
        root = folder(owner, "Shared", parent)
        child = folder(owner, "Child", root)
        outside = folder(owner, "Private sibling", parent)
        private_sentence = entry(owner, outside, "sentence")
        shared_sentence = entry(owner, child, "sentence")
        shared_word = entry(owner, root, "word")
        for target in (private_sentence, shared_sentence):
            assert owner.post(f"/api/items/{shared_word}/links", json={"item_id": target}, headers=ORIGIN).status_code == 201

        manage = f"/api/folders/{root}/share-link"
        public = "/api/public-folder"
        assert owner.get(manage).json() == {"token": None}
        assert guest.get(public).status_code == 404
        assert guest.get(public, headers={"X-Folder-Share": root}).status_code == 404
        assert owner.put(manage).status_code == 403
        assert stranger.get(manage).status_code == 404
        assert stranger.put(manage, headers=ORIGIN).status_code == 404
        assert stranger.delete(manage, headers=ORIGIN).status_code == 404
        assert guest.put(manage, headers=ORIGIN).status_code == 401

        created = owner.put(manage, headers=ORIGIN)
        assert created.status_code == 200
        token = created.json()["token"]
        assert len(token) == 43
        assert "no-store" in created.headers["Cache-Control"]
        assert owner.put(manage, headers=ORIGIN).json() == {"token": token}
        assert owner.get(manage).json() == {"token": token}
        capability = {"X-Folder-Share": token}
        response = guest.get(public, headers=capability)
        assert response.status_code == 200
        assert "no-store" in response.headers["Cache-Control"]
        data = response.json()
        assert data["root_id"] == root
        assert {f["id"]: f["parent_id"] for f in data["folders"]} == {root: None, child: root}
        assert {i["id"]: i["linked_item_ids"] for i in data["items"]} == {
            shared_word: [shared_sentence], shared_sentence: [shared_word],
        }

        public_origin = {**ORIGIN, **capability}
        assert guest.get("/api/folders", headers=capability).status_code == 401
        assert guest.patch(f"/api/folders/{child}", json={"name": "Edited"}, headers=public_origin).status_code == 401
        assert guest.delete(f"/api/items/{shared_word}", headers=public_origin).status_code == 401
        assert stranger.patch(f"/api/items/{shared_word}", json={"meaning": "Edited"}, headers=public_origin).status_code == 404
        assert stranger.get("/api/items", headers=capability).json() == []
        assert owner.delete(manage, headers=ORIGIN).status_code == 204
        assert guest.get(public, headers=capability).status_code == 404
        renewed = owner.put(manage, headers=ORIGIN).json()["token"]
        assert renewed != token
        assert guest.get(public, headers=capability).status_code == 404
        assert guest.get(public, headers={"X-Folder-Share": renewed}).status_code == 200


def test_link_follows_live_tree_and_is_removed_on_permanent_deletion(tmp_path: Path) -> None:
    db = tmp_path / "shares.sqlite3"
    app = create_app(db)
    with TestClient(app) as owner, TestClient(app) as guest:
        register(owner, "alice")
        root = folder(owner, "Shared")
        child = folder(owner, "Child", root)
        token = owner.put(f"/api/folders/{root}/share-link", headers=ORIGIN).json()["token"]
        public = "/api/public-folder"
        capability = {"X-Folder-Share": token}
        assert owner.patch(f"/api/folders/{child}", json={"parent_id": None}, headers=ORIGIN).status_code == 200
        assert [f["id"] for f in guest.get(public, headers=capability).json()["folders"]] == [root]
        assert owner.delete(f"/api/folders/{root}", headers=ORIGIN).status_code == 204
        assert guest.get(public, headers=capability).status_code == 404
        assert owner.post(f"/api/trash/folders/{root}/restore", headers=ORIGIN).status_code == 200
        assert guest.get(public, headers=capability).status_code == 200
        assert owner.delete(f"/api/folders/{root}", headers=ORIGIN).status_code == 204
        assert owner.delete(f"/api/trash/folders/{root}", headers=ORIGIN).status_code == 204
        with connect(db) as connection:
            assert connection.execute("SELECT COUNT(*) FROM folder_share_links").fetchone()[0] == 0
