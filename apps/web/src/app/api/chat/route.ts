import { NextRequest, NextResponse } from "next/server";

import { runTypeScriptAgent } from "@/lib/server/typescript-agent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;
    const sessionId = body?.sessionId;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required and must be a string" }, { status: 400 });
    }

    const result = await runTypeScriptAgent(prompt, sessionId);

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      response: result.assistantMessage,
      editorActions: result.editorActions,
      provider: result.provider,
      model: result.model,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
