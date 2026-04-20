import { NextRequest, NextResponse } from "next/server";

import { AccessCodeHttpError, getAccessCodeStats, requireAdminAccess } from "@/lib/server/access-codes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    return NextResponse.json(await getAccessCodeStats());
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Access code stats API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
