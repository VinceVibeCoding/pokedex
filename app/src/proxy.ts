// Next.js 16 request-interception file (middleware.ts on 15 and earlier).
// Only the watchlist page and its API need a session; card lookups, search, and
// the cron endpoint (which authenticates itself via CRON_SECRET) stay public.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/watchlist(.*)", "/api/watchlist(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
