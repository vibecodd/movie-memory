import { Suspense } from "react";
import Image from "next/image";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/auth-buttons";
import { requireOnboardedUser, type CurrentUser } from "@/lib/session";
import { FactCard } from "./fact-card";

export default function DashboardPage() {
  return (
    <>
      <AppHeader>
        <SignOutButton />
      </AppHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <Suspense fallback={<DashboardSkeleton />}>
          <Dashboard />
        </Suspense>
      </main>
    </>
  );
}

async function Dashboard() {
  const user = await requireOnboardedUser();

  return (
    <>
      <section className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-6">
        <Avatar user={user} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold">
            {user.name ?? "Movie fan"}
          </h1>
          {user.email && <p className="truncate text-muted">{user.email}</p>}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Favorite movie</p>
        <p className="mt-2 break-words font-display text-3xl font-semibold sm:text-4xl">
          {user.favorite_movie}
        </p>
      </section>

      {/* Streams the fact from POST /api/fact on the client. */}
      <FactCard />
    </>
  );
}

function Avatar({ user }: { user: CurrentUser }) {
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={64}
        height={64}
        className="size-16 shrink-0 rounded-full border border-border"
      />
    );
  }
  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-2xl font-semibold text-accent">
      {initial}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading dashboard">
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-6">
        <div className="shimmer size-16 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="shimmer h-6 w-40 rounded-full" />
          <div className="shimmer h-4 w-56 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-6">
        <div className="shimmer h-3 w-28 rounded-full" />
        <div className="shimmer h-9 w-2/3 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 rounded-3xl border border-accent/30 bg-accent-soft/60 p-6">
        <div className="shimmer h-3 w-24 rounded-full" />
        <div className="shimmer h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}
