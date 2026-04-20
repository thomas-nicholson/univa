from __future__ import annotations

from mcp.server.fastmcp import FastMCP

from mcp_tools.base import ToolResponse, setup_logger
from utils.hyperframes_cli import (
    ensure_available,
    initialize_project,
    render_project,
    synthesize_speech,
    transcribe_media,
)

logger = setup_logger(__name__, "logs/mcp_tools", "hyperframes_cli.log")
mcp = FastMCP("HyperFrames_CLI_Server")


@mcp.tool()
def hyperframes_doctor() -> ToolResponse:
    result = ensure_available()
    return ToolResponse(
        success=result["success"],
        message="HyperFrames CLI is available" if result["success"] else "HyperFrames CLI is unavailable",
        content={"stdout": result["stdout"], "stderr": result["stderr"], "command": result["command"]},
    )


@mcp.tool()
def hyperframes_init_project(target_dir: str, name: str = "UniVA Project") -> ToolResponse:
    result = initialize_project(target_dir, name=name)
    return ToolResponse(
        success=result["success"],
        output_path=target_dir if result["success"] else None,
        message="HyperFrames project initialized" if result["success"] else "Failed to initialize HyperFrames project",
        content={"stdout": result["stdout"], "stderr": result["stderr"], "command": result["command"]},
    )


@mcp.tool()
def hyperframes_render_project(project_dir: str, output_path: str | None = None) -> ToolResponse:
    result = render_project(project_dir, output_path=output_path)
    return ToolResponse(
        success=result["success"],
        output_path=result.get("output_path"),
        message="HyperFrames render completed" if result["success"] else "HyperFrames render failed",
        content={"stdout": result["stdout"], "stderr": result["stderr"], "command": result["command"]},
    )


@mcp.tool()
def hyperframes_generate_speech(text: str, output_path: str | None = None, voice: str | None = None) -> ToolResponse:
    result = synthesize_speech(text, output_path=output_path, voice=voice)
    return ToolResponse(
        success=result["success"],
        output_path=result.get("output_path"),
        message="HyperFrames speech generated" if result["success"] else "HyperFrames speech generation failed",
        content={"stdout": result["stdout"], "stderr": result["stderr"], "command": result["command"]},
    )


@mcp.tool()
def hyperframes_transcribe_media(input_path: str, project_dir: str | None = None, model: str | None = None) -> ToolResponse:
    result = transcribe_media(input_path, project_dir=project_dir, model=model)
    return ToolResponse(
        success=result["success"],
        message="HyperFrames transcription completed" if result["success"] else "HyperFrames transcription failed",
        content={"stdout": result["stdout"], "stderr": result["stderr"], "command": result["command"]},
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
