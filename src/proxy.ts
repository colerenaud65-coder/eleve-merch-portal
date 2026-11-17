import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

function isClerkPublic(pathname: string) {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/__clerk" ||
    pathname.startsWith("/__clerk/")
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
      // Development keys (pk_test) do not auto-proxy on *.vercel.app.
      // Same-origin /__clerk keeps the dev-browser handshake first-party so Safari can finish it.
      frontendApiProxy: { enabled: true },
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
