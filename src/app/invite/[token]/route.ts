import { NextResponse, type NextRequest } from "next/server";

import { rememberInvite } from "@/server/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (/^[A-Za-z0-9_-]{12,80}$/.test(token)) {
    await rememberInvite(token);
  }
  return NextResponse.redirect(new URL("/sign-up", request.url));
}
