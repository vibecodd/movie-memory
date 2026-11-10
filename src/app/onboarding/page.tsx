import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth-buttons";
import { requireUser } from "@/lib/session";

// Placeholder: auth routing only. The favorite-movie form is built on the
// frontend/backend branches.
//
// TODO(backend): make the save-movie server action first-time only, even when
// the user has this form open on two devices. Re-check the session inside the
// action (requireUser), then use a conditional update:
//   db.users.updateMany({ where: { id, favorite_movie: null }, data: { favorite_movie } })
// If count === 0 the user already onboarded elsewhere -> redirect("/dashboard")
// instead of overwriting their movie.
export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <Suspense fallback={<p>Loading…</p>}>
        <Onboarding />
      </Suspense>
    </main>
  );
}

async function Onboarding() {
  const user = await requireUser();
  if (user.favorite_movie) redirect("/dashboard");

  return (
    <>
      <h1 className="text-2xl font-semibold">Welcome, {user.name ?? "there"}!</h1>
      <p className="text-zinc-600 dark:text-zinc-400">Onboarding form coming soon.</p>
      <SignOutButton />
    </>
  );
}
