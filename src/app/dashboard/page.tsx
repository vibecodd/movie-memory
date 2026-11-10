import { Suspense } from "react";
import { SignOutButton } from "@/components/auth-buttons";
import { requireOnboardedUser } from "@/lib/session";

// Placeholder: auth routing only. The real dashboard is built on the
// frontend/backend branches.
export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
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
      <h1 className="text-2xl font-semibold">Signed in as {user.email}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Dashboard coming soon.</p>
      <SignOutButton />
    </>
  );
}
