import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth-buttons";
import { LogoIcon } from "@/components/icons";
import { getCurrentUser, homePathFor } from "@/lib/session";

const STEPS = [
  { title: "Sign in", body: "Use your Google account. No passwords to remember." },
  { title: "Pick your favorite", body: "Tell us the one movie you'd watch again and again." },
  { title: "Get fun facts", body: "Every visit brings a new bit of trivia about it." },
];

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-20 sm:px-6">
      <div aria-hidden="true" className="marquee-glow pointer-events-none absolute inset-x-0 top-0 h-[28rem]" />

      <div className="relative flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft">
          <LogoIcon className="size-9 text-accent" />
        </span>

        <div className="flex flex-col gap-4">
          <h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Movie Memory
          </h1>
          <p className="mx-auto max-w-md text-lg text-muted">
            Save your favorite movie and discover fun facts about it, one visit at a time.
          </p>
        </div>

        <Suspense fallback={<div className="shimmer h-12 w-56 rounded-full" />}>
          <AuthGate />
        </Suspense>

        <ol className="mt-6 grid w-full gap-3 text-left sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-border bg-surface p-5">
              <span className="font-mono text-xs text-accent">0{i + 1}</span>
              <h2 className="mt-1 font-medium">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

/** Signed-in users are sent on; everyone else sees the sign-in button. */
async function AuthGate() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  return <SignInButton />;
}
