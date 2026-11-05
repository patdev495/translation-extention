"""Typed FastAPI entry point for the companion learning website."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pwdlib import PasswordHash
from pypinyin import Style, lazy_pinyin

from .database import connect, initialize

WEB_SESSION_SECONDS = 30 * 24 * 60 * 60
EXTENSION_SESSION_SECONDS = 90 * 24 * 60 * 60
LINK_REQUEST_SECONDS = 5 * 60
COOKIE_NAME = "polytranslate_session"
password_hash = PasswordHash.recommended()


class LoginCredentials(BaseModel):
    username: str = Field(pattern=r"^[A-Za-z0-9_.@-]+$")
    password: str

    @field_validator("username", mode="before")
    @classmethod
    def trim_username(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def require_password(cls, value: str) -> str:
        if not value:
            raise ValueError("Password is required")
        return value


class RegisterCredentials(LoginCredentials):
    username: str = Field(pattern=r"^[A-Za-z0-9_.-]+$")


class Account(BaseModel):
    id: str
    username: str


class LinkStart(BaseModel):
    request_id: str
    poll_secret: str
    approve_url: str
    expires_at: int


class LinkPollRequest(BaseModel):
    request_id: str
    poll_secret: str


class LinkPollResult(BaseModel):
    state: Literal["pending", "linked"]
    token: str | None = None
    account: Account | None = None


class FolderInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    parent_id: str | None = None


class FolderUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    parent_id: str | None = None


class Folder(BaseModel):
    id: str
    name: str
    parent_id: str | None


class ItemInput(BaseModel):
    folder_id: str
    category: Literal["word", "sentence"]
    text: str = Field(min_length=1)
    meaning: str = Field(min_length=1)

    @field_validator("text", "meaning")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Value is required")
        return value


class ItemUpdate(BaseModel):
    folder_id: str | None = None
    category: Literal["word", "sentence"] | None = None
    text: str | None = None
    meaning: str | None = None


class BothInput(BaseModel):
    folder_id: str
    word_text: str = Field(min_length=1)
    word_meaning: str = Field(min_length=1)
    sentence_text: str = Field(min_length=1)
    sentence_meaning: str = Field(min_length=1)

    @field_validator('word_text', 'word_meaning', 'sentence_text', 'sentence_meaning')
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('Value is required')
        return value


class SyncInput(BaseModel):
    request_id: str = Field(min_length=1, max_length=100)
    choice: Literal["word", "sentence", "both"]
    item: ItemInput | BothInput


class Item(BaseModel):
    id: str
    folder_id: str
    category: Literal["word", "sentence"]
    text: str
    meaning: str
    pinyin: str
    linked_item_ids: list[str]


class TrashEntry(BaseModel):
    id: str
    kind: Literal["item", "folder"]
    name: str
    category: Literal["word", "sentence"] | None = None
    folder_id: str | None = None


def _now() -> int:
    return int(time.time())


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_id() -> str:
    return str(uuid.uuid4())


def _account(row: sqlite3.Row) -> Account:
    return Account(id=str(row["id"]), username=str(row["username"]))


def _folder(row: sqlite3.Row) -> Folder:
    return Folder(id=str(row["id"]), name=str(row["name"]), parent_id=row["parent_id"])


def create_app(database_path: Path | None = None) -> FastAPI:
    db_path = database_path or Path(os.getenv("POLY_LEARNING_DB", "web/data/learning.sqlite3"))
    web_origin = os.getenv("POLY_WEB_ORIGIN", "http://127.0.0.1:5173").rstrip("/")
    secure_cookies = os.getenv("POLY_SECURE_COOKIES", "0") == "1"
    initialize(db_path)
    app = FastAPI(title="PolyTranslate Learning API")

    def require_browser_origin(request: Request) -> None:
        origin = request.headers.get("origin")
        parsed = urlsplit(web_origin)
        allowed_origins = {web_origin}
        if parsed.hostname in {"127.0.0.1", "localhost"}:
            port = f":{parsed.port}" if parsed.port is not None else ""
            allowed_origins.update({f"{parsed.scheme}://127.0.0.1{port}", f"{parsed.scheme}://localhost{port}"})
        if origin not in allowed_origins:
            raise HTTPException(status_code=403, detail="Untrusted browser origin")

    def current_account(request: Request, kind: Literal["web", "extension"]) -> Account:
        if kind == "web":
            token = request.cookies.get(COOKIE_NAME)
        else:
            authorization = request.headers.get("authorization", "")
            token = authorization[7:] if authorization.startswith("Bearer ") else None
        if not token:
            raise HTTPException(status_code=401, detail="Sign in required")
        with connect(db_path) as connection:
            row = connection.execute(
                """SELECT users.id, users.username FROM sessions
                   JOIN users ON users.id = sessions.user_id
                   WHERE sessions.token_hash = ? AND sessions.kind = ?
                     AND sessions.expires_at > ? AND sessions.revoked_at IS NULL""",
                (_digest(token), kind, _now()),
            ).fetchone()
        if row is None:
            raise HTTPException(status_code=401, detail="Session expired or revoked")
        return _account(row)

    def web_account(request: Request) -> Account:
        return current_account(request, "web")

    def extension_account(request: Request) -> Account:
        return current_account(request, "extension")

    def create_session(connection: sqlite3.Connection, user_id: str, kind: Literal["web", "extension"]) -> str:
        token = secrets.token_urlsafe(32)
        seconds = WEB_SESSION_SECONDS if kind == "web" else EXTENSION_SESSION_SECONDS
        connection.execute(
            "INSERT INTO sessions (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)",
            (_digest(token), user_id, kind, _now() + seconds),
        )
        return token

    def set_web_cookie(response: Response, token: str) -> None:
        response.set_cookie(
            COOKIE_NAME, token, max_age=WEB_SESSION_SECONDS,
            httponly=True, secure=secure_cookies, samesite="lax", path="/",
        )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/auth/register", response_model=Account, status_code=201, dependencies=[Depends(require_browser_origin)])
    def register(body: RegisterCredentials, response: Response) -> Account:
        username = body.username.casefold()
        user_id = _new_id()
        with connect(db_path) as connection:
            try:
                connection.execute(
                    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    (user_id, username, password_hash.hash(body.password), _now()),
                )
            except sqlite3.IntegrityError as error:
                raise HTTPException(status_code=409, detail="Username already registered") from error
            token = create_session(connection, user_id, "web")
        set_web_cookie(response, token)
        return Account(id=user_id, username=username)

    @app.post("/api/auth/login", response_model=Account, dependencies=[Depends(require_browser_origin)])
    def login(body: LoginCredentials, response: Response) -> Account:
        with connect(db_path) as connection:
            row = connection.execute(
                "SELECT id, username, password_hash FROM users WHERE username = ?",
                (body.username.casefold(),),
            ).fetchone()
            if row is None or not password_hash.verify(body.password, str(row["password_hash"])):
                raise HTTPException(status_code=401, detail="Username or password is incorrect")
            token = create_session(connection, str(row["id"]), "web")
        set_web_cookie(response, token)
        return _account(row)

    @app.get("/api/auth/me", response_model=Account)
    def me(account: Account = Depends(web_account)) -> Account:
        return account

    @app.post("/api/auth/logout", status_code=204, dependencies=[Depends(require_browser_origin)])
    def logout(request: Request, response: Response, _account: Account = Depends(web_account)) -> None:
        token = request.cookies.get(COOKIE_NAME)
        if token:
            with connect(db_path) as connection:
                connection.execute("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?", (_now(), _digest(token)))
        response.delete_cookie(COOKIE_NAME, path="/")

    @app.post("/api/link/start", response_model=LinkStart)
    def start_link() -> LinkStart:
        request_id = _new_id()
        poll_secret = secrets.token_urlsafe(32)
        expires_at = _now() + LINK_REQUEST_SECONDS
        with connect(db_path) as connection:
            connection.execute(
                "INSERT INTO link_requests (id, secret_hash, expires_at) VALUES (?, ?, ?)",
                (request_id, _digest(poll_secret), expires_at),
            )
        return LinkStart(
            request_id=request_id, poll_secret=poll_secret,
            approve_url=f"{web_origin}/?link={request_id}", expires_at=expires_at,
        )

    @app.post("/api/link/approve/{request_id}", status_code=204, dependencies=[Depends(require_browser_origin)])
    def approve_link(request_id: str, account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            cursor = connection.execute(
                """UPDATE link_requests SET approved_user_id = ?
                   WHERE id = ? AND approved_user_id IS NULL
                     AND consumed_at IS NULL AND expires_at > ?""",
                (account.id, request_id, _now()),
            )
            if cursor.rowcount != 1:
                raise HTTPException(status_code=404, detail="Link request expired or unavailable")

    @app.post("/api/link/poll", response_model=LinkPollResult)
    def poll_link(body: LinkPollRequest) -> LinkPollResult:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM link_requests WHERE id = ? AND secret_hash = ?",
                (body.request_id, _digest(body.poll_secret)),
            ).fetchone()
            if row is None or int(row["expires_at"]) <= _now() or row["consumed_at"] is not None:
                raise HTTPException(status_code=410, detail="Link request expired or used")
            user_id = row["approved_user_id"]
            if user_id is None:
                return LinkPollResult(state="pending")
            user = connection.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
            if user is None:
                raise HTTPException(status_code=410, detail="Account unavailable")
            token = create_session(connection, str(user_id), "extension")
            connection.execute("UPDATE link_requests SET consumed_at = ? WHERE id = ?", (_now(), body.request_id))
            return LinkPollResult(state="linked", token=token, account=_account(user))

    @app.get("/api/extension/me", response_model=Account)
    def extension_me(account: Account = Depends(extension_account)) -> Account:
        return account

    @app.post("/api/extension/revoke", status_code=204)
    def revoke_extension(request: Request, _account: Account = Depends(extension_account)) -> None:
        token = request.headers["authorization"][7:]
        with connect(db_path) as connection:
            connection.execute("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?", (_now(), _digest(token)))

    def require_parent(connection: sqlite3.Connection, user_id: str, parent_id: str | None) -> None:
        if parent_id is None:
            return
        row = connection.execute(
            "SELECT id FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (parent_id, user_id)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    def item(connection: sqlite3.Connection, row: sqlite3.Row) -> Item:
        links = connection.execute(
            """SELECT sentence_id AS id FROM learning_item_links l JOIN learning_items i ON i.id = l.sentence_id AND i.deleted_at IS NULL WHERE word_id = ?
               UNION SELECT word_id AS id FROM learning_item_links l JOIN learning_items i ON i.id = l.word_id AND i.deleted_at IS NULL WHERE sentence_id = ?""",
            (row["id"], row["id"]),
        ).fetchall()
        return Item(id=row["id"], folder_id=row["folder_id"], category=row["category"],
                    text=row["text"], meaning=row["meaning"], pinyin=row["pinyin"],
                    linked_item_ids=[str(link["id"]) for link in links])

    def require_folder(connection: sqlite3.Connection, user_id: str, folder_id: str) -> None:
        if connection.execute("SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (folder_id, user_id)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Learning Folder not found")

    def create_item(connection: sqlite3.Connection, user_id: str, body: ItemInput, reuse: bool = False) -> Item:
        require_folder(connection, user_id, body.folder_id)
        existing = connection.execute(
            "SELECT * FROM learning_items WHERE user_id = ? AND folder_id = ? AND category = ? AND text = ? AND deleted_at IS NULL",
            (user_id, body.folder_id, body.category, body.text),
        ).fetchone()
        if existing is not None:
            if reuse:
                return item(connection, existing)
            raise HTTPException(status_code=409, detail={"message": "Duplicate Learning Item", "existing_item": item(connection, existing).model_dump()})
        item_id = _new_id()
        pinyin = " ".join(lazy_pinyin(body.text, style=Style.TONE, errors=lambda chars: list(chars)))
        try:
            connection.execute(
                "INSERT INTO learning_items (id, user_id, folder_id, category, text, meaning, pinyin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (item_id, user_id, body.folder_id, body.category, body.text, body.meaning, pinyin, _now()),
            )
        except sqlite3.IntegrityError as error:
            raise HTTPException(status_code=409, detail="Duplicate Learning Item") from error
        row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (item_id,)).fetchone()
        assert row is not None
        return item(connection, row)

    @app.get("/api/extension/folders", response_model=list[Folder])
    def extension_folders(account: Account = Depends(extension_account)) -> list[Folder]:
        with connect(db_path) as connection:
            rows = connection.execute("SELECT id, name, parent_id FROM folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY name_key", (account.id,)).fetchall()
        return [_folder(row) for row in rows]

    @app.post("/api/extension/items", response_model=Item, status_code=201)
    def extension_save_item(body: ItemInput, account: Account = Depends(extension_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            return create_item(connection, account.id, body)

    @app.post("/api/extension/items/both", status_code=201)
    def extension_save_both(body: BothInput, account: Account = Depends(extension_account)) -> dict[str, Item]:
        if body.word_text not in body.sentence_text:
            raise HTTPException(status_code=422, detail="Sentence must contain selected text")
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            word = create_item(connection, account.id, ItemInput(folder_id=body.folder_id, category="word", text=body.word_text, meaning=body.word_meaning), reuse=True)
            sentence = create_item(connection, account.id, ItemInput(folder_id=body.folder_id, category="sentence", text=body.sentence_text, meaning=body.sentence_meaning))
            connection.execute("INSERT INTO learning_item_links (word_id, sentence_id) VALUES (?, ?)", (word.id, sentence.id))
            word_row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (word.id,)).fetchone()
            sentence_row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (sentence.id,)).fetchone()
            assert word_row is not None and sentence_row is not None
            return {"word": item(connection, word_row), "sentence": item(connection, sentence_row)}

    @app.post("/api/extension/sync", status_code=201)
    def sync_save(body: SyncInput, account: Account = Depends(extension_account)) -> dict[str, object]:
        if body.choice == "both" and not isinstance(body.item, BothInput):
            raise HTTPException(status_code=422, detail="Paired save requires word and sentence")
        if body.choice != "both" and (not isinstance(body.item, ItemInput) or body.item.category != body.choice):
            raise HTTPException(status_code=422, detail="Save category mismatch")
        payload = body.model_dump(mode="json")
        payload_hash = _digest(json.dumps({"choice": payload["choice"], "item": payload["item"]}, sort_keys=True, ensure_ascii=False))
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            receipt = connection.execute(
                "SELECT payload_hash, result_json FROM learning_sync_receipts WHERE user_id = ? AND request_id = ?",
                (account.id, body.request_id),
            ).fetchone()
            if receipt is not None:
                if receipt["payload_hash"] != payload_hash:
                    raise HTTPException(status_code=409, detail="Sync request already used for different content")
                return json.loads(receipt["result_json"])
            if isinstance(body.item, BothInput):
                if body.item.word_text not in body.item.sentence_text:
                    raise HTTPException(status_code=422, detail="Sentence must contain selected text")
                word = create_item(connection, account.id, ItemInput(
                    folder_id=body.item.folder_id, category="word", text=body.item.word_text, meaning=body.item.word_meaning,
                ), reuse=True)
                sentence = create_item(connection, account.id, ItemInput(
                    folder_id=body.item.folder_id, category="sentence", text=body.item.sentence_text, meaning=body.item.sentence_meaning,
                ))
                connection.execute("INSERT INTO learning_item_links (word_id, sentence_id) VALUES (?, ?)", (word.id, sentence.id))
                word_row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (word.id,)).fetchone()
                sentence_row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (sentence.id,)).fetchone()
                assert word_row is not None and sentence_row is not None
                result: dict[str, object] = {"word": item(connection, word_row).model_dump(), "sentence": item(connection, sentence_row).model_dump()}
            else:
                result = create_item(connection, account.id, body.item).model_dump()
            connection.execute(
                "INSERT INTO learning_sync_receipts (user_id, request_id, payload_hash, result_json) VALUES (?, ?, ?, ?)",
                (account.id, body.request_id, payload_hash, json.dumps(result, ensure_ascii=False)),
            )
            return result

    @app.get("/api/items", response_model=list[Item])
    def list_items(account: Account = Depends(web_account)) -> list[Item]:
        with connect(db_path) as connection:
            rows = connection.execute("SELECT * FROM learning_items WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id", (account.id,)).fetchall()
            return [item(connection, row) for row in rows]

    @app.patch("/api/items/{item_id}", response_model=Item, dependencies=[Depends(require_browser_origin)])
    def update_item(item_id: str, body: ItemUpdate, account: Account = Depends(web_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT * FROM learning_items WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (item_id, account.id)).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Saved Learning Item not found")
            folder_id = body.folder_id if body.folder_id is not None else row["folder_id"]
            category = body.category if body.category is not None else row["category"]
            text = body.text if body.text is not None else row["text"]
            meaning = body.meaning if body.meaning is not None else row["meaning"]
            if not text.strip() or not meaning.strip():
                raise HTTPException(status_code=422, detail="Text and meaning are required")
            require_folder(connection, account.id, folder_id)
            pinyin = " ".join(lazy_pinyin(text, style=Style.TONE, errors=lambda chars: list(chars)))
            try:
                connection.execute("UPDATE learning_items SET folder_id = ?, category = ?, text = ?, meaning = ?, pinyin = ? WHERE id = ?", (folder_id, category, text, meaning, pinyin, item_id))
            except sqlite3.IntegrityError as error:
                raise HTTPException(status_code=409, detail="Duplicate Learning Item") from error
            updated = connection.execute("SELECT * FROM learning_items WHERE id = ?", (item_id,)).fetchone()
            assert updated is not None
            return item(connection, updated)

    @app.delete("/api/items/{item_id}", status_code=204, dependencies=[Depends(require_browser_origin)])
    def trash_item(item_id: str, account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            changed = connection.execute(
                "UPDATE learning_items SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (_now(), item_id, account.id),
            )
            if changed.rowcount != 1:
                raise HTTPException(status_code=404, detail="Saved Learning Item not found")

    @app.get("/api/trash", response_model=list[TrashEntry])
    def list_trash(account: Account = Depends(web_account)) -> list[TrashEntry]:
        with connect(db_path) as connection:
            folders_in_trash = connection.execute(
                "SELECT id, name FROM folders WHERE user_id = ? AND deleted_at IS NOT NULL AND trash_root_id = id ORDER BY deleted_at DESC, id",
                (account.id,),
            ).fetchall()
            items_in_trash = connection.execute(
                "SELECT id, text, category, folder_id FROM learning_items WHERE user_id = ? AND deleted_at IS NOT NULL AND trash_root_id IS NULL ORDER BY deleted_at DESC, id",
                (account.id,),
            ).fetchall()
        return [TrashEntry(id=row["id"], kind="folder", name=row["name"]) for row in folders_in_trash] + [
            TrashEntry(id=row["id"], kind="item", name=row["text"], category=row["category"], folder_id=row["folder_id"])
            for row in items_in_trash
        ]

    def recovery_folder(connection: sqlite3.Connection, user_id: str, category: str, text: str) -> str:
        suffix = 1
        while True:
            name = "Đã khôi phục" if suffix == 1 else f"Đã khôi phục {suffix}"
            existing = connection.execute(
                "SELECT id FROM folders WHERE user_id = ? AND parent_id IS NULL AND name_key = ? AND deleted_at IS NULL",
                (user_id, name.casefold()),
            ).fetchone()
            if existing is None:
                folder_id = _new_id()
                connection.execute(
                    "INSERT INTO folders (id, user_id, parent_id, name, name_key, created_at) VALUES (?, ?, NULL, ?, ?, ?)",
                    (folder_id, user_id, name, name.casefold(), _now()),
                )
                return folder_id
            collision = connection.execute(
                "SELECT 1 FROM learning_items WHERE user_id = ? AND folder_id = ? AND category = ? AND text = ? AND deleted_at IS NULL",
                (user_id, existing["id"], category, text),
            ).fetchone()
            if collision is None:
                return str(existing["id"])
            suffix += 1

    @app.post("/api/trash/items/{item_id}/restore", response_model=Item, dependencies=[Depends(require_browser_origin)])
    def restore_item(item_id: str, account: Account = Depends(web_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT * FROM learning_items WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND trash_root_id IS NULL",
                (item_id, account.id),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Trash item not found")
            folder = connection.execute(
                "SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (row["folder_id"], account.id),
            ).fetchone()
            collision = connection.execute(
                "SELECT 1 FROM learning_items WHERE user_id = ? AND folder_id = ? AND category = ? AND text = ? AND deleted_at IS NULL",
                (account.id, row["folder_id"], row["category"], row["text"]),
            ).fetchone()
            target_folder = row["folder_id"] if folder is not None and collision is None else recovery_folder(
                connection, account.id, row["category"], row["text"],
            )
            try:
                connection.execute("UPDATE learning_items SET folder_id = ?, deleted_at = NULL WHERE id = ?", (target_folder, item_id))
            except sqlite3.IntegrityError as error:
                raise HTTPException(status_code=409, detail="Duplicate Learning Item") from error
            restored = connection.execute("SELECT * FROM learning_items WHERE id = ?", (item_id,)).fetchone()
            assert restored is not None
            return item(connection, restored)

    @app.delete("/api/trash/items/{item_id}", status_code=204, dependencies=[Depends(require_browser_origin)])
    def permanently_delete_item(item_id: str, account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            changed = connection.execute(
                "DELETE FROM learning_items WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND trash_root_id IS NULL",
                (item_id, account.id),
            )
            if changed.rowcount != 1:
                raise HTTPException(status_code=404, detail="Trash item not found")

    def permanently_delete_folder_group(connection: sqlite3.Connection, user_id: str, folder_id: str) -> None:
        root = connection.execute(
            "SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND trash_root_id = id",
            (folder_id, user_id),
        ).fetchone()
        if root is None:
            raise HTTPException(status_code=404, detail="Trash folder not found")
        group = connection.execute(
            "SELECT id FROM folders WHERE user_id = ? AND trash_root_id = ?", (user_id, folder_id),
        ).fetchall()
        ids = [str(row["id"]) for row in group]
        placeholders = ",".join("?" for _ in ids)
        other_items = connection.execute(
            f"SELECT id, category, text FROM learning_items WHERE user_id = ? AND folder_id IN ({placeholders}) AND trash_root_id IS NULL",
            (user_id, *ids),
        ).fetchall()
        for row in other_items:
            destination = recovery_folder(connection, user_id, row["category"], row["text"])
            connection.execute("UPDATE learning_items SET folder_id = ? WHERE id = ?", (destination, row["id"]))
        connection.execute(
            f"UPDATE folders SET parent_id = NULL WHERE user_id = ? AND parent_id IN ({placeholders}) AND trash_root_id != ?",
            (user_id, *ids, folder_id),
        )
        connection.execute("DELETE FROM learning_items WHERE user_id = ? AND trash_root_id = ?", (user_id, folder_id))
        connection.execute("DELETE FROM folders WHERE user_id = ? AND trash_root_id = ?", (user_id, folder_id))

    @app.delete("/api/trash/folders/{folder_id}", status_code=204, dependencies=[Depends(require_browser_origin)])
    def permanently_delete_folder(folder_id: str, account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            permanently_delete_folder_group(connection, account.id, folder_id)

    @app.delete("/api/trash", status_code=204, dependencies=[Depends(require_browser_origin)])
    def empty_trash(account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM learning_items WHERE user_id = ? AND deleted_at IS NOT NULL", (account.id,))
            connection.execute("DELETE FROM folders WHERE user_id = ? AND deleted_at IS NOT NULL", (account.id,))

    @app.get("/api/folders", response_model=list[Folder])
    def list_folders(account: Account = Depends(web_account)) -> list[Folder]:
        with connect(db_path) as connection:
            rows = connection.execute(
                "SELECT id, name, parent_id FROM folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY name_key, id",
                (account.id,),
            ).fetchall()
        return [_folder(row) for row in rows]

    @app.post("/api/folders", response_model=Folder, status_code=201, dependencies=[Depends(require_browser_origin)])
    def create_folder(body: FolderInput, account: Account = Depends(web_account)) -> Folder:
        folder_id = _new_id()
        with connect(db_path) as connection:
            require_parent(connection, account.id, body.parent_id)
            try:
                connection.execute(
                    """INSERT INTO folders (id, user_id, parent_id, name, name_key, created_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (folder_id, account.id, body.parent_id, body.name, body.name.casefold(), _now()),
                )
            except sqlite3.IntegrityError as error:
                raise HTTPException(status_code=409, detail="Folder name already used here") from error
        return Folder(id=folder_id, name=body.name, parent_id=body.parent_id)

    @app.patch("/api/folders/{folder_id}", response_model=Folder, dependencies=[Depends(require_browser_origin)])
    def update_folder(folder_id: str, body: FolderUpdate, account: Account = Depends(web_account)) -> Folder:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT id, name, parent_id FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (folder_id, account.id),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Folder not found")
            name = body.name if body.name is not None else str(row["name"])
            parent_id = body.parent_id if "parent_id" in body.model_fields_set else row["parent_id"]
            require_parent(connection, account.id, parent_id)
            current = parent_id
            while current is not None:
                if current == folder_id:
                    raise HTTPException(status_code=400, detail="Cannot move folder into itself or a descendant")
                parent = connection.execute(
                    "SELECT parent_id FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (current, account.id)
                ).fetchone()
                current = parent["parent_id"] if parent else None
            try:
                connection.execute(
                    "UPDATE folders SET name = ?, name_key = ?, parent_id = ? WHERE id = ? AND user_id = ?",
                    (name, name.casefold(), parent_id, folder_id, account.id),
                )
            except sqlite3.IntegrityError as error:
                raise HTTPException(status_code=409, detail="Folder name already used here") from error
        return Folder(id=folder_id, name=name, parent_id=parent_id)

    def subtree_ids(connection: sqlite3.Connection, user_id: str, folder_id: str) -> list[str]:
        rows = connection.execute(
            """WITH RECURSIVE tree(id) AS (
                   SELECT id FROM folders WHERE id = ? AND user_id = ?
                   UNION ALL SELECT child.id FROM folders child JOIN tree ON child.parent_id = tree.id WHERE child.user_id = ?
               ) SELECT id FROM tree""",
            (folder_id, user_id, user_id),
        ).fetchall()
        return [str(row["id"]) for row in rows]

    @app.delete("/api/folders/{folder_id}", status_code=204, dependencies=[Depends(require_browser_origin)])
    def trash_folder(folder_id: str, account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT id FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (folder_id, account.id),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Folder not found")
            ids = subtree_ids(connection, account.id, folder_id)
            placeholders = ",".join("?" for _ in ids)
            timestamp = _now()
            connection.execute(
                f"UPDATE learning_items SET deleted_at = ?, trash_root_id = ? WHERE user_id = ? AND folder_id IN ({placeholders}) AND deleted_at IS NULL",
                (timestamp, folder_id, account.id, *ids),
            )
            connection.execute(
                f"UPDATE folders SET deleted_at = ?, trash_root_id = ? WHERE user_id = ? AND id IN ({placeholders}) AND deleted_at IS NULL",
                (timestamp, folder_id, account.id, *ids),
            )

    @app.post("/api/trash/folders/{folder_id}/restore", response_model=Folder, dependencies=[Depends(require_browser_origin)])
    def restore_folder(folder_id: str, account: Account = Depends(web_account)) -> Folder:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            root = connection.execute(
                "SELECT * FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL AND trash_root_id = id",
                (folder_id, account.id),
            ).fetchone()
            if root is None:
                raise HTTPException(status_code=404, detail="Trash folder not found")
            parent = connection.execute(
                "SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (root["parent_id"], account.id),
            ).fetchone() if root["parent_id"] else None
            if root["parent_id"] and parent is None:
                connection.execute("UPDATE folders SET parent_id = NULL WHERE id = ?", (folder_id,))
            destination_parent = root["parent_id"] if parent is not None else None
            name = str(root["name"])
            suffix = 1
            while connection.execute(
                "SELECT 1 FROM folders WHERE user_id = ? AND COALESCE(parent_id, '') = COALESCE(?, '') AND name_key = ? AND deleted_at IS NULL",
                (account.id, destination_parent, name.casefold()),
            ).fetchone():
                suffix += 1
                name = f"{str(root['name'])[:80]} (khôi phục {suffix})"
            if name != root["name"]:
                connection.execute("UPDATE folders SET name = ?, name_key = ? WHERE id = ?", (name, name.casefold(), folder_id))
            connection.execute(
                "UPDATE folders SET deleted_at = NULL, trash_root_id = NULL WHERE user_id = ? AND trash_root_id = ?",
                (account.id, folder_id),
            )
            connection.execute(
                "UPDATE learning_items SET deleted_at = NULL, trash_root_id = NULL WHERE user_id = ? AND trash_root_id = ?",
                (account.id, folder_id),
            )
            restored = connection.execute("SELECT id, name, parent_id FROM folders WHERE id = ?", (folder_id,)).fetchone()
            assert restored is not None
            return _folder(restored)

    return app


app = create_app()
