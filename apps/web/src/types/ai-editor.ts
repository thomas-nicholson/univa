export type AiEditorActionType =
  | "import_media"
  | "insert_at_playhead"
  | "append_to_timeline"
  | "replace_selected_clip"
  | "create_text_overlay"
  | "add_caption_track"
  | "create_rough_cut";

export interface AiEditorAction {
  type: AiEditorActionType;
  projectId?: string;
  mediaPath?: string;
  mediaType?: "video" | "image" | "audio";
  text?: string;
  title?: string;
  trackId?: string;
  elementId?: string;
  startTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface AiEditorActionEnvelope {
  action: AiEditorAction;
  summary?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  outputPaths?: string[];
}

export interface AiEditorActionResult {
  ok: boolean;
  action: AiEditorAction;
  summary: string;
  importedMediaId?: string;
  error?: string;
}

export interface AiJobRecord {
  id: string;
  createdAt: string;
  prompt: string;
  provider?: string;
  model?: string;
  status: "pending" | "running" | "completed" | "failed";
  outputPaths?: string[];
  actions?: AiEditorAction[];
  actionResults?: AiEditorActionResult[];
}
