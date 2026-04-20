import { randomUUID } from "node:crypto";

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { buildTodoProgress, normalizeTypeScriptAgentPayload } from "./typescript-agent-core";

const textEncoder = new TextEncoder();

export interface TypeScriptAgentResult {
  sessionId: string;
  assistantMessage: string;
  summary?: string;
  editorActions: ReturnType<typeof normalizeTypeScriptAgentPayload>["editorActions"];
  provider: string;
  model: string;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the single-service TypeScript agent");
  }

  return createOpenAI({ apiKey });
}

function getModelName(): string {
  return process.env.UNIVA_AGENT_MODEL || "gpt-4.1-mini";
}

function buildSystemPrompt(): string {
  return [
    "You are UniVA's single-service TypeScript copilot running inside a Next.js server route.",
    "Return JSON only.",
    "Schema:",
    "{",
    '  "assistant_message": string,',
    '  "summary": string,',
    '  "editor_actions": Array<{',
    '    "type": "import_media" | "insert_at_playhead" | "append_to_timeline" | "replace_selected_clip" | "create_text_overlay" | "add_caption_track" | "create_rough_cut",',
    '    "projectId"?: string,',
    '    "mediaPath"?: string,',
    '    "mediaType"?: "video" | "image" | "audio",',
    '    "text"?: string,',
    '    "title"?: string,',
    '    "trackId"?: string,',
    '    "elementId"?: string,',
    '    "startTime"?: number,',
    '    "duration"?: number,',
    '    "metadata"?: object',
    "  }>",
    "}",
    "Only emit editor_actions that the web editor can apply immediately.",
    "If no safe/applicable editor action exists, return an empty editor_actions array.",
    "Keep assistant_message concise and action-oriented.",
  ].join("\n");
}

export async function runTypeScriptAgent(prompt: string, sessionId?: string | null): Promise<TypeScriptAgentResult> {
  const modelName = getModelName();
  const openai = getOpenAIClient();
  const response = await generateText({
    model: openai(modelName),
    system: buildSystemPrompt(),
    prompt,
    temperature: 0.2,
  });

  const normalized = normalizeTypeScriptAgentPayload(response.text);

  return {
    sessionId: sessionId || randomUUID(),
    assistantMessage: normalized.assistantMessage,
    summary: normalized.summary,
    editorActions: normalized.editorActions.map((envelope) => ({
      ...envelope,
      provider: envelope.provider || "openai",
      model: envelope.model || modelName,
      prompt,
    })),
    provider: "openai",
    model: modelName,
  };
}

function toSseEvent(payload: unknown): Uint8Array {
  return textEncoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export function createTypeScriptAgentEventStream(params: {
  prompt: string;
  sessionId?: string | null;
}): ReadableStream<Uint8Array> {
  const resolvedSessionId = params.sessionId || randomUUID();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(toSseEvent({ type: "heartbeat", timestamp: Date.now() }));
      }, 20000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        controller.close();
      };

      try {
        const progress = buildTodoProgress(params.prompt);
        controller.enqueue(toSseEvent({ type: "todo_progress", ...progress }));
        controller.enqueue(
          toSseEvent({
            type: "content",
            content: "Single-service TypeScript copilot is handling your request...",
          }),
        );

        const result = await runTypeScriptAgent(params.prompt, resolvedSessionId);

        if (result.assistantMessage.trim()) {
          controller.enqueue(
            toSseEvent({
              type: "content",
              content: result.assistantMessage,
            }),
          );
        }

        for (const editorAction of result.editorActions) {
          controller.enqueue(
            toSseEvent({
              type: "editor_action",
              ...editorAction,
            }),
          );
        }

        controller.enqueue(
          toSseEvent({
            type: "finish",
            session_id: result.sessionId,
          }),
        );
        close();
      } catch (error) {
        controller.enqueue(
          toSseEvent({
            type: "error",
            content: error instanceof Error ? error.message : "TypeScript agent failed",
          }),
        );
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
}
