"""
main.py - FastAPI application for Tsukuyomi backend.

Phase 2: AI Evidence Intelligence added.
Endpoints:
  GET  /api/health
  GET  /api/incidents/latest
  POST /api/trigger
  POST /api/incidents/{id}/retry-photo
  GET  /media/{filename}
"""

import os
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from database import (
    init_db,
    get_latest_incident,
    create_incident,
    update_email_status,
    update_incident_ai_data,
    update_incident_retry_data,
)
from mailer import send_alert
from ai_analyzer import analyze_image, should_retry, select_best

load_dotenv()

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Tsukuyomi API",
    description="Anti-theft backend for the Tsukuyomi PWA.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "0.3.0"}


# ── Latest incident ───────────────────────────────────────────────────────────

@app.get("/api/incidents/latest")
def latest_incident():
    return {"incident": get_latest_incident()}


# ── Trigger ───────────────────────────────────────────────────────────────────

@app.post("/api/trigger")
async def trigger(
    device_name: str = Form("Unknown Device"),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy: float = Form(0.0),
    captured_at: str = Form(""),
    photo: UploadFile = File(...),
):
    if photo.content_type not in ("image/jpeg", "image/jpg", "image/png"):
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {photo.content_type}")

    incident_id = str(uuid.uuid4())
    photo_filename = f"{incident_id}.jpg"
    photo_path = UPLOADS_DIR / photo_filename

    contents = await photo.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded photo is empty.")

    with open(photo_path, "wb") as f:
        f.write(contents)

    if not captured_at:
        captured_at = datetime.now(timezone.utc).isoformat()

    # Create incident record
    incident = create_incident(
        id=incident_id,
        created_at=captured_at,
        device_name=device_name,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        photo_filename=photo_filename,
        email_status="pending",
        email_error="",
    )

    print(f"[trigger] Incident {incident_id} created — lat={latitude}, lon={longitude}")

    # ── AI Evidence Analysis ──────────────────────────────────────────────────
    ai_result = analyze_image(str(photo_path))
    print(f"[ai] Analysis result: status={ai_result.get('status')}, score={ai_result.get('quality_score')}")

    retry_needed = should_retry(ai_result)

    if ai_result.get("status") == "ok":
        ai_issues_json = json.dumps(ai_result.get("issues", []))
        update_incident_ai_data(
            incident_id=incident_id,
            ai_status="analyzed",
            ai_quality_score=ai_result.get("quality_score"),
            ai_issues=ai_issues_json,
            ai_context_summary=ai_result.get("context_summary", ""),
            ai_retry_requested=1 if retry_needed else 0,
            ai_original_score=ai_result.get("quality_score"),
            ai_selected_photo=photo_filename,  # default; may be updated on retry
        )
    else:
        update_incident_ai_data(
            incident_id=incident_id,
            ai_status=ai_result.get("status", "unavailable"),
            ai_selected_photo=photo_filename,
        )

    # If retry needed, return early — frontend will send second frame
    if retry_needed:
        print(f"[ai] Retry recommended for incident {incident_id} (score={ai_result.get('quality_score')})")
        return {
            "status": "retry_requested",
            "incident_id": incident_id,
            "ai_analysis": {
                "quality_score": ai_result.get("quality_score"),
                "issues": ai_result.get("issues", []),
                "context_summary": ai_result.get("context_summary", ""),
                "reason": ai_result.get("reason", ""),
            },
        }

    # No retry needed — proceed with email
    _send_email_and_update(
        incident_id=incident_id,
        device_name=device_name,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        captured_at=captured_at,
        photo_path=str(photo_path),
        ai_result=ai_result,
    )

    incident["ai_status"] = ai_result.get("status", "unavailable")
    incident["ai_quality_score"] = ai_result.get("quality_score")
    incident["ai_context_summary"] = ai_result.get("context_summary", "")
    incident["ai_issues"] = ai_result.get("issues", [])
    incident["ai_retry_requested"] = False
    incident["ai_selected_photo"] = photo_filename

    return {"status": "ok", "incident": incident}


# ── Retry Photo ───────────────────────────────────────────────────────────────

@app.post("/api/incidents/{incident_id}/retry-photo")
async def retry_photo(
    incident_id: str,
    photo: UploadFile = File(...),
):
    """Accept a second camera frame after AI recommended retry."""
    # Fetch original incident
    from database import get_connection
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM incidents WHERE id = ?", (incident_id,)
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident = dict(row)

    retry_filename = f"{incident_id}_retry.jpg"
    retry_path = UPLOADS_DIR / retry_filename

    contents = await photo.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Retry photo is empty.")

    with open(retry_path, "wb") as f:
        f.write(contents)

    # Analyze retry frame
    retry_result = analyze_image(str(retry_path))
    retry_score = retry_result.get("quality_score", 0) if retry_result.get("status") == "ok" else 0
    original_score = incident.get("ai_original_score") or 0

    # Select best image
    best_path, best_score = select_best(
        original_path=str(UPLOADS_DIR / incident["photo_filename"]),
        original_score=original_score,
        retry_path=str(retry_path),
        retry_score=retry_score,
    )
    best_filename = Path(best_path).name

    # Update DB with retry results
    update_incident_retry_data(
        incident_id=incident_id,
        ai_retry_score=retry_score,
        ai_selected_photo=best_filename,
    )

    print(f"[retry] original_score={original_score}, retry_score={retry_score}, selected={best_filename}")

    # Send email with best image
    _send_email_and_update(
        incident_id=incident_id,
        device_name=incident.get("device_name", "Unknown"),
        latitude=incident.get("latitude", 0),
        longitude=incident.get("longitude", 0),
        accuracy=incident.get("accuracy", 0),
        captured_at=incident.get("created_at", ""),
        photo_path=best_path,
        ai_result=retry_result if retry_score >= original_score else {
            "status": "ok",
            "quality_score": original_score,
            "context_summary": incident.get("ai_context_summary", ""),
            "issues": json.loads(incident.get("ai_issues") or "[]"),
        },
        retry_occurred=True,
        original_score=original_score,
        final_score=best_score,
    )

    return {
        "status": "ok",
        "incident_id": incident_id,
        "original_score": original_score,
        "retry_score": retry_score,
        "selected_photo": best_filename,
        "retry_result": retry_result if retry_result.get("status") == "ok" else None,
    }


# ── Helper ────────────────────────────────────────────────────────────────────

def _send_email_and_update(
    *,
    incident_id: str,
    device_name: str,
    latitude: float,
    longitude: float,
    accuracy: float,
    captured_at: str,
    photo_path: str,
    ai_result: dict,
    retry_occurred: bool = False,
    original_score: int | None = None,
    final_score: int | None = None,
):
    ok, err = send_alert(
        incident_id=incident_id,
        device_name=device_name,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        captured_at=captured_at,
        photo_path=photo_path,
        ai_result=ai_result,
        retry_occurred=retry_occurred,
        original_score=original_score,
        final_score=final_score,
    )
    status = "sent" if ok else "failed"
    update_email_status(incident_id, status, err)
    print(f"[email] status={status}" + (f" err={err}" if err else ""))


# ── Media serving ─────────────────────────────────────────────────────────────

@app.get("/media/{filename}")
def serve_media(filename: str):
    safe_name = Path(filename).name
    if safe_name != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    file_path = UPLOADS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(str(file_path), media_type="image/jpeg")
