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
    email_error TEXT,
    ai_status TEXT,
    ai_quality_score INTEGER,
    ai_issues TEXT,
    ai_context_summary TEXT,
    ai_retry_requested INTEGER,
    ai_original_score INTEGER,
    ai_retry_score INTEGER,
    ai_selected_photo TEXT,
    primary_email_status TEXT,
    primary_sent_at TEXT,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_at TEXT,
    secondary_email_status TEXT,
    secondary_sent_at TEXT,
    campus_email_status TEXT,
    campus_sent_at TEXT,
    escalation_status TEXT
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
            "SELECT * FROM incidents ORDER BY rowid DESC LIMIT 1"
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


def update_incident_ai_data(
    incident_id: str,
    ai_status: str,
    ai_quality_score: int | None = None,
    ai_issues: str | None = None,
    ai_context_summary: str | None = None,
    ai_retry_requested: int = 0,
    ai_original_score: int | None = None,
    ai_selected_photo: str | None = None
) -> None:
    """Update AI analysis results for an incident."""
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE incidents SET 
                ai_status = ?,
                ai_quality_score = ?,
                ai_issues = ?,
                ai_context_summary = ?,
                ai_retry_requested = ?,
                ai_original_score = ?,
                ai_selected_photo = ?
            WHERE id = ?
            """,
            (ai_status, ai_quality_score, ai_issues, ai_context_summary, 
             ai_retry_requested, ai_original_score, ai_selected_photo, incident_id)
        )
        conn.commit()


def update_incident_retry_data(
    incident_id: str,
    ai_retry_score: int,
    ai_selected_photo: str
) -> None:
    """Update AI analysis results after a retry."""
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE incidents SET 
                ai_retry_score = ?,
                ai_selected_photo = ?
            WHERE id = ?
            """,
            (ai_retry_score, ai_selected_photo, incident_id)
        )
        conn.commit()

def get_incident(incident_id: str) -> dict | None:
    """Return an incident by ID."""
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    if row is None:
        return None
    return dict(row)

def update_escalation_status(
    incident_id: str, 
    escalation_status: str,
    primary_email_status: str | None = None,
    primary_sent_at: str | None = None,
    secondary_email_status: str | None = None,
    secondary_sent_at: str | None = None,
    campus_email_status: str | None = None,
    campus_sent_at: str | None = None,
) -> None:
    """Update the escalation status and email timestamps."""
    query_parts = ["escalation_status = ?"]
    params = [escalation_status]
    
    if primary_email_status is not None:
        query_parts.append("primary_email_status = ?")
        params.append(primary_email_status)
    if primary_sent_at is not None:
        query_parts.append("primary_sent_at = ?")
        params.append(primary_sent_at)
    if secondary_email_status is not None:
        query_parts.append("secondary_email_status = ?")
        params.append(secondary_email_status)
    if secondary_sent_at is not None:
        query_parts.append("secondary_sent_at = ?")
        params.append(secondary_sent_at)
    if campus_email_status is not None:
        query_parts.append("campus_email_status = ?")
        params.append(campus_email_status)
    if campus_sent_at is not None:
        query_parts.append("campus_sent_at = ?")
        params.append(campus_sent_at)
        
    params.append(incident_id)
    
    with get_connection() as conn:
        conn.execute(
            f"UPDATE incidents SET {', '.join(query_parts)} WHERE id = ?",
            tuple(params)
        )
        conn.commit()

def acknowledge_incident(incident_id: str, acknowledged_at: str) -> None:
    """Mark an incident as acknowledged by the owner."""
    with get_connection() as conn:
        conn.execute(
            "UPDATE incidents SET acknowledged = 1, acknowledged_at = ?, escalation_status = 'acknowledged' WHERE id = ?",
            (acknowledged_at, incident_id)
        )
        conn.commit()

def get_active_escalations() -> list[dict]:
    """Return incidents that are not yet acknowledged and not completely done with escalation."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM incidents WHERE acknowledged = 0 AND escalation_status NOT IN ('acknowledged', 'campus_alerted', 'error') AND escalation_status IS NOT NULL"
        ).fetchall()
    return [dict(row) for row in rows]
