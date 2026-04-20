import { NextRequest, NextResponse } from "next/server";

import { AccessCodeHttpError, batchCreateAccessCodes, requireAdminAccess } from "@/lib/server/access-codes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    const body = await req.json();
    return NextResponse.json(
      await batchCreateAccessCodes({
        count: body.count,
        user_id_prefix: body.user_id_prefix,
        description: body.description,
        max_conversations: body.max_conversations ?? null,
      }),
    );
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Batch create access code API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
