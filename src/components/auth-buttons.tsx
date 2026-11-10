import { signIn, signOut } from "@/auth";
import { GoogleIcon } from "./icons";
import { SubmitButton } from "./submit-button";

export function SignInButton() {
  return (
    <form
      action={async () => {
        "use server";
        // Land back on "/", which routes to /onboarding or /dashboard.
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <SubmitButton
        pendingLabel="Redirecting to Google…"
        className="h-12 rounded-full border border-border bg-surface px-6 font-medium text-foreground shadow-sm hover:bg-surface-muted"
      >
        <GoogleIcon className="size-5" />
        Sign in with Google
      </SubmitButton>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <SubmitButton
        pendingLabel="Logging out…"
        className="h-9 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-surface-muted"
      >
        Log out
      </SubmitButton>
    </form>
  );
}
