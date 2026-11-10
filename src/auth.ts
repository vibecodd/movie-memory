import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";

/**
 * Auth.js config: Google sign-in, JWT cookie sessions (no DB adapter).
 *
 * On every Google sign-in we upsert the `users` row keyed on Google's stable
 * `sub` id and store our own `users.id` in the token as `uid`.
 * Credentials come from AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET / AUTH_SECRET.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // `account` and `profile` are only present right after sign-in.
      if (account?.provider === "google" && profile?.sub) {
        const fields = {
          name: profile.name ?? null,
          email: profile.email ?? null,
          image: typeof profile.picture === "string" ? profile.picture : null,
        };
        const user = await db.users.upsert({
          where: { google_id: profile.sub },
          create: { google_id: profile.sub, ...fields },
          update: fields,
          select: { id: true },
        });
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      return session;
    },
  },
});
