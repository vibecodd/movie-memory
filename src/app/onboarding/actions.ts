"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { favoriteMovieSchema } from "@/lib/validation";

export type OnboardingState = {
  /** Validation message to show next to the input. */
  error?: string;
  /** What the user typed, so the form can keep it after an error. */
  value?: string;
};

/**
 * Save the signed-in user's favorite movie (first time only).
 *
 * - Re-checks the session here: server actions are public endpoints, so the
 *   page's redirects do not protect them.
 * - Validates on the server (trim, collapse whitespace, 1–200 chars).
 * - Conditional update `favorite_movie IS NULL` makes it first-time only even
 *   if the form is open on two devices: the second submit updates 0 rows and
 *   the user is sent to the dashboard with their original movie intact.
 */
export async function saveFavoriteMovie(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();

  const raw = formData.get("favorite_movie");
  const parsed = favoriteMovieSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid movie title.",
      value: typeof raw === "string" ? raw : "",
    };
  }

  // count === 0 means already onboarded (e.g. on another device): keep the
  // existing movie and just continue to the dashboard.
  await db.users.updateMany({
    where: { id: user.id, favorite_movie: null },
    data: { favorite_movie: parsed.data },
  });

  redirect("/dashboard");
}
