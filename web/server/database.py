"""SQLite persistence for accounts, sessions, device links, and folders."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def connect(path: Path) -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK (kind IN ('web', 'extension')),
                expires_at INTEGER NOT NULL,
                revoked_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

            CREATE TABLE IF NOT EXISTS link_requests (
                id TEXT PRIMARY KEY,
                secret_hash TEXT NOT NULL,
                approved_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL,
                consumed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                parent_id TEXT REFERENCES folders(id),
                name TEXT NOT NULL,
                name_key TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS folder_sibling_name_idx
                ON folders(user_id, COALESCE(parent_id, ''), name_key);
            CREATE INDEX IF NOT EXISTS folders_parent_idx ON folders(user_id, parent_id);
            CREATE TABLE IF NOT EXISTS learning_items (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                folder_id TEXT NOT NULL REFERENCES folders(id),
                category TEXT NOT NULL CHECK (category IN ('word', 'sentence')),
                text TEXT NOT NULL,
                meaning TEXT NOT NULL,
                pinyin TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS learning_item_identity
                ON learning_items(user_id, folder_id, category, text);
            CREATE TABLE IF NOT EXISTS learning_item_links (
                word_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
                sentence_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
                PRIMARY KEY (word_id, sentence_id)
            );
            CREATE TABLE IF NOT EXISTS learning_sync_receipts (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                request_id TEXT NOT NULL,
                payload_hash TEXT NOT NULL,
                result_json TEXT NOT NULL,
                PRIMARY KEY (user_id, request_id)
            );
            """
        )
        columns = {str(row["name"]) for row in connection.execute("PRAGMA table_info(users)")}
        if "email" in columns and "username" not in columns:
            connection.execute("ALTER TABLE users RENAME COLUMN email TO username")
        for table in ("folders", "learning_items"):
            existing = {str(row["name"]) for row in connection.execute(f"PRAGMA table_info({table})")}
            if "deleted_at" not in existing:
                connection.execute(f"ALTER TABLE {table} ADD COLUMN deleted_at INTEGER")
            if "trash_root_id" not in existing:
                connection.execute(f"ALTER TABLE {table} ADD COLUMN trash_root_id TEXT")
        connection.executescript(
            """
            DROP INDEX IF EXISTS folder_sibling_name_idx;
            CREATE UNIQUE INDEX folder_sibling_name_idx
                ON folders(user_id, COALESCE(parent_id, ''), name_key) WHERE deleted_at IS NULL;
            DROP INDEX IF EXISTS learning_item_identity;
            CREATE UNIQUE INDEX learning_item_identity
                ON learning_items(user_id, folder_id, category, text) WHERE deleted_at IS NULL;
            """
        )
