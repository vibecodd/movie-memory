import { startFactStream } from "@/lib/facts";
import { getCurrentUser } from "@/lib/session";

/**
 * POST /api/fact — generate a fun fact about the signed-in user's favorite
 * movie and stream it back as plain text (stored when complete).
 *
 * POST, not GET: it has side effects (OpenAI cost + DB insert), so it must
 * never run from a prefetch, crawler or cached GET. The session cookie is
 * SameSite=Lax, so other sites can't trigger it with the user's session.
 *
 * Responses:
 * - 200 text/plain: the fact, streamed
 * - 200 application/json: FactFallback when generation couldn't start
 * - 401 not signed in, 409 not onboarded
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.favorite_movie) return Response.json({ error: "not_onboarded" }, { status: 409 });

  const result = await startFactStream(
    { id: user.id, favorite_movie: user.favorite_movie },
    request.signal,
  );

  if (result.kind === "fallback") {
    return Response.json(result.body, { headers: { "Cache-Control": "no-store" } });
  }
  return new Response(result.stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Disable proxy buffering (e.g. nginx) so chunks reach the browser immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
