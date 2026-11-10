import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// next-auth/jwt re-exports this module, so augment the source.
declare module "@auth/core/jwt" {
  interface JWT {
    /** Our `users.id`, set on sign-in. */
    uid?: string;
  }
}
