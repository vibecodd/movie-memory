import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Data Access Layer for the signed-in user. Every page and server action that
 * needs the user goes through here, so authorization is checked on the server.
 */

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  favorite_movie: string | null;
};

/** The signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Session reads must happen at request time: auth() re-encrypts the JWT
  // with random bytes, which Next rejects during prerendering.
  await connection();
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return null;

  // A valid cookie for a deleted user is treated as signed out.
  return db.users.findUnique({
    where: { id: uid },
    select: { id: true, name: true, email: true, image: true, favorite_movie: true },
  });
});

/** Where a signed-in user belongs: onboarding until they set a favorite movie. */
export function homePathFor(user: CurrentUser) {
  return user.favorite_movie ? "/dashboard" : "/onboarding";
}

/** Signed-in user or redirect to the landing page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/** Signed-in user who has completed onboarding, else redirect. */
export async function requireOnboardedUser() {
  const user = await requireUser();
  if (!user.favorite_movie) redirect("/onboarding");
  return { ...user, favorite_movie: user.favorite_movie };
}
