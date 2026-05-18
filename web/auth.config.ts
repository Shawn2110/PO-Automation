import type { NextAuthConfig } from "next-auth";

// Edge-safe: no DB/bcrypt imports here. The Credentials provider lives in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic =
        nextUrl.pathname === "/login" ||
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/api/auth");

      if (isPublic) return true;
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? "viewer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // populated in auth.ts
} satisfies NextAuthConfig;
