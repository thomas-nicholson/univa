import { AiEditorAction, AiEditorActionEnvelope } from "@/types/ai-editor";

const ACTION_TYPES: AiEditorAction["type"][] = [
  "import_media",
  "insert_at_playhead",
  "append_to_timeline",
  "replace_selected_clip",
  "create_text_overlay",
  "add_caption_track",
  "create_rough_cut",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceAction(payload: unknown): AiEditorAction | null {
  if (!isRecord(payload)) return null;

  const type = payload.type;
  if (typeof type !== "string" || !ACTION_TYPES.includes(type as AiEditorAction["type"])) {
    return null;
  }

  const action: AiEditorAction = {
    type: type as AiEditorAction["type"],
  };

  if (typeof payload.projectId === "string") action.projectId = payload.projectId;
  if (typeof payload.mediaPath === "string") action.mediaPath = payload.mediaPath;
  if (
    payload.mediaType === "video" ||
    payload.mediaType === "image" ||
    payload.mediaType === "audio"
  ) {
    action.mediaType = payload.mediaType;
  }
  if (typeof payload.text === "string") action.text = payload.text;
  if (typeof payload.title === "string") action.title = payload.title;
  if (typeof payload.trackId === "string") action.trackId = payload.trackId;
  if (typeof payload.elementId === "string") action.elementId = payload.elementId;
  if (typeof payload.startTime === "number") action.startTime = payload.startTime;
  if (typeof payload.duration === "number") action.duration = payload.duration;
  if (isRecord(payload.metadata)) action.metadata = payload.metadata;

  return action;
}

export function extractEditorActions(payload: unknown): AiEditorActionEnvelope[] {
  if (!payload) return [];

  const envelopes: AiEditorActionEnvelope[] = [];

  const maybePush = (candidate: unknown, meta?: Partial<AiEditorActionEnvelope>) => {
    const action = coerceAction(candidate);
    if (!action) return;
    envelopes.push({
      action,
      summary: meta?.summary,
      prompt: meta?.prompt,
      provider: meta?.provider,
      model: meta?.model,
      outputPaths: meta?.outputPaths,
    });
  };

  if (Array.isArray(payload)) {
    payload.forEach((item) => maybePush(item));
    return envelopes;
  }

  if (!isRecord(payload)) {
    return envelopes;
  }

  const sharedMeta: Partial<AiEditorActionEnvelope> = {
    summary: typeof payload.summary === "string" ? payload.summary : undefined,
    prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
    provider: typeof payload.provider === "string" ? payload.provider : undefined,
    model: typeof payload.model === "string" ? payload.model : undefined,
    outputPaths: Array.isArray(payload.outputPaths)
      ? payload.outputPaths.filter((item): item is string => typeof item === "string")
      : Array.isArray(payload.output_path)
        ? payload.output_path.filter((item): item is string => typeof item === "string")
        : typeof payload.output_path === "string"
          ? [payload.output_path]
          : undefined,
  };

  if (Array.isArray(payload.editor_actions)) {
    payload.editor_actions.forEach((item) => maybePush(item, sharedMeta));
  }

  if (Array.isArray(payload.actions)) {
    payload.actions.forEach((item) => maybePush(item, sharedMeta));
  }

  if (isRecord(payload.editor_action)) {
    maybePush(payload.editor_action, sharedMeta);
  }

  if (typeof payload.type === "string") {
    maybePush(payload, sharedMeta);
  }

  return envelopes;
}
