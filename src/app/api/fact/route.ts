import { factEvents, type FactEvent } from "@/lib/facts";
import { getCurrentUser } from "@/lib/session";

/**
 * POST /api/fact — fun fact about the signed-in user's favorite movie.
 *
 * Response: application/x-ndjson, one FactEvent per line:
 *   {"type":"delta","text":"..."}*  then  {"type":"fact",...} | {"type":"error",...}
 * Cached/shared/fallback facts arrive as a single "fact" line; a new fact
 * streams as deltas first. See src/lib/facts.ts for the cache + lease logic.
 *
 * Authorization: the user is taken from the session cookie only. The handler
 * reads nothing from the request body or query, so a client cannot ask for
 * another user's facts.
 *
 * POST, not GET: it may call OpenAI and insert a row, so prefetches,
 * crawlers and cached GETs must never trigger it. The session cookie is
 * SameSite=Lax, so other sites can't trigger it with the user's session.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.favorite_movie) return Response.json({ error: "not_onboarded" }, { status: 409 });

  const events = factEvents({ id: user.id, favorite_movie: user.favorite_movie }, request.signal);

  return new Response(toNdjson(events), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Disable proxy buffering (e.g. nginx) so chunks reach the browser immediately.
      "X-Accel-Buffering": "no",
    },
  });
}

function toNdjson(events: AsyncGenerator<FactEvent>) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      } catch (err) {
        controller.error(err);
      }
    },
    // Client disconnected: run the generator's cleanup (lease release).
    async cancel() {
      await events.return(undefined);
    },
  });
}
