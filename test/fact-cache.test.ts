import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { FRIENDLY_ERROR, factEvents } from "@/lib/facts";
import { streamMovieFact } from "@/lib/openai";
import { collect, createUser, fakeStream, leaseOf, outcome, resetDb, seedFact } from "./helpers";

vi.mock("@/lib/openai", () => ({
  FACT_MODEL: "test-model",
  streamMovieFact: vi.fn(),
}));
const openai = vi.mocked(streamMovieFact);

const signal = () => new AbortController().signal;
const asFactUser = (u: { id: string; favorite_movie: string | null }) => ({
  id: u.id,
  favorite_movie: u.favorite_movie!,
});

beforeEach(async () => {
  await resetDb();
  openai.mockReset();
});
afterAll(() => db.$disconnect());

describe("60-second cache window", () => {
  it("returns the cached fact when the latest is less than 60s old (no OpenAI call)", async () => {
    const user = await createUser("Inception");
    await seedFact(user.id, "Inception", 59, "cached fact");

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toMatchObject({ type: "fact", source: "cache", content: "cached fact" });
    expect(openai).not.toHaveBeenCalled();
    expect(await db.movie_facts.count()).toBe(1);
  });

  it("generates, stores and returns a new fact when the latest is older than 60s", async () => {
    const user = await createUser("Inception");
    await seedFact(user.id, "Inception", 61, "stale fact");
    openai.mockResolvedValue(fakeStream(["Fresh ", "fact."]));

    const events = await collect(factEvents(asFactUser(user), signal()));

    expect(events.filter((e) => e.type === "delta").map((e) => e.text)).toEqual(["Fresh ", "fact."]);
    expect(outcome(events)).toMatchObject({ type: "fact", source: "new", content: "Fresh fact." });
    expect(openai).toHaveBeenCalledTimes(1);
    expect(openai).toHaveBeenCalledWith("Inception", expect.any(AbortSignal));

    const stored = await db.movie_facts.findMany({ where: { user_id: user.id }, orderBy: { created_at: "desc" } });
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ content: "Fresh fact.", movie: "Inception", model: "test-model" });
  });

  it("stores new facts with the current time (by the DB clock), so the window starts now", async () => {
    // Regression: Prisma writes DateTime as offset-less UTC text; with a
    // non-UTC DB session time zone, facts landed hours in the future and
    // stayed "fresh" forever. The test DB defaults to America/New_York
    // (see global-setup.ts) so this fails unless db.ts pins sessions to UTC.
    const user = await createUser("Inception");
    openai.mockResolvedValue(fakeStream(["Timed fact."]));

    await collect(factEvents(asFactUser(user), signal()));

    const [{ skew_seconds }] = await db.$queryRaw<{ skew_seconds: number }[]>`
      SELECT abs(extract(epoch FROM (now() - created_at)))::float AS skew_seconds
      FROM movie_facts WHERE user_id = ${user.id}`;
    expect(skew_seconds).toBeLessThan(5);
  });

  it("generates when the user has no facts yet", async () => {
    const user = await createUser("Inception");
    openai.mockResolvedValue(fakeStream(["First fact."]));

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toMatchObject({ source: "new", content: "First fact." });
  });

  it("only caches per movie: a fresh fact about another movie is not reused", async () => {
    const user = await createUser("Inception");
    await seedFact(user.id, "Interstellar", 5, "fact about another movie");
    openai.mockResolvedValue(fakeStream(["Inception fact."]));

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toMatchObject({ source: "new", content: "Inception fact." });
  });

  it("a second request within the window gets the fact the first one stored", async () => {
    const user = await createUser("Inception");
    openai.mockResolvedValue(fakeStream(["Only once."]));

    const first = outcome(await collect(factEvents(asFactUser(user), signal())));
    const second = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(first).toMatchObject({ source: "new", content: "Only once." });
    expect(second).toMatchObject({ source: "cache", content: "Only once." });
    expect(openai).toHaveBeenCalledTimes(1);
  });
});

