import os
import yaml
from mcp.server.fastmcp import FastMCP

from mcp_tools.base import ToolResponse, setup_logger
from utils.runtime import get_media_provider
from utils.fal_api import FalApiError, video_understanding as fal_video_understanding
from utils.gemini_api import GeminiApiError, generate_content_from_video as gemini_video_understanding


config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config/mcp_tools_config/config.yaml")
with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

video_understanding_config = config.get('video_understanding', {})

logger = setup_logger(__name__, "logs/mcp_tools", "video_understanding.log")
logger.info(f"Loaded video_understanding_config: {video_understanding_config}")

mcp = FastMCP("Video_Understanding_Server")


def _resolve_video_provider(provider: str | None = None) -> str:
    if provider:
        return provider
    configured = video_understanding_config.get("provider")
    if configured:
        return str(configured)
    return get_media_provider("video_understanding", "fal")


def _resolve_video_model(model: str | None = None) -> str:
    return model or video_understanding_config.get("default_model", "gemini-2.0-flash")


def _analyze_video(
    prompt: str,
    video_path: str,
    provider: str | None = None,
    model: str | None = None,
    detailed_analysis: bool | None = None,
) -> ToolResponse:
    resolved_provider = _resolve_video_provider(provider)
    resolved_model = _resolve_video_model(model)
    resolved_detail = (
        bool(detailed_analysis)
        if detailed_analysis is not None
        else bool(video_understanding_config.get("detailed_analysis", False))
    )

    if resolved_provider == "gemini":
        try:
            result = gemini_video_understanding(
                video_path=video_path,
                prompt=prompt,
                model=resolved_model,
                cleanup_file=True,
            )
            return ToolResponse(
                success=result.get("success", False),
                message=result.get("message", "Video understanding completed."),
                content=result.get("content"),
            )
        except GeminiApiError as exc:
            logger.warning(f"gemini video understanding failed, falling back to fal/multimodal_query: {exc}")

    if resolved_provider in {"gemini", "fal"}:
        try:
            result = fal_video_understanding(
                video_path=video_path,
                prompt=prompt,
                model_id=(resolved_model if resolved_provider == "fal" else "fal-ai/video-understanding"),
                detailed_analysis=resolved_detail,
            )
            return ToolResponse(
                success=result.get("success", False),
                message=result.get("message", "Video understanding completed."),
                content=result.get("content"),
            )
        except FalApiError as exc:
            logger.warning(f"fal video understanding failed, falling back to multimodal_query: {exc}")
            from utils.query_llm import multimodal_query
            fallback_content = multimodal_query(prompt, video_path=video_path)
            return ToolResponse(
                success=True,
                message="Video analyzed with fallback multimodal understanding.",
                content=fallback_content,
            )

    from utils.query_llm import multimodal_query
    fallback_content = multimodal_query(prompt, video_path=video_path)
    return ToolResponse(
        success=True,
        message=f"Video analyzed with provider '{resolved_provider}'.",
        content=fallback_content,
    )


@mcp.tool()
def vision2text_gen(
    prompt: str,
    multimodal_path: str,
    type: str,
    provider: str | None = None,
    model: str | None = None,
    detailed_analysis: bool = False,
) -> dict:
    """
    Analyzes and describes the content of a video or image based on a given prompt.

    Args:
        prompt (str): User's instruction.
        multimodal_path (str): The path or URL of the video or image.
        type (str): Either "video" or "image".
        provider (str | None): Optional provider override. For video, defaults to fal-first.
        model (str | None): Optional model override.
        detailed_analysis (bool): When using fal video understanding, request richer analysis.

    Returns:
        dict: ToolResponse with understanding content.
    """
    try:
        if type == "video":
            return _analyze_video(
                prompt=prompt,
                video_path=multimodal_path,
                provider=provider,
                model=model,
                detailed_analysis=detailed_analysis,
            )

        if type == "image":
            content = multimodal_query(prompt, image_path=multimodal_path)
            return ToolResponse(
                success=True,
                message="Image understood successfully.",
                content=content,
            )

        return ToolResponse(
            success=False,
            message="The type of the multimodal input should be either 'video' or 'image'.",
        )
    except Exception as e:
        return ToolResponse(
            success=False,
            message=f"An error occurred: {str(e)}",
        )


@mcp.tool()
def review_video_for_improvement(
    video_path: str,
    creative_brief: str = "",
    goals: str = "",
    provider: str | None = None,
    model: str | None = None,
    detailed_analysis: bool = True,
) -> dict:
    """
    Review a generated or edited video and suggest improvements.

    This tool is intended for human-in-the-loop workflows:
    it critiques the video and proposes next steps, but it does not make edits automatically.

    Args:
        video_path (str): Path or URL to the video.
        creative_brief (str): Optional high-level brief for what the video should achieve.
        goals (str): Optional concrete goals such as pacing, readability, branding, clarity, hook, etc.
        provider (str | None): Optional provider override. Defaults to fal-first.
        model (str | None): Optional model override.
        detailed_analysis (bool): Whether to request a more detailed critique.

    Returns:
        dict: ToolResponse whose content contains critique + recommended next edits for human approval.
    """
    prompt = f"""
You are reviewing a draft video for an AI-assisted video editor.

Creative brief:
{creative_brief or 'No explicit creative brief provided.'}

Goals / evaluation criteria:
{goals or 'Assess clarity, pacing, composition, motion, legibility of text, continuity, and likely viewer impact.'}

Please return:
1. A concise summary of what the video shows.
2. What is working well.
3. What is weak or confusing.
4. A prioritized list of improvement suggestions.
5. A final section titled 'Human approval required' that states the next edits should be approved before execution.
""".strip()

    return _analyze_video(
        prompt=prompt,
        video_path=video_path,
        provider=provider,
        model=model,
        detailed_analysis=detailed_analysis,
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
