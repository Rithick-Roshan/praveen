import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "qf_admin.db")


def get_db():
    """Return a new database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row          # rows behave like dicts
    conn.execute("PRAGMA journal_mode=WAL") # better concurrency
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create all tables if they don't exist yet."""
    conn = get_db()
    cursor = conn.cursor()

    # ── Admins ──────────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name   TEXT    NOT NULL,
            email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            password    TEXT    NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # ── Password-reset tokens ────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
            token       TEXT    NOT NULL UNIQUE,
            expires_at  TEXT    NOT NULL,
            used        INTEGER NOT NULL DEFAULT 0
        )
    """)

    # ── Opportunities ────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS opportunities (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id            INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
            name                TEXT    NOT NULL,
            duration            TEXT    NOT NULL,
            start_date          TEXT    NOT NULL,
            description         TEXT    NOT NULL,
            skills              TEXT    NOT NULL,   -- JSON array stored as text
            category            TEXT    NOT NULL,
            future_opportunities TEXT   NOT NULL,
            max_applicants      INTEGER,            -- NULL means not provided
            created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    """)

    conn.commit()
    conn.close()