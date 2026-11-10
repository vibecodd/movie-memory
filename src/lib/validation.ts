import { z } from "zod";

/** Must match the users.favorite_movie / movie_facts.movie column size. */
export const MOVIE_TITLE_MAX = 200;

/**
 * Favorite movie title: trimmed, inner whitespace collapsed to single spaces,
 * 1–200 characters. Used for server-side validation in the onboarding action.
 */
export const favoriteMovieSchema = z
  .string({ error: "Please enter a movie title." })
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, { error: "Please enter a movie title." })
      .max(MOVIE_TITLE_MAX, {
        error: `Movie title must be at most ${MOVIE_TITLE_MAX} characters.`,
      }),
  );
