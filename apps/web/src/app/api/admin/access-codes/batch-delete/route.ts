import { NextRequest, NextResponse } from "next/server";

import { AccessCodeHttpError, batchDeleteAccessCodes, requireAdminAccess } from "@/lib/server/access-codes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    const body = await req.json();
    return NextResponse.json(await batchDeleteAccessCodes(body.access_codes || []));
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Batch delete access code API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
