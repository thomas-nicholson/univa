import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    enabled: false,
    usage_count: 0,
    conversation_count: 0,
    max_conversations: null,
    remaining_conversations: null,
    last_used: null,
    created_at: null,
  });
}
