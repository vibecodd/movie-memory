import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/fact/route";
import { db } from "@/lib/db";
import type { FactEvent } from "@/lib/facts";
import { streamMovieFact } from "@/lib/openai";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { createUser, fakeStream, resetDb, seedFact } from "./helpers";

vi.mock("@/lib/openai", () => ({
  FACT_MODEL: "test-model",
  streamMovieFact: vi.fn(),
}));
// The session is the only source of identity; tests choose who is signed in.
vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));

const openai = vi.mocked(streamMovieFact);
const session = vi.mocked(getCurrentUser);

function signInAs(user: CurrentUser | null) {
  session.mockResolvedValue(user);
}

async function readEvents(res: Response): Promise<FactEvent[]> {
  return (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FactEvent);
}

/** POST /api/fact, optionally trying to smuggle in another user's id. */
function requestFact(tamperUserId?: string) {
  const url = new URL("http://localhost/api/fact");
  if (tamperUserId) url.searchParams.set("userId", tamperUserId);
  return POST(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: tamperUserId ? JSON.stringify({ userId: tamperUserId, user_id: tamperUserId }) : undefined,
    }),
  );
}

beforeEach(async () => {
  await resetDb();
  openai.mockReset();
  session.mockReset();
});
afterAll(() => db.$disconnect());

describe("authorization: POST /api/fact", () => {
  it("rejects unauthenticated requests with 401 and never touches OpenAI", async () => {
    signInAs(null);

    const res = await requestFact();

    expect(res.status).toBe(401);
    expect(openai).not.toHaveBeenCalled();
  });

  it("rejects users who have not onboarded with 409", async () => {
    const user = await createUser(null);
    signInAs(user);

    const res = await requestFact();

    expect(res.status).toBe(409);
  });

  it("ignores a user id in the query/body: always serves the session user's fact", async () => {
    const alice = await createUser("Inception");
    const bob = await createUser("Inception");
    await seedFact(alice.id, "Inception", 10, "alice's fact");
    await seedFact(bob.id, "Inception", 5, "bob's fact");
    signInAs(alice);

    const events = await readEvents(await requestFact(bob.id));

    expect(events.at(-1)).toMatchObject({ type: "fact", source: "cache", content: "alice's fact" });
    expect(JSON.stringify(events)).not.toContain("bob's fact");
  });

  it("never serves another user's cached fact, even for the same movie", async () => {
    const alice = await createUser("Inception");
    const bob = await createUser("Inception");
    await seedFact(bob.id, "Inception", 5, "bob's fresh fact");
    signInAs(alice);
    openai.mockResolvedValue(fakeStream(["alice's own fact"]));

    const events = await readEvents(await requestFact());

    expect(events.at(-1)).toMatchObject({ source: "new", content: "alice's own fact" });
    const stored = await db.movie_facts.findFirstOrThrow({ where: { content: "alice's own fact" } });
    expect(stored.user_id).toBe(alice.id);
    expect(await db.movie_facts.count({ where: { user_id: bob.id } })).toBe(1);
  });

  it("never falls back to another user's fact when OpenAI fails", async () => {
    const alice = await createUser("Inception");
    const bob = await createUser("Inception");
    await seedFact(bob.id, "Inception", 120, "bob's old fact");
    signInAs(alice);
    openai.mockRejectedValue(new Error("OpenAI down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const events = await readEvents(await requestFact());

    expect(events.at(-1)).toMatchObject({ type: "error" });
    expect(JSON.stringify(events)).not.toContain("bob's old fact");
  });

  it("one user's generation lease does not block another user", async () => {
    const alice = await createUser("Inception");
    const bob = await createUser("Inception");
    await db.$executeRaw`UPDATE users SET fact_generation_started_at = now() WHERE id = ${bob.id}`;
    signInAs(alice);
    openai.mockResolvedValue(fakeStream(["not blocked"]));

    const events = await readEvents(await requestFact());

    expect(events.at(-1)).toMatchObject({ source: "new", content: "not blocked" });
  });
});
