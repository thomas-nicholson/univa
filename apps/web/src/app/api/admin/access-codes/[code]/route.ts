import { NextRequest, NextResponse } from "next/server";

import {
  AccessCodeHttpError,
  deleteAccessCode,
  getAccessCode,
  requireAdminAccess,
  updateAccessCode,
} from "@/lib/server/access-codes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    const { code: accessCode } = await context.params;
    const code = await getAccessCode(accessCode);
    if (!code) {
      return NextResponse.json({ error: "Access code not found" }, { status: 404 });
    }
    return NextResponse.json(code);
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Get access code API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    const { code: accessCode } = await context.params;
    const body = await req.json();
    return NextResponse.json(
      await updateAccessCode(accessCode, {
        description: body.description,
        enabled: body.enabled,
        max_conversations: body.max_conversations,
      }),
    );
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Update access code API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    await requireAdminAccess(req.headers.get("X-Access-Code"));
    const { code: accessCode } = await context.params;
    return NextResponse.json(await deleteAccessCode(accessCode));
  } catch (error) {
    if (error instanceof AccessCodeHttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Delete access code API error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
