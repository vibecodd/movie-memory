import { Suspense } from "react";
import Image from "next/image";
import { connection } from "next/server";
import { SignOutButton } from "@/components/auth-buttons";
import { getFactForUser } from "@/lib/facts";
import { requireOnboardedUser } from "@/lib/session";

// Functional but minimally styled; the UI is polished on the frontend branch.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-16">
      <Suspense fallback={<p>Loading…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await requireOnboardedUser();

  return (
    <>
      <header className="flex items-center gap-4">
        {user.image && (
          <Image
            src={user.image}
            alt=""
            width={64}
            height={64}
            className="rounded-full"
          />
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{user.name ?? "Movie fan"}</h1>
          {user.email && (
            <p className="text-zinc-600 dark:text-zinc-400">{user.email}</p>
          )}
        </div>
        <SignOutButton />
      </header>

      <section>
        <h2 className="text-sm uppercase text-zinc-500">Favorite movie</h2>
        <p className="text-xl">{user.favorite_movie}</p>
      </section>

      <section>
        <h2 className="text-sm uppercase text-zinc-500">Fun fact</h2>
        {/* Streams in separately so the OpenAI call doesn't block the page. */}
        <Suspense fallback={<p>Generating a fun fact…</p>}>
          <MovieFact user={user} />
        </Suspense>
      </section>
    </>
  );
}

async function MovieFact({ user }: { user: { id: string; favorite_movie: string } }) {
  // Only generate for a real request, never during prerender or prefetch:
  // each generation costs an OpenAI call and inserts a row.
  await connection();
  const fact = await getFactForUser(user);

  if (fact.status === "unavailable") {
    return <p>Couldn&apos;t generate a fun fact right now. Please try again later.</p>;
  }
  return (
    <>
      <p>{fact.content}</p>
      {fact.status === "fallback" && (
        <p className="text-sm text-zinc-500">
          Showing a previous fact; couldn&apos;t generate a new one right now.
        </p>
      )}
    </>
  );
}
