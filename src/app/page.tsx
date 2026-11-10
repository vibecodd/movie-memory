import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth-buttons";
import { getCurrentUser, homePathFor } from "@/lib/session";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Movie Memory</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Save your favorite movie and get fun facts about it.
        </p>
      </div>
      <Suspense fallback={<div className="h-12" />}>
        <AuthGate />
      </Suspense>
    </main>
  );
}

/** Signed-in users are sent on; everyone else sees the sign-in button. */
async function AuthGate() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  return <SignInButton />;
}
