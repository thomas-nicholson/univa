import type { AiEditorAction, AiEditorActionEnvelope } from "../../types/ai-editor";

const ALLOWED_ACTIONS = new Set<AiEditorAction["type"]>([
  "import_media",
  "insert_at_playhead",
  "append_to_timeline",
  "replace_selected_clip",
  "create_text_overlay",
  "add_caption_track",
  "create_rough_cut",
]);

export interface TypeScriptAgentPayload {
  assistantMessage: string;
  summary?: string;
  editorActions: AiEditorActionEnvelope[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractJsonObject(input: string): string | null {
  const fencedMatch = input.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = input.indexOf("{");
  const lastBrace = input.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return input.slice(firstBrace, lastBrace + 1);
}

export function normalizeEditorAction(candidate: unknown): AiEditorAction | null {
  if (!isRecord(candidate)) return null;

  const type = candidate.type;
  if (typeof type !== "string" || !ALLOWED_ACTIONS.has(type as AiEditorAction["type"])) {
    return null;
  }

  const action: AiEditorAction = { type: type as AiEditorAction["type"] };
  if (typeof candidate.projectId === "string") action.projectId = candidate.projectId;
  if (typeof candidate.mediaPath === "string") action.mediaPath = candidate.mediaPath;
  if (candidate.mediaType === "video" || candidate.mediaType === "image" || candidate.mediaType === "audio") {
    action.mediaType = candidate.mediaType;
  }
  if (typeof candidate.text === "string") action.text = candidate.text;
  if (typeof candidate.title === "string") action.title = candidate.title;
  if (typeof candidate.trackId === "string") action.trackId = candidate.trackId;
  if (typeof candidate.elementId === "string") action.elementId = candidate.elementId;
  if (typeof candidate.startTime === "number") action.startTime = candidate.startTime;
  if (typeof candidate.duration === "number") action.duration = candidate.duration;
  if (isRecord(candidate.metadata)) action.metadata = candidate.metadata;
  return action;
}

export function normalizeTypeScriptAgentPayload(raw: string): TypeScriptAgentPayload {
  const jsonCandidate = extractJsonObject(raw);
  if (!jsonCandidate) {
    return {
      assistantMessage: raw.trim(),
      editorActions: [],
    };
  }

  try {
    const parsed = JSON.parse(jsonCandidate);
    if (!isRecord(parsed)) {
      throw new Error("Payload is not an object");
    }

    const sharedMeta = {
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : undefined,
      provider: typeof parsed.provider === "string" ? parsed.provider : undefined,
      model: typeof parsed.model === "string" ? parsed.model : undefined,
      outputPaths: Array.isArray(parsed.outputPaths)
        ? parsed.outputPaths.filter((item): item is string => typeof item === "string")
        : undefined,
    };

    const actionCandidates = [
      ...(Array.isArray(parsed.editor_actions) ? parsed.editor_actions : []),
      ...(Array.isArray(parsed.actions) ? parsed.actions : []),
      ...(parsed.editor_action ? [parsed.editor_action] : []),
    ];

    const editorActions = actionCandidates
      .map((candidate) => normalizeEditorAction(candidate))
      .filter((candidate): candidate is AiEditorAction => candidate !== null)
      .map((action) => ({ action, ...sharedMeta }));

    return {
      assistantMessage:
        typeof parsed.assistant_message === "string"
          ? parsed.assistant_message
          : typeof parsed.message === "string"
            ? parsed.message
            : typeof parsed.content === "string"
              ? parsed.content
              : raw.trim(),
      summary: sharedMeta.summary,
      editorActions,
    };
  } catch {
    return {
      assistantMessage: raw.trim(),
      editorActions: [],
    };
  }
}

export function buildTodoProgress(prompt: string): {
  overall_description: string;
  items: Array<{ id: number; description: string; status: "pending" | "in_progress" | "completed" }>;
} {
  const trimmedPrompt = prompt.trim() || "the requested edit";
  return {
    overall_description: `Handle: ${trimmedPrompt}`,
    items: [
      { id: 1, description: "Understand the editing request", status: "completed" },
      { id: 2, description: "Generate the TypeScript copilot response", status: "in_progress" },
      { id: 3, description: "Return editor actions and completion state", status: "pending" },
    ],
  };
}
