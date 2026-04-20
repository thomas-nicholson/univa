import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function authConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.BETTER_AUTH_SECRET &&
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  );
}

async function handle(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "Auth is disabled in single-service mode" },
      { status: 503 },
    );
  }

  const { auth } = await import("@opencut/auth");
  const { toNextJsHandler } = await import("better-auth/next-js");
  const handler = toNextJsHandler(auth);
  return request.method === "POST" ? handler.POST(request) : handler.GET(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
