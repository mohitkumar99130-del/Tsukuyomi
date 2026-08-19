"""
database.py - SQLite database initialization and queries for Tsukuyomi backend.

Uses Python's built-in sqlite3 — no ORM needed for this hackathon.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "tsukuyomi.db")

CREATE_INCIDENTS_TABLE = """
CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    device_name TEXT,
    latitude REAL,
    longitude REAL,
    accuracy REAL,
    photo_filename TEXT,
    email_status TEXT,
    email_error TEXT
);
"""


def get_connection() -> sqlite3.Connection:
    """Return a new SQLite connection with row_factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they do not yet exist. Called once on startup."""
    with get_connection() as conn:
        conn.execute(CREATE_INCIDENTS_TABLE)
        conn.commit()
    print(f"[db] Database initialized at: {DB_PATH}")


def get_latest_incident() -> dict | None:
    """Return the most recent incident row as a dict, or None if the table is empty."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM incidents ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return None
    return dict(row)


def create_incident(
    *,
    id: str,
    created_at: str,
    device_name: str,
    latitude: float,
    longitude: float,
    accuracy: float,
    photo_filename: str,
    email_status: str = "pending",
    email_error: str = "",
) -> dict:
    """Insert a new incident row and return it as a dict."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO incidents
                (id, created_at, device_name, latitude, longitude, accuracy,
                 photo_filename, email_status, email_error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (id, created_at, device_name, latitude, longitude, accuracy,
             photo_filename, email_status, email_error),
        )
        conn.commit()
    return {
        "id": id,
        "created_at": created_at,
        "device_name": device_name,
        "latitude": latitude,
        "longitude": longitude,
        "accuracy": accuracy,
        "photo_filename": photo_filename,
        "email_status": email_status,
        "email_error": email_error,
    }


def update_email_status(incident_id: str, status: str, error: str = "") -> None:
    """Update the email_status and email_error columns for a given incident."""
    with get_connection() as conn:
        conn.execute(
            "UPDATE incidents SET email_status = ?, email_error = ? WHERE id = ?",
            (status, error, incident_id),
        )
        conn.commit()
