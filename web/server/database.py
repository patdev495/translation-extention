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
            """
        )
        columns = {str(row["name"]) for row in connection.execute("PRAGMA table_info(users)")}
        if "email" in columns and "username" not in columns:
            connection.execute("ALTER TABLE users RENAME COLUMN email TO username")
