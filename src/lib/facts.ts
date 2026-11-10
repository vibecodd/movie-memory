import "server-only";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { FACT_MODEL, streamMovieFact } from "@/lib/openai";

/** JSON body sent when a new fact can't be generated. */
export type FactFallback =
  /** Showing the latest stored fact for this movie. */
  | { status: "fallback"; content: string }
  /** Nothing stored to fall back to. */
  | { status: "unavailable" };

export type FactStart =
  | { kind: "stream"; stream: ReadableStream<Uint8Array> }
  | { kind: "fallback"; body: FactFallback };

/**
 * Generate a new fun fact for the user's favorite movie as a text stream
 * (base version: one generation per request).
 *
 * - The user comes from the session (getCurrentUser), never from client input.
 * - Text is streamed as OpenAI produces it. The full fact is stored in
 *   movie_facts before the stream closes, so "done" on the client means saved.
 * - If OpenAI fails before any text, returns the latest stored fact for the
 *   same movie instead. If it fails midway, or the client disconnects
 *   (`signal`), the stream errors and nothing is stored.
 */
export async function startFactStream(
  user: { id: string; favorite_movie: string },
  signal: AbortSignal,
): Promise<FactStart> {
  const movie = user.favorite_movie;

  let deltas: AsyncIterable<string>;
  try {
    deltas = await streamMovieFact(movie, signal);
  } catch (err) {
    if (!signal.aborted) console.error("[facts] generation failed:", describeError(err));
    return { kind: "fallback", body: await latestStoredFact(user.id, movie) };
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        for await (const delta of deltas) {
          text += delta;
          controller.enqueue(encoder.encode(delta));
        }
        const content = text.trim();
        if (!content) throw new Error("OpenAI returned no text");

        await db.movie_facts.create({
          data: { user_id: user.id, movie, content, model: FACT_MODEL },
        });
        controller.close();
      } catch (err) {
        if (!signal.aborted) console.error("[facts] stream failed:", describeError(err));
        controller.error(err);
      }
    },
  });

  return { kind: "stream", stream };
}

async function latestStoredFact(userId: string, movie: string): Promise<FactFallback> {
  const last = await db.movie_facts.findFirst({
    where: { user_id: userId, movie },
    orderBy: { created_at: "desc" },
    select: { content: true },
  });
  return last ? { status: "fallback", content: last.content } : { status: "unavailable" };
}

function describeError(err: unknown) {
  if (err instanceof OpenAI.APIError) return `OpenAI ${err.status ?? "?"}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
