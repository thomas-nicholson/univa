import { NextRequest, NextResponse } from "next/server";

import { AccessCodeHttpError, consumeConversation } from "@/lib/server/access-codes";
import { createTypeScriptAgentEventStream } from "@/lib/server/typescript-agent";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prompt = searchParams.get("prompt");
    const sessionId = searchParams.get("sessionId");
    const accessCode = searchParams.get("accessCode");

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    await consumeConversation(accessCode);
    const stream = createTypeScriptAgentEventStream({ prompt, sessionId });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Chat stream API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
