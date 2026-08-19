"""
ai_analyzer.py - Evidence quality analysis using Google Gemini vision model.

Evaluates security photos for usefulness as evidence.
DOES NOT perform face recognition, identity inference, or sensitive trait analysis.
"""

import os
import json
import base64
import re
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Quality threshold — below this score, retry is recommended
QUALITY_THRESHOLD = 60

SYSTEM_PROMPT = """You are a forensic evidence quality assessor for a device anti-theft system.

Your ONLY job is to evaluate whether a security photo is USEFUL as evidence for recovering a lost or stolen device.

You MUST evaluate ONLY:
1. Image clarity and sharpness
2. Lighting quality (too dark, too bright, or adequate)
3. Whether the camera appears obstructed or covered
4. Amount of useful environmental detail (scene context, signage, landmarks)
5. Overall evidential value for device recovery

You MUST NOT:
- Identify any person
- Perform facial recognition
- Guess anyone's name, age, gender, race, ethnicity, religion, or any personal characteristics
- Make any judgment about whether a person "looks suspicious" or "like a thief"
- Accuse any person of any behavior

You may neutrally note:
- "A person-shaped subject is partially visible in the frame"
- "The scene appears to be indoors / outdoors"
- "A readable sign or text may be present"
- "The environment shows [neutral description, e.g. office, corridor, street]"

Respond ONLY with a valid JSON object in this exact schema, no markdown, no explanation:

{
  "usable": <boolean>,
  "quality_score": <integer 0-100>,
  "issues": <array of zero or more from: "blurred", "too_dark", "overexposed", "obstructed", "low_detail", "poor_angle", "none">,
  "context_summary": "<1-2 sentences of neutral evidence context>",
  "retry_recommended": <boolean>,
  "reason": "<short explanation of quality assessment>"
}

Examples of good context_summary values:
- "Image is clear and shows an indoor corridor with sufficient lighting and environmental detail."
- "Image is heavily blurred and contains very little recoverable visual context."
- "The scene appears to be a dimly lit interior; insufficient detail for useful evidence."
"""


def _is_configured() -> bool:
    return bool(GEMINI_API_KEY and GEMINI_API_KEY.strip())


def _parse_ai_response(text: str) -> dict:
    """Extract and validate JSON from Gemini response text."""
    # Strip markdown code fences if present
    text = re.sub(r"```(?:json)?", "", text).strip()
    data = json.loads(text)

    # Validate and coerce required fields
    return {
        "usable": bool(data.get("usable", False)),
        "quality_score": max(0, min(100, int(data.get("quality_score", 0)))),
        "issues": list(data.get("issues", ["low_detail"])),
        "context_summary": str(data.get("context_summary", ""))[:500],
        "retry_recommended": bool(data.get("retry_recommended", False)),
        "reason": str(data.get("reason", ""))[:300],
    }


def analyze_image(image_path: str) -> dict:
    """
    Analyze image quality using Gemini vision.
    Returns structured analysis dict, or unavailable status on failure.
    """
    if not _is_configured():
        return {
            "status": "unavailable",
            "reason": "GEMINI_API_KEY not configured",
        }

    path = Path(image_path)
    if not path.exists():
        return {
            "status": "unavailable",
            "reason": f"Image file not found: {image_path}",
        }

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)

        # Read image and encode
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        ext = path.suffix.lower()
        mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime),
                        types.Part.from_text(text=SYSTEM_PROMPT),
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=512,
            ),
        )

        raw_text = response.text
        print(f"[ai] Gemini raw response: {raw_text[:200]}")

        result = _parse_ai_response(raw_text)
        result["status"] = "ok"
        return result

    except json.JSONDecodeError as e:
        print(f"[ai] JSON parse error: {e}")
        return {"status": "parse_error", "reason": str(e)}
    except Exception as e:
        print(f"[ai] Analysis error: {e}")
        return {"status": "error", "reason": str(e)}


def should_retry(analysis: dict) -> bool:
    """Return True if a retry capture should be requested."""
    if analysis.get("status") != "ok":
        return False
    if not analysis.get("usable", True):
        return analysis.get("retry_recommended", False)
    return (
        analysis.get("quality_score", 100) < QUALITY_THRESHOLD
        and analysis.get("retry_recommended", False)
    )


def select_best(
    original_path: str,
    original_score: int,
    retry_path: str,
    retry_score: int,
) -> tuple[str, int]:
    """Return (best_path, best_score) based on quality scores."""
    if retry_score >= original_score:
        return retry_path, retry_score
    return original_path, original_score
