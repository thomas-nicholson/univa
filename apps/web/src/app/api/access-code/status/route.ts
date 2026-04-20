import { NextRequest, NextResponse } from "next/server";

import { AccessCodeHttpError, getAccessCodeStatus } from "@/lib/server/access-codes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const accessCode = req.headers.get("X-Access-Code");
    const status = await getAccessCodeStatus(accessCode);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Access code status API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
