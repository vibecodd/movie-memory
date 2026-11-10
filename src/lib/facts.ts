import "server-only";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { FACT_MODEL, generateMovieFact } from "@/lib/openai";

export type FactResult =
  /** Newly generated and stored. */
  | { status: "fresh"; content: string; created_at: Date }
  /** Generation failed; showing the latest stored fact for this movie. */
  | { status: "fallback"; content: string; created_at: Date }
  /** Generation failed and there is no stored fact to fall back to. */
  | { status: "unavailable" };

/**
 * Generate a new fun fact for the user's favorite movie and store it
 * (base version: one generation per dashboard request).
 *
 * Takes the user from the session DAL (requireOnboardedUser), never from
 * client input. If OpenAI or the insert fails, falls back to the most recent
 * stored fact for the same movie so the dashboard still renders.
 */
export async function getFactForUser(user: {
  id: string;
  favorite_movie: string;
}): Promise<FactResult> {
  const movie = user.favorite_movie;

  try {
    const content = await generateMovieFact(movie);
    const fact = await db.movie_facts.create({
      data: { user_id: user.id, movie, content, model: FACT_MODEL },
      select: { content: true, created_at: true },
    });
    return { status: "fresh", ...fact };
  } catch (err) {
    console.error("[facts] generation failed:", describeError(err));

    const last = await db.movie_facts.findFirst({
      where: { user_id: user.id, movie },
      orderBy: { created_at: "desc" },
      select: { content: true, created_at: true },
    });
    return last ? { status: "fallback", ...last } : { status: "unavailable" };
  }
}

function describeError(err: unknown) {
  if (err instanceof OpenAI.APIError) return `OpenAI ${err.status ?? "?"}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
