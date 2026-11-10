import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth-buttons";
import { requireUser } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

// Functional but unstyled; the UI is built on the frontend branch.
// Saving is handled by ./actions.ts (first-time only, server-validated).
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
      <OnboardingForm />
      <SignOutButton />
    </>
  );
}
