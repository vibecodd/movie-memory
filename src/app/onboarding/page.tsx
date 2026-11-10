import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SignOutButton } from "@/components/auth-buttons";
import { requireUser } from "@/lib/session";
import { OnboardingForm } from "./onboarding-form";

// Saving is handled by ./actions.ts (first-time only, server-validated).
export default function OnboardingPage() {
  return (
    <>
      <AppHeader>
        <SignOutButton />
      </AppHeader>
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <Suspense fallback={<CardSkeleton />}>
          <Onboarding />
        </Suspense>
      </main>
    </>
  );
}

async function Onboarding() {
  const user = await requireUser();
  if (user.favorite_movie) redirect("/dashboard");

  const firstName = user.name?.split(" ")[0];

  return (
    <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">One quick question</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">
        Welcome{firstName ? `, ${firstName}` : ""}!
      </h1>
      <p className="mt-2 text-muted">
        Tell us your favorite movie and we&apos;ll dig up fun facts about it.
      </p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex w-full max-w-md flex-col gap-3 rounded-3xl border border-border bg-surface p-8"
    >
      <div className="shimmer h-3 w-32 rounded-full" />
      <div className="shimmer h-8 w-48 rounded-full" />
      <div className="shimmer h-4 w-full rounded-full" />
      <div className="shimmer mt-4 h-12 w-full rounded-xl" />
      <div className="shimmer mt-2 h-12 w-full rounded-xl" />
    </div>
  );
}
