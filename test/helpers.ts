import { db } from "@/lib/db";
import type { FactEvent } from "@/lib/facts";
import { assertTestDatabase } from "./global-setup";

let seq = 0;

/** Empty the test database. Refuses to touch anything not named *_test. */
export async function resetDb() {
  assertTestDatabase(process.env.DATABASE_URL!);
  await db.$executeRawUnsafe("TRUNCATE movie_facts, users CASCADE");
}

export async function createUser(favorite_movie: string | null = "Inception") {
  seq += 1;
  return db.users.create({
    data: {
      google_id: `google-${seq}-${Date.now()}`,
      name: `User ${seq}`,
      email: `user${seq}@example.com`,
      favorite_movie,
    },
  });
}

/** Insert a fact that is `ageSeconds` old (by the DB clock). */
export async function seedFact(userId: string, movie: string, ageSeconds: number, content: string) {
  await db.$executeRaw`
    INSERT INTO movie_facts (id, user_id, movie, content, model, created_at)
    VALUES (${`seed-${++seq}`}, ${userId}, ${movie}, ${content}, 'seed',
            now() - make_interval(secs => ${ageSeconds}::int))`;
}

export async function leaseOf(userId: string) {
  const user = await db.users.findUniqueOrThrow({ where: { id: userId } });
  return user.fact_generation_started_at;
}

export async function collect(events: AsyncIterable<FactEvent>) {
  const out: FactEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

/** The final fact/error event of a stream. */
export function outcome(events: FactEvent[]) {
  const last = events.at(-1);
  if (!last || last.type === "delta") throw new Error("stream did not finish");
  return last;
}

/** Fake OpenAI text stream: yields `chunks`, optionally after a delay. */
export function fakeStream(chunks: string[], delayMs = 0): AsyncIterable<string> {
  return (async function* () {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    for (const chunk of chunks) yield chunk;
  })();
}
