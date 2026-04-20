from __future__ import annotations

import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable

from univa.config.config import config


PROJECT_ROOT = Path(__file__).resolve().parents[2]
UNIVA_ROOT = Path(__file__).resolve().parents[1]


def ensure_directory(path: str | Path) -> str:
    target = Path(path)
    target.mkdir(parents=True, exist_ok=True)
    return str(target)


def get_output_root() -> str:
    return ensure_directory(config.get("output_root", PROJECT_ROOT / "results"))


def build_output_path(kind: str, stem: str, extension: str) -> str:
    safe_stem = "_".join(stem.strip().split())[:60] or kind
    base_dir = Path(get_output_root()) / kind
    base_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = extension if extension.startswith(".") else f".{extension}"
    return str(base_dir / f"{timestamp}_{safe_stem}{ext}")


def get_media_provider(section: str, fallback: str) -> str:
    return str(config.get(f"{section}_provider", config.get("media_default_provider", fallback)))


def get_fal_api_key() -> str:
    return os.getenv("FAL_API_KEY", config.get("fal_api_key", ""))


def get_gemini_api_key() -> str:
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or config.get("gemini_api_key", "")


def get_hyperframes_cmd() -> list[str]:
    raw = os.getenv("HYPERFRAMES_CMD", config.get("hyperframes_cmd", "npx -y hyperframes"))
    return raw.split()


def run_command(args: Iterable[str], cwd: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(args),
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )


def merge_config(base: Dict[str, Any] | None, overrides: Dict[str, Any] | None) -> Dict[str, Any]:
    merged: Dict[str, Any] = dict(base or {})
    for key, value in (overrides or {}).items():
        if value is not None:
            merged[key] = value
    return merged
