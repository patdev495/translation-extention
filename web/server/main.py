"""Typed FastAPI entry point for the companion learning website."""

from __future__ import annotations

import hashlib
import json
import os
import random
import secrets
import sqlite3
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode, urlsplit

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
    category: Literal["word", "sentence", "grammar", "note"]
    text: str = Field(min_length=1)
    meaning: str = Field(min_length=1)

    @field_validator("text", "meaning")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Value is required")
        return value


class MeaningSuggestionInput(BaseModel):
    text: str = Field(min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Value is required")
        return value


class ItemUpdate(BaseModel):
    folder_id: str | None = None
    category: Literal["word", "sentence", "grammar", "note"] | None = None
    text: str | None = None
    meaning: str | None = None


class ItemLinkInput(BaseModel):
    item_id: str


class ExampleInput(BaseModel):
    item_id: str | None = None
    text: str | None = None
    meaning: str | None = None


class ItemWithExamplesInput(BaseModel):
    item: ItemInput
    examples: list[ExampleInput]


class ItemUpdateWithExamplesInput(BaseModel):
    item: ItemUpdate
    examples: list[ExampleInput]


class BothInput(BaseModel):
    folder_id: str
    word_text: str = Field(min_length=1)
    word_meaning: str = Field(min_length=1)
    sentence_text: str = Field(min_length=1)
    sentence_meaning: str = Field(min_length=1)
    update_existing_word_meaning: bool = False
    update_existing_sentence_meaning: bool = False

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
    category: Literal["word", "sentence", "grammar", "note"]
    text: str
    meaning: str
    pinyin: str
    created_at: int
    linked_item_ids: list[str]


class TrashEntry(BaseModel):
    id: str
    kind: Literal["item", "folder"]
    name: str
    category: Literal["word", "sentence", "grammar", "note"] | None = None
    folder_id: str | None = None


def _now() -> int:
    return int(time.time())


def _now_ms() -> int:
    return int(time.time() * 1000)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _new_id() -> str:
    return str(uuid.uuid4())


def _account(row: sqlite3.Row) -> Account:
    return Account(id=str(row["id"]), username=str(row["username"]))


def _folder(row: sqlite3.Row) -> Folder:
    return Folder(id=str(row["id"]), name=str(row["name"]), parent_id=row["parent_id"])


class ReviewStart(BaseModel):
    kind: Literal["vocabulary", "grammar"]
    folder_id: str | None = None
    category: Literal["word", "sentence", "all"] = "word"
    practice: Literal["classic", "listen", "speak"] = "classic"
    prompt_mode: Literal["meaning", "chinese", "pinyin"] = "meaning"
    autoplay: bool = True


class RecallInput(BaseModel):
    result: Literal["remembered", "not_yet"]
    position: int | None = Field(default=None, ge=0)


class ReviewProgress(BaseModel):
    position: int = Field(ge=0)
    practice: Literal["classic", "listen", "speak"] | None = None
    prompt_mode: Literal["meaning", "chinese", "pinyin"] | None = None
    autoplay: bool | None = None


class BulkTrashInput(BaseModel):
    item_ids: list[str] | None = None


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

    def scoped_items(connection: sqlite3.Connection, user_id: str, folder_id: str | None) -> list[sqlite3.Row]:
        if folder_id is not None:
            found = connection.execute("SELECT 1 FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (folder_id, user_id)).fetchone()
            if found is None:
                raise HTTPException(status_code=404, detail="Review folder not found")
        return connection.execute("""WITH RECURSIVE scope(id) AS (
            SELECT id FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL
            UNION ALL SELECT f.id FROM folders f JOIN scope s ON f.parent_id = s.id
            WHERE f.user_id = ? AND f.deleted_at IS NULL
        ) SELECT * FROM learning_items WHERE user_id = ? AND deleted_at IS NULL
          AND (? IS NULL OR folder_id IN (SELECT id FROM scope)) ORDER BY created_at, id""",
            (folder_id, user_id, user_id, user_id, folder_id)).fetchall()

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
                    text=row["text"], meaning=row["meaning"], pinyin=row["pinyin"], created_at=row["created_at"],
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
        if existing is not None and body.category != "note":
            if reuse:
                return item(connection, existing)
            raise HTTPException(status_code=409, detail={"message": "Duplicate Learning Item", "existing_item": item(connection, existing).model_dump()})
        item_id = _new_id()
        pinyin = " ".join(lazy_pinyin(body.text, style=Style.TONE, errors=lambda chars: list(chars))) if body.category in ("word", "sentence") else ""
        try:
            connection.execute(
                "INSERT INTO learning_items (id, user_id, folder_id, category, text, meaning, pinyin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (item_id, user_id, body.folder_id, body.category, body.text, body.meaning, pinyin, _now_ms()),
            )
        except sqlite3.IntegrityError as error:
            raise HTTPException(status_code=409, detail="Duplicate Learning Item") from error
        row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (item_id,)).fetchone()
        assert row is not None
        return item(connection, row)

    def create_paired_items(connection: sqlite3.Connection, user_id: str, body: BothInput) -> dict[str, Item]:
        if body.word_text not in body.sentence_text:
            raise HTTPException(status_code=422, detail="Sentence must contain selected text")
        existing_word = connection.execute(
            "SELECT id, meaning FROM learning_items WHERE user_id = ? AND folder_id = ? AND category = 'word' AND text = ? AND deleted_at IS NULL",
            (user_id, body.folder_id, body.word_text),
        ).fetchone()
        word = create_item(connection, user_id, ItemInput(
            folder_id=body.folder_id, category="word", text=body.word_text, meaning=body.word_meaning,
        ), reuse=True)
        if existing_word is not None and body.update_existing_word_meaning and existing_word["meaning"] != body.word_meaning:
            connection.execute("UPDATE learning_items SET meaning = ? WHERE id = ?", (body.word_meaning, word.id))
        existing_sentence = connection.execute(
            "SELECT id, meaning FROM learning_items WHERE user_id = ? AND folder_id = ? AND category = 'sentence' AND text = ? AND deleted_at IS NULL",
            (user_id, body.folder_id, body.sentence_text),
        ).fetchone()
        sentence = create_item(connection, user_id, ItemInput(
            folder_id=body.folder_id, category="sentence", text=body.sentence_text, meaning=body.sentence_meaning,
        ), reuse=True)
        if existing_sentence is not None and body.update_existing_sentence_meaning and existing_sentence["meaning"] != body.sentence_meaning:
            connection.execute("UPDATE learning_items SET meaning = ? WHERE id = ?", (body.sentence_meaning, sentence.id))
        connection.execute("INSERT OR IGNORE INTO learning_item_links (word_id, sentence_id) VALUES (?, ?)", (word.id, sentence.id))
        word_row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (word.id,)).fetchone()
        sentence_row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (sentence.id,)).fetchone()
        assert word_row is not None and sentence_row is not None
        return {"word": item(connection, word_row), "sentence": item(connection, sentence_row)}

    @app.get("/api/extension/folders", response_model=list[Folder])
    def extension_folders(account: Account = Depends(extension_account)) -> list[Folder]:
        with connect(db_path) as connection:
            rows = connection.execute("SELECT id, name, parent_id FROM folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY name_key", (account.id,)).fetchall()
        return [_folder(row) for row in rows]

    @app.get("/api/extension/items/existing", response_model=Item | None)
    def extension_existing_sentence(folder_id: str, text: str, account: Account = Depends(extension_account)) -> Item | None:
        with connect(db_path) as connection:
            require_folder(connection, account.id, folder_id)
            row = connection.execute(
                "SELECT * FROM learning_items WHERE user_id = ? AND folder_id = ? AND category = 'sentence' AND text = ? AND deleted_at IS NULL",
                (account.id, folder_id, text),
            ).fetchone()
            return item(connection, row) if row is not None else None

    @app.post("/api/extension/items", response_model=Item, status_code=201)
    def extension_save_item(body: ItemInput, account: Account = Depends(extension_account)) -> Item:
        if body.category not in ("word", "sentence"):
            raise HTTPException(status_code=422, detail="Extension saves only Word or Phrase and Sentence")
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            return create_item(connection, account.id, body)

    @app.post("/api/extension/items/both", status_code=201)
    def extension_save_both(body: BothInput, account: Account = Depends(extension_account)) -> dict[str, Item]:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            return create_paired_items(connection, account.id, body)

    @app.post("/api/extension/sync", status_code=201)
    def sync_save(body: SyncInput, account: Account = Depends(extension_account)) -> dict[str, object]:
        if body.choice == "both" and not isinstance(body.item, BothInput):
            raise HTTPException(status_code=422, detail="Paired save requires word and sentence")
        if body.choice != "both" and (not isinstance(body.item, ItemInput) or body.item.category != body.choice or body.item.category not in ("word", "sentence")):
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
                paired = create_paired_items(connection, account.id, body.item)
                result: dict[str, object] = {key: value.model_dump() for key, value in paired.items()}
            else:
                result = create_item(connection, account.id, body.item).model_dump()
            connection.execute(
                "INSERT INTO learning_sync_receipts (user_id, request_id, payload_hash, result_json) VALUES (?, ?, ?, ?)",
                (account.id, body.request_id, payload_hash, json.dumps(result, ensure_ascii=False)),
            )
            return result

    @app.post("/api/items/meaning-suggestion", dependencies=[Depends(require_browser_origin)])
    def web_meaning_suggestion(body: MeaningSuggestionInput, _account: Account = Depends(web_account)) -> dict[str, str]:
        query = urlencode({"client": "gtx", "sl": "auto", "tl": "vi", "dt": "t", "q": body.text.strip()})
        request = urllib.request.Request(
            f"https://translate.googleapis.com/translate_a/single?{query}",
            headers={"User-Agent": "PolyTranslate-Learning/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=6) as response:
                segments = json.loads(response.read().decode("utf-8"))[0]
            meaning = "".join(segment[0] for segment in segments if isinstance(segment, list) and isinstance(segment[0], str)).strip()
        except (OSError, ValueError, IndexError, KeyError, TypeError) as error:
            raise HTTPException(status_code=503, detail="Meaning suggestion unavailable") from error
        if not meaning:
            raise HTTPException(status_code=503, detail="Meaning suggestion unavailable")
        return {"meaning": meaning}

    @app.get("/api/items", response_model=list[Item])
    def list_items(account: Account = Depends(web_account)) -> list[Item]:
        with connect(db_path) as connection:
            rows = connection.execute("SELECT * FROM learning_items WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id", (account.id,)).fetchall()
            return [item(connection, row) for row in rows]

    @app.get("/api/review/overview")
    def review_overview(folder_id: str | None = None, account: Account = Depends(web_account)) -> dict:
        with connect(db_path) as connection:
            eligible = [row for row in scoped_items(connection, account.id, folder_id) if row["category"] in ("word", "sentence", "grammar")]
            rows = connection.execute("""SELECT r.item_id, r.result, COUNT(*) AS count FROM recall_results r
                JOIN review_sessions s ON s.id = r.session_id
                WHERE s.user_id = ? GROUP BY r.item_id, r.result""", (account.id,)).fetchall()
            counts: dict[str, dict[str, int]] = {}
            for row in rows:
                counts.setdefault(str(row["item_id"]), {})[str(row["result"])] = int(row["count"])
            entries = [{"id": row["id"], "category": row["category"], "text": row["text"],
                        "remembered": counts.get(str(row["id"]), {}).get("remembered", 0),
                        "not_yet": counts.get(str(row["id"]), {}).get("not_yet", 0)} for row in eligible]
            return {"entries": entries, "totals": {key: sum(entry[key] for entry in entries) for key in ("remembered", "not_yet")}}

    def review_payload(connection: sqlite3.Connection, session: sqlite3.Row) -> dict:
        results = connection.execute("SELECT item_id, result FROM recall_results WHERE session_id = ?", (session["id"],)).fetchall()
        return {"id": session["id"], "kind": session["kind"], "questions": json.loads(session["questions_json"]),
                "position": session["position"], "settings": json.loads(session["settings_json"] or "{}"),
                "results": {row["item_id"]: row["result"] for row in results},
                "completed": session["completed_at"] is not None, "ineligible_count": 0}

    def owned_review(connection: sqlite3.Connection, session_id: str, user_id: str) -> sqlite3.Row:
        session = connection.execute("SELECT * FROM review_sessions WHERE id = ? AND user_id = ?", (session_id, user_id)).fetchone()
        if session is None:
            raise HTTPException(status_code=404, detail="Review session not found")
        return session

    def review_available(connection: sqlite3.Connection, session: sqlite3.Row) -> bool:
        required = set()
        for question in json.loads(session["questions_json"]):
            required.update(question["item_ids"])
            if question["sentence"] is not None:
                required.add(question["sentence"]["id"])
        active = {row["id"] for row in connection.execute(
            "SELECT id FROM learning_items WHERE user_id = ? AND deleted_at IS NULL", (session["user_id"],))}
        return required <= active

    def save_review_position(connection: sqlite3.Connection, session: sqlite3.Row, position: int) -> None:
        size = len(json.loads(session["questions_json"]))
        if position > size:
            raise HTTPException(status_code=422, detail="Review position out of range")
        connection.execute("UPDATE review_sessions SET position = ?, completed_at = ? WHERE id = ?",
                           (position, _now_ms() if position == size else None, session["id"]))

    @app.get("/api/review/sessions/current")
    def current_review(account: Account = Depends(web_account)) -> dict | None:
        with connect(db_path) as connection:
            session = connection.execute("""SELECT * FROM review_sessions WHERE user_id = ? AND kind = 'vocabulary'
                AND settings_json IS NOT NULL AND completed_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1""", (account.id,)).fetchone()
            return review_payload(connection, session) if session is not None and review_available(connection, session) else None

    @app.get("/api/review/sessions/{session_id}")
    def get_review(session_id: str, account: Account = Depends(web_account)) -> dict:
        with connect(db_path) as connection:
            session = owned_review(connection, session_id, account.id)
            if not review_available(connection, session):
                raise HTTPException(status_code=409, detail="Nội dung buổi ôn đã bị xóa. Hãy bắt đầu buổi mới.")
            return review_payload(connection, session)

    @app.patch("/api/review/sessions/{session_id}/progress", dependencies=[Depends(require_browser_origin)])
    def review_progress(session_id: str, body: ReviewProgress, account: Account = Depends(web_account)) -> dict:
        with connect(db_path) as connection:
            session = owned_review(connection, session_id, account.id)
            if not review_available(connection, session):
                raise HTTPException(status_code=409, detail="Nội dung buổi ôn đã bị xóa. Hãy bắt đầu buổi mới.")
            save_review_position(connection, session, body.position)
            settings = json.loads(session["settings_json"] or "{}")
            settings.update(body.model_dump(exclude={"position"}, exclude_none=True))
            connection.execute("UPDATE review_sessions SET settings_json = ? WHERE id = ?", (json.dumps(settings), session_id))
            return review_payload(connection, owned_review(connection, session_id, account.id))

    @app.post("/api/review/sessions", status_code=201, dependencies=[Depends(require_browser_origin)])
    def start_review(body: ReviewStart, account: Account = Depends(web_account)) -> dict:
        with connect(db_path) as connection:
            scoped = scoped_items(connection, account.id, body.folder_id)
            if body.kind == "vocabulary":
                questions = [{"sentence": None, "item_ids": [str(row["id"])], "items": [dict(item(connection, row))]}
                             for row in scoped if row["category"] in (("word", "sentence") if body.category == "all" else (body.category,))]
                ineligible_count = 0
                ineligible_item_ids: list[str] = []
            else:
                questions_by_sentence: dict[str, dict] = {}
                ineligible_count = 0
                ineligible_item_ids = []
                for row in scoped:
                    if row["category"] != "grammar":
                        continue
                    sentences = connection.execute("""SELECT sentence.* FROM learning_item_links link
                        JOIN learning_items sentence ON sentence.id = link.sentence_id
                        WHERE link.word_id = ? AND sentence.user_id = ? AND sentence.category = 'sentence'
                        AND sentence.deleted_at IS NULL""", (row["id"], account.id)).fetchall()
                    if not sentences:
                        ineligible_count += 1
                        ineligible_item_ids.append(str(row["id"]))
                        continue
                    sentence = random.choice(sentences)
                    key = str(sentence["id"])
                    question = questions_by_sentence.setdefault(key, {"sentence": dict(item(connection, sentence)), "item_ids": [], "items": []})
                    question["item_ids"].append(str(row["id"]))
                    question["items"].append(dict(item(connection, row)))
                questions = list(questions_by_sentence.values())
            random.shuffle(questions)
            session_id = _new_id()
            connection.execute("UPDATE review_sessions SET completed_at = ? WHERE user_id = ? AND kind = ? AND completed_at IS NULL",
                               (_now_ms(), account.id, body.kind))
            connection.execute("""INSERT INTO review_sessions
                (id, user_id, kind, questions_json, created_at, settings_json, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (session_id, account.id, body.kind, json.dumps(questions), _now_ms(),
                 json.dumps(body.model_dump(exclude={"kind"})), None if questions else _now_ms()))
            return {**review_payload(connection, owned_review(connection, session_id, account.id)),
                    "ineligible_count": ineligible_count, "ineligible_item_ids": ineligible_item_ids}

    @app.put("/api/review/sessions/{session_id}/results/{item_id}", dependencies=[Depends(require_browser_origin)])
    def record_recall(session_id: str, item_id: str, body: RecallInput, account: Account = Depends(web_account)) -> dict:
        with connect(db_path) as connection:
            session = owned_review(connection, session_id, account.id)
            questions = json.loads(session["questions_json"])
            if not any(item_id in question["item_ids"] for question in questions):
                raise HTTPException(status_code=404, detail="Review item not found")
            if connection.execute("SELECT 1 FROM learning_items WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (item_id, account.id)).fetchone() is None:
                raise HTTPException(status_code=404, detail="Review item not found")
            if body.position is not None:
                save_review_position(connection, session, body.position)
            connection.execute("""INSERT INTO recall_results (session_id, item_id, result) VALUES (?, ?, ?)
                ON CONFLICT(session_id, item_id) DO UPDATE SET result = excluded.result""", (session_id, item_id, body.result))
            return {"item_id": item_id, "result": body.result}

    @app.post("/api/items", response_model=Item, status_code=201, dependencies=[Depends(require_browser_origin)])
    def create_web_item(body: ItemInput, account: Account = Depends(web_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            return create_item(connection, account.id, body)

    def attach_examples(connection: sqlite3.Connection, user_id: str, owner: Item, examples: list[ExampleInput]) -> Item:
        if owner.category not in ("word", "grammar"):
            raise HTTPException(status_code=422, detail="Examples require Word or Phrase or Grammar")
        for example in examples:
            if example.item_id:
                row = connection.execute(
                    "SELECT * FROM learning_items WHERE id = ? AND user_id = ? AND category = 'sentence' AND deleted_at IS NULL",
                    (example.item_id, user_id),
                ).fetchone()
                if row is None:
                    raise HTTPException(status_code=404, detail="Sentence not found")
                sentence_id = row["id"]
            else:
                if not example.text or not example.text.strip() or not example.meaning or not example.meaning.strip():
                    raise HTTPException(status_code=422, detail="Sentence text and meaning are required")
                sentence_id = create_item(connection, user_id, ItemInput(
                    folder_id=owner.folder_id, category="sentence", text=example.text, meaning=example.meaning,
                ), reuse=True).id
            connection.execute("INSERT OR IGNORE INTO learning_item_links (word_id, sentence_id) VALUES (?, ?)", (owner.id, sentence_id))
        row = connection.execute("SELECT * FROM learning_items WHERE id = ?", (owner.id,)).fetchone()
        return item(connection, row)

    @app.post("/api/items/with-examples", response_model=Item, status_code=201, dependencies=[Depends(require_browser_origin)])
    def create_web_item_with_examples(body: ItemWithExamplesInput, account: Account = Depends(web_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            owner = create_item(connection, account.id, body.item)
            return attach_examples(connection, account.id, owner, body.examples)

    @app.post("/api/items/{item_id}/examples", response_model=Item, dependencies=[Depends(require_browser_origin)])
    def add_item_examples(item_id: str, examples: list[ExampleInput], account: Account = Depends(web_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT * FROM learning_items WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (item_id, account.id)).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Saved Learning Item not found")
            return attach_examples(connection, account.id, item(connection, row), examples)

    def update_item_record(connection: sqlite3.Connection, user_id: str, item_id: str, body: ItemUpdate) -> Item:
        row = connection.execute("SELECT * FROM learning_items WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (item_id, user_id)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Saved Learning Item not found")
        folder_id = body.folder_id if body.folder_id is not None else row["folder_id"]
        category = body.category if body.category is not None else row["category"]
        if (category == "note") != (row["category"] == "note"):
            raise HTTPException(status_code=422, detail="Note category cannot be converted")
        if category != row["category"] and item(connection, row).linked_item_ids:
            raise HTTPException(status_code=409, detail="Remove Learning Links before changing category")
        text = body.text if body.text is not None else row["text"]
        meaning = body.meaning if body.meaning is not None else row["meaning"]
        if not text.strip() or not meaning.strip():
            raise HTTPException(status_code=422, detail="Text and meaning are required")
        require_folder(connection, user_id, folder_id)
        pinyin = " ".join(lazy_pinyin(text, style=Style.TONE, errors=lambda chars: list(chars))) if category in ("word", "sentence") else ""
        try:
            connection.execute("UPDATE learning_items SET folder_id = ?, category = ?, text = ?, meaning = ?, pinyin = ? WHERE id = ?", (folder_id, category, text, meaning, pinyin, item_id))
        except sqlite3.IntegrityError as error:
            raise HTTPException(status_code=409, detail="Duplicate Learning Item") from error
        updated = connection.execute("SELECT * FROM learning_items WHERE id = ?", (item_id,)).fetchone()
        return item(connection, updated)

    @app.patch("/api/items/{item_id}/with-examples", response_model=Item, dependencies=[Depends(require_browser_origin)])
    def update_item_with_examples(item_id: str, body: ItemUpdateWithExamplesInput, account: Account = Depends(web_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            updated = update_item_record(connection, account.id, item_id, body.item)
            return attach_examples(connection, account.id, updated, body.examples)

    @app.patch("/api/items/{item_id}", response_model=Item, dependencies=[Depends(require_browser_origin)])
    def update_item(item_id: str, body: ItemUpdate, account: Account = Depends(web_account)) -> Item:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            return update_item_record(connection, account.id, item_id, body)

    @app.post("/api/items/{item_id}/links", status_code=201, dependencies=[Depends(require_browser_origin)])
    def add_item_link(item_id: str, body: ItemLinkInput, account: Account = Depends(web_account)) -> dict[str, str]:
        with connect(db_path) as connection:
            rows = connection.execute(
                "SELECT id, category FROM learning_items WHERE id IN (?, ?) AND user_id = ? AND deleted_at IS NULL",
                (item_id, body.item_id, account.id),
            ).fetchall()
            if len(rows) != 2:
                raise HTTPException(status_code=404, detail="Saved Learning Item not found")
            categories = {row["id"]: row["category"] for row in rows}
            pair = {categories[item_id], categories[body.item_id]}
            if pair not in ({"word", "sentence"}, {"grammar", "sentence"}):
                raise HTTPException(status_code=422, detail="Learning Link requires Word or Phrase and Sentence")
            word_id = item_id if categories[item_id] != "sentence" else body.item_id
            sentence_id = item_id if categories[item_id] == "sentence" else body.item_id
            connection.execute("INSERT OR IGNORE INTO learning_item_links (word_id, sentence_id) VALUES (?, ?)", (word_id, sentence_id))
            return {"word_id": word_id, "sentence_id": sentence_id}

    @app.delete("/api/items/{item_id}/links/{linked_id}", status_code=204, dependencies=[Depends(require_browser_origin)])
    def remove_item_link(item_id: str, linked_id: str, account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            owned = connection.execute(
                "SELECT COUNT(*) AS count FROM learning_items WHERE id IN (?, ?) AND user_id = ? AND deleted_at IS NULL",
                (item_id, linked_id, account.id),
            ).fetchone()
            if owned["count"] != 2:
                raise HTTPException(status_code=404, detail="Saved Learning Item not found")
            connection.execute(
                "DELETE FROM learning_item_links WHERE (word_id = ? AND sentence_id = ?) OR (word_id = ? AND sentence_id = ?)",
                (item_id, linked_id, linked_id, item_id),
            )

    @app.delete("/api/items/{item_id}", status_code=204, dependencies=[Depends(require_browser_origin)])
    def trash_item(item_id: str, account: Account = Depends(web_account)) -> None:
        with connect(db_path) as connection:
            changed = connection.execute(
                "UPDATE learning_items SET deleted_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
                (_now(), item_id, account.id),
            )
            if changed.rowcount != 1:
                raise HTTPException(status_code=404, detail="Saved Learning Item not found")

    @app.post("/api/folders/{folder_id}/trash-items", dependencies=[Depends(require_browser_origin)])
    def trash_folder_items(folder_id: str, body: BulkTrashInput, account: Account = Depends(web_account)) -> dict[str, int]:
        with connect(db_path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            folder = connection.execute(
                "SELECT id FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL", (folder_id, account.id),
            ).fetchone()
            if folder is None:
                raise HTTPException(status_code=404, detail="Folder not found")
            owned = connection.execute(
                "SELECT id FROM learning_items WHERE folder_id = ? AND user_id = ? AND deleted_at IS NULL",
                (folder_id, account.id),
            ).fetchall()
            owned_ids = {str(row["id"]) for row in owned}
            selected_ids = owned_ids if body.item_ids is None else set(body.item_ids)
            if not selected_ids.issubset(owned_ids):
                raise HTTPException(status_code=404, detail="Saved Learning Item not found")
            timestamp = _now()
            connection.executemany(
                "UPDATE learning_items SET deleted_at = ? WHERE id = ? AND user_id = ? AND folder_id = ? AND deleted_at IS NULL",
                [(timestamp, item_id, account.id, folder_id) for item_id in selected_ids],
            )
            return {"count": len(selected_ids)}

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
                    (folder_id, user_id, name, name.casefold(), _now_ms()),
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
            collision = None if row["category"] == "note" else connection.execute(
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
                "SELECT id, name, parent_id FROM folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at, rowid",
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
                    (folder_id, account.id, body.parent_id, body.name, body.name.casefold(), _now_ms()),
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
