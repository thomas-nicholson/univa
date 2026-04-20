from __future__ import annotations

import mimetypes
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Tuple

import requests


BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files"


class GeminiApiError(RuntimeError):
    pass


def _require_key() -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise GeminiApiError("GEMINI_API_KEY / GOOGLE_API_KEY is not configured.")
    return api_key


def _resolve_local_video_path(video_path: str) -> Tuple[str, str | None]:
    if video_path.startswith("http://") or video_path.startswith("https://"):
        response = requests.get(video_path, timeout=120)
        response.raise_for_status()
        suffix = Path(video_path).suffix or ".mp4"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(response.content)
        tmp.flush()
        tmp.close()
        return tmp.name, tmp.name

    if not os.path.exists(video_path):
        raise GeminiApiError(f"Video path not found: {video_path}")
    return video_path, None


def _detect_mime_type(path: str) -> str:
    mime_type, _ = mimetypes.guess_type(path)
    return mime_type or "video/mp4"


def _start_resumable_upload(api_key: str, file_path: str, mime_type: str) -> str:
    file_size = os.path.getsize(file_path)
    headers = {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": str(file_size),
        "X-Goog-Upload-Header-Content-Type": mime_type,
        "Content-Type": "application/json",
    }
    payload = {"file": {"display_name": Path(file_path).name}}
    response = requests.post(
        f"{UPLOAD_URL}?key={api_key}",
        headers=headers,
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    upload_url = response.headers.get("x-goog-upload-url")
    if not upload_url:
        raise GeminiApiError("Gemini resumable upload did not return an upload URL.")
    return upload_url


def _finalize_upload(upload_url: str, file_path: str) -> Dict[str, Any]:
    file_size = os.path.getsize(file_path)
    with open(file_path, "rb") as handle:
        response = requests.post(
            upload_url,
            headers={
                "Content-Length": str(file_size),
                "X-Goog-Upload-Offset": "0",
                "X-Goog-Upload-Command": "upload, finalize",
            },
            data=handle,
            timeout=300,
        )
    response.raise_for_status()
    result = response.json()
    file_info = result.get("file")
    if not file_info:
        raise GeminiApiError("Gemini upload response did not include file metadata.")
    return file_info


def _get_file(api_key: str, file_name: str) -> Dict[str, Any]:
    response = requests.get(f"{BASE_URL}/files/{file_name}?key={api_key}", timeout=120)
    response.raise_for_status()
    result = response.json()
    return result.get("file") or result


def _wait_until_active(api_key: str, file_info: Dict[str, Any], poll_interval: int = 5, timeout: int = 300) -> Dict[str, Any]:
    started = time.time()
    current = file_info
    file_name = current.get("name")
    if not file_name:
        raise GeminiApiError("Gemini file metadata missing file name.")

    while True:
        state = current.get("state")
        if isinstance(state, dict):
            state_name = state.get("name")
        else:
            state_name = state

        if state_name == "ACTIVE":
            return current
        if state_name == "FAILED":
            raise GeminiApiError("Gemini file processing failed.")
        if time.time() - started > timeout:
            raise GeminiApiError("Timed out waiting for Gemini video processing to become ACTIVE.")

        time.sleep(poll_interval)
        current = _get_file(api_key, file_name)


def _delete_file(api_key: str, file_name: str) -> None:
    requests.delete(f"{BASE_URL}/files/{file_name}?key={api_key}", timeout=120)


def generate_content_from_video(
    video_path: str,
    prompt: str,
    model: str = "gemini-2.0-flash",
    cleanup_file: bool = True,
) -> Dict[str, Any]:
    api_key = _require_key()
    local_path, temporary_download = _resolve_local_video_path(video_path)
    mime_type = _detect_mime_type(local_path)
    file_info: Dict[str, Any] | None = None

    try:
        upload_url = _start_resumable_upload(api_key, local_path, mime_type)
        file_info = _finalize_upload(upload_url, local_path)
        file_info = _wait_until_active(api_key, file_info)

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "file_data": {
                                "mime_type": file_info.get("mimeType", mime_type),
                                "file_uri": file_info.get("uri"),
                            }
                        },
                    ]
                }
            ]
        }
        response = requests.post(
            f"{BASE_URL}/models/{model}:generateContent?key={api_key}",
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=300,
        )
        response.raise_for_status()
        result = response.json()

        text_parts = []
        for candidate in result.get("candidates", []):
            content = candidate.get("content", {})
            for part in content.get("parts", []):
                text = part.get("text")
                if text:
                    text_parts.append(text)

        output_text = "\n".join(text_parts).strip()
        if not output_text:
            raise GeminiApiError("Gemini video understanding returned no text output.")

        return {
            "success": True,
            "content": output_text,
            "raw_result": result,
            "message": "Video analyzed with Gemini.",
        }
    finally:
        if cleanup_file and file_info and file_info.get("name"):
            try:
                _delete_file(api_key, file_info["name"])
            except Exception:
                pass
        if temporary_download and os.path.exists(temporary_download):
            try:
                os.remove(temporary_download)
            except OSError:
                pass
