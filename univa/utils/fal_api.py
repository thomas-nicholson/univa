from __future__ import annotations

import os
from typing import Any, Dict, Optional

from utils.runtime import get_fal_api_key

try:
    import fal_client
except Exception:  # pragma: no cover - dependency may be absent until installed
    fal_client = None


class FalApiError(RuntimeError):
    pass


def _require_client() -> Any:
    if fal_client is None:
        raise FalApiError("fal-client is not installed. Add fal-client to the Python environment.")
    return fal_client


def _require_key() -> str:
    api_key = get_fal_api_key()
    if not api_key:
        raise FalApiError("FAL_API_KEY is not configured.")
    return api_key


def _configure() -> Any:
    client = _require_client()
    os.environ.setdefault("FAL_KEY", _require_key())
    return client


def maybe_upload_file(path_or_url: str) -> str:
    client = _configure()
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url
    if not os.path.exists(path_or_url):
        raise FalApiError(f"Input file not found: {path_or_url}")
    return client.upload_file(path_or_url)


def run_model(model_id: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    client = _configure()
    result = client.run(model_id, arguments=arguments)
    if not isinstance(result, dict):
        raise FalApiError(f"Unexpected fal.ai result type for {model_id}: {type(result)}")
    return result


def text_to_image_generate(prompt: str, model_id: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    result = run_model(model_id, {"prompt": prompt})
    image = (result.get("images") or [{}])[0]
    return {
        "success": bool(image.get("url")),
        "output_path": image.get("url") if output_path is None else output_path,
        "content": result,
        "message": "Image generated with fal.ai" if image.get("url") else "Image generation failed",
        "remote_url": image.get("url"),
    }


def image_to_image_generate(prompt: str, image_path: str | list[str], model_id: str) -> Dict[str, Any]:
    if isinstance(image_path, list):
        image_urls = [maybe_upload_file(item) for item in image_path]
        payload: Dict[str, Any] = {"prompt": prompt, "image_urls": image_urls}
    else:
        payload = {"prompt": prompt, "image_url": maybe_upload_file(image_path)}
    result = run_model(model_id, payload)
    image = (result.get("images") or [{}])[0]
    return {
        "success": bool(image.get("url")),
        "output_path": image.get("url"),
        "content": result,
        "message": "Image edited with fal.ai" if image.get("url") else "Image editing failed",
        "remote_url": image.get("url"),
    }


def text_to_video_generate(prompt: str, model_id: str) -> Dict[str, Any]:
    result = run_model(model_id, {"prompt": prompt})
    video = result.get("video") or result.get("data") or {}
    return {
        "success": bool(video.get("url")),
        "output_path": video.get("url"),
        "content": result,
        "message": "Video generated with fal.ai" if video.get("url") else "Video generation failed",
        "remote_url": video.get("url"),
    }


def image_to_video_generate(prompt: str, image_path: str, model_id: str) -> Dict[str, Any]:
    result = run_model(model_id, {"prompt": prompt, "image_url": maybe_upload_file(image_path)})
    video = result.get("video") or result.get("data") or {}
    return {
        "success": bool(video.get("url")),
        "output_path": video.get("url"),
        "content": result,
        "message": "Image-to-video generated with fal.ai" if video.get("url") else "Image-to-video generation failed",
        "remote_url": video.get("url"),
    }


def speech_to_text(audio_path: str, model_id: str, language: Optional[str] = None) -> Dict[str, Any]:
    payload: Dict[str, Any]
    audio_url = maybe_upload_file(audio_path)
    if model_id == "fal-ai/whisper":
        payload = {"audio_url": audio_url, "task": "transcribe", "chunk_level": "word"}
        if language:
            payload["language"] = language
    else:
        payload = {"audio_url": audio_url}
        if language:
            payload["language_code"] = language
    return run_model(model_id, payload)


def text_to_speech(text: str, model_id: str, voice: Optional[str] = None, speed: float = 1.0) -> Dict[str, Any]:
    if model_id == "xai/tts/v1":
        payload: Dict[str, Any] = {"text": text, "language": "auto"}
        if voice:
            payload["voice"] = voice
    else:
        payload = {"prompt": text, "speed": speed}
        if voice:
            payload["voice"] = voice
    return run_model(model_id, payload)
