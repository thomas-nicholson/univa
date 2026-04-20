import { NextRequest, NextResponse } from "next/server";

import { AccessCodeHttpError, createAccessCode, listAccessCodes, requireAdminAccess } from "@/lib/server/access-codes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));

    const search = req.nextUrl.searchParams.get("search");
    const enabledParam = req.nextUrl.searchParams.get("enabled");
    const skip = Number(req.nextUrl.searchParams.get("skip") || 0);
    const limit = Number(req.nextUrl.searchParams.get("limit") || 50);
    const enabled = enabledParam == null ? null : enabledParam === "true";

    return NextResponse.json(await listAccessCodes({ search, enabled, skip, limit }));
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Admin access codes API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    const body = await req.json();
    return NextResponse.json(
      await createAccessCode({
        user_id: body.user_id,
        description: body.description,
        max_conversations: body.max_conversations ?? null,
      }),
    );
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Create access code API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
