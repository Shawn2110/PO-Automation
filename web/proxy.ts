import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge runtime: uses JWT only, no DB. Credentials/bcrypt stay in auth.ts.
export const { auth: proxy } = NextAuth(authConfig);

export default proxy((req) => {
  // authConfig.callbacks.authorized handles the actual gating.
  // This wrapper is here so Next.js picks up proxy.ts as a route guard.
});

export const config = {
  // Run on everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)"],
};
