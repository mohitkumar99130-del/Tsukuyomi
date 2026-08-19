"""
main.py - FastAPI application for Tsukuyomi backend.

Phase: Core Pipeline
Endpoints: /api/health, /api/incidents/latest, POST /api/trigger, GET /media/{filename}
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv

from database import init_db, get_latest_incident, create_incident, update_email_status
from mailer import send_alert

load_dotenv()

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="Tsukuyomi API",
    description="Anti-theft backend for the Tsukuyomi PWA.",
    version="0.2.0",
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
    return {"status": "ok"}


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
    # Validate content type
    if photo.content_type not in ("image/jpeg", "image/jpg", "image/png"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type: {photo.content_type}. Expected image/jpeg.",
        )

    incident_id = str(uuid.uuid4())
    photo_filename = f"{incident_id}.jpg"
    photo_path = UPLOADS_DIR / photo_filename

    # Save uploaded image
    contents = await photo.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded photo is empty.")

    with open(photo_path, "wb") as f:
        f.write(contents)

    # Timestamp
    if not captured_at:
        captured_at = datetime.now(timezone.utc).isoformat()

    # Persist incident (email pending)
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

    # Attempt email delivery
    ok, err = send_alert(
        incident_id=incident_id,
        device_name=device_name,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        captured_at=captured_at,
        photo_path=str(photo_path),
    )

    status = "sent" if ok else "failed"
    update_email_status(incident_id, status, err)
    incident["email_status"] = status
    incident["email_error"] = err

    print(f"[trigger] Email status={status}" + (f" err={err}" if err else ""))

    return {"incident": incident}


# ── Media serving ─────────────────────────────────────────────────────────────

@app.get("/media/{filename}")
def serve_media(filename: str):
    # Prevent path traversal
    safe_name = Path(filename).name
    if safe_name != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = UPLOADS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(str(file_path), media_type="image/jpeg")
