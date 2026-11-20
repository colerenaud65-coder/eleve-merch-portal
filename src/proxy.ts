import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { clerkDevProxyEnabled } from "@/lib/clerk-proxy";

function isClerkPublic(pathname: string) {
  const devProxy = clerkDevProxyEnabled() && (pathname === "/__clerk" || pathname.startsWith("/__clerk/"));
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    devProxy
  );
}

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.DATABASE_URL && request.nextUrl.pathname !== "/setup") {
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    return NextResponse.rewrite(url);
  }
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }
  return clerkMiddleware(
    async (_auth, req) => {
      if (isClerkPublic(req.nextUrl.pathname)) return;
    },
    {
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      // pk_test_ keys have no first-party Frontend API, so /__clerk keeps the handshake on this origin.
      // pk_live_ keys use clerk.elevedirect.app directly. enabled: false also blocks Clerk's vercel.app auto-proxy.
      frontendApiProxy: { enabled: clerkDevProxyEnabled() },
    },
  )(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk(.*)",
  ],
};