describe("burst / idempotency protection", () => {
  it("parallel requests (tabs, fast refresh) trigger exactly one generation and share its fact", async () => {
    const user = await createUser("Inception");
    openai.mockImplementation(async () => fakeStream(["Shared fact."], 300));

    const results = await Promise.all(
      Array.from({ length: 5 }, () => collect(factEvents(asFactUser(user), signal())).then(outcome)),
    );

    expect(openai).toHaveBeenCalledTimes(1);
    expect(await db.movie_facts.count({ where: { user_id: user.id } })).toBe(1);
    for (const r of results) expect(r).toMatchObject({ type: "fact", content: "Shared fact." });
    expect(results.filter((r) => r.type === "fact" && r.source === "new")).toHaveLength(1);
    expect(await leaseOf(user.id)).toBeNull();
  });

  it("waits for a generation already in progress instead of starting another", async () => {
    const user = await createUser("Inception");
    // Another request holds the lease...
    await db.$executeRaw`UPDATE users SET fact_generation_started_at = now() WHERE id = ${user.id}`;
    // ...and stores its fact shortly after.
    setTimeout(() => void seedFact(user.id, "Inception", 0, "from the other tab"), 300);

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toMatchObject({ source: "shared", content: "from the other tab" });
    expect(openai).not.toHaveBeenCalled();
  });

  it("falls back if the in-progress generation ends without storing a fact", async () => {
    const user = await createUser("Inception");
    await seedFact(user.id, "Inception", 300, "older fact");
    await db.$executeRaw`UPDATE users SET fact_generation_started_at = now() WHERE id = ${user.id}`;
    // The other request fails and releases its lease. (Prisma queries are
    // lazy: .then() makes it actually run.)
    setTimeout(() => {
      db.users
        .update({ where: { id: user.id }, data: { fact_generation_started_at: null } })
        .then(() => {});
    }, 300);

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toMatchObject({ source: "fallback", content: "older fact" });
    expect(openai).not.toHaveBeenCalled();
  });

  it("reclaims an abandoned lease (older than the lease timeout)", async () => {
    const user = await createUser("Inception");
    await db.$executeRaw`
      UPDATE users SET fact_generation_started_at = now() - interval '5 minutes' WHERE id = ${user.id}`;
    openai.mockResolvedValue(fakeStream(["After crash."]));

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toMatchObject({ source: "new", content: "After crash." });
    expect(await leaseOf(user.id)).toBeNull();
  });

  it("a disconnected client stores nothing and releases the lease", async () => {
    const user = await createUser("Inception");
    const controller = new AbortController();
    // Yields one chunk, then hangs until aborted (like a slow OpenAI stream).
    openai.mockImplementation(async (_movie, sig) =>
      (async function* () {
        yield "partial ";
        await new Promise((_, reject) => {
          if (sig!.aborted) return reject(sig!.reason);
          sig!.addEventListener("abort", () => reject(sig!.reason));
        });
      })(),
    );

    const events = factEvents(asFactUser(user), controller.signal);
    expect(await events.next()).toMatchObject({ value: { type: "delta", text: "partial " } });
    controller.abort();
    await expect(events.next()).rejects.toThrow();

    expect(await db.movie_facts.count()).toBe(0);
    expect(await leaseOf(user.id)).toBeNull();
  });
});

describe("failure handling", () => {
  it("returns the most recent stored fact when OpenAI fails", async () => {
    const user = await createUser("Inception");
    await seedFact(user.id, "Inception", 600, "oldest");
    await seedFact(user.id, "Inception", 120, "most recent");
    openai.mockRejectedValue(new Error("429 rate limited"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toMatchObject({ type: "fact", source: "fallback", content: "most recent" });
    expect(await leaseOf(user.id)).toBeNull();
  });

  it("returns a user-friendly error when OpenAI fails and nothing is stored", async () => {
    const user = await createUser("Inception");
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    openai.mockRejectedValue(timeout);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = outcome(await collect(factEvents(asFactUser(user), signal())));

    expect(result).toEqual({ type: "error", message: FRIENDLY_ERROR });
    expect(await leaseOf(user.id)).toBeNull();
  });

  it("falls back (and stores nothing) when the stream fails midway", async () => {
    const user = await createUser("Inception");
    await seedFact(user.id, "Inception", 120, "previous fact");
    openai.mockResolvedValue(
      (async function* () {
        yield "half a ";
        throw new Error("connection reset");
      })(),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const events = await collect(factEvents(asFactUser(user), signal()));

    expect(events[0]).toEqual({ type: "delta", text: "half a " });
    expect(outcome(events)).toMatchObject({ source: "fallback", content: "previous fact" });
    expect(await db.movie_facts.count()).toBe(1);
  });
});
