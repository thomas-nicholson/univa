import { NextRequest, NextResponse } from "next/server";

import { AccessCodeHttpError, exportAccessCodes, requireAdminAccess } from "@/lib/server/access-codes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    const payload = await exportAccessCodes();
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename=access_codes_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      },
    });
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Export access code API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
