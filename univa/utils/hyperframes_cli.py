from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from utils.runtime import build_output_path, get_hyperframes_cmd, run_command


class HyperframesCliError(RuntimeError):
    pass


def _run_hyperframes(args: List[str], cwd: str | None = None) -> Dict[str, Any]:
    command = [*get_hyperframes_cmd(), *args]
    result = run_command(command, cwd=cwd)
    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "command": command,
    }


def ensure_available() -> Dict[str, Any]:
    return _run_hyperframes(["--help"])


def render_project(project_dir: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    final_output = output_path or build_output_path("renders", "hyperframes_render", ".mp4")
    result = _run_hyperframes(["render", project_dir, "--output", final_output], cwd=project_dir)
    result["output_path"] = final_output if result["success"] else None
    return result


def transcribe_media(input_path: str, project_dir: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    args = ["transcribe", input_path]
    if project_dir:
        args.extend(["--dir", project_dir])
    if model:
        args.extend(["--model", model])
    return _run_hyperframes(args, cwd=project_dir)


def synthesize_speech(text: str, output_path: Optional[str] = None, voice: Optional[str] = None) -> Dict[str, Any]:
    final_output = output_path or build_output_path("audio", "hyperframes_tts", ".wav")
    args = ["tts", text, "--output", final_output]
    if voice:
        args.extend(["--voice", voice])
    result = _run_hyperframes(args)
    result["output_path"] = final_output if result["success"] else None
    return result


def initialize_project(target_dir: str, name: Optional[str] = None) -> Dict[str, Any]:
    Path(target_dir).mkdir(parents=True, exist_ok=True)
    args = ["init", target_dir]
    if name:
        args.extend(["--name", name])
    return _run_hyperframes(args, cwd=str(Path(target_dir).parent))
