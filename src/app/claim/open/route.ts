import { NextResponse, type NextRequest } from "next/server";

function codeFrom(raw: string) {
  const match = raw.match(/\/claim\/([A-Za-z0-9_-]+)/);
  return (match?.[1] ?? raw).trim().split(/[?#]/)[0] ?? "";
}

export function GET(request: NextRequest) {
  const code = codeFrom(request.nextUrl.searchParams.get("code") ?? "");
  const next = code ? `/claim/${encodeURIComponent(code)}` : "/claim";
  return NextResponse.redirect(new URL(next, request.url));
}
