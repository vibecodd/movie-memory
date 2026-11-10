"use client";

import { useActionState, useState } from "react";
import { saveFavoriteMovie, type OnboardingState } from "./actions";
import { Spinner } from "@/components/icons";
import { MOVIE_TITLE_MAX } from "@/lib/validation";

const initialState: OnboardingState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(saveFavoriteMovie, initialState);
  const [length, setLength] = useState(0);

  // The server is the source of truth for validation; `required`/`maxLength`
  // just save a round trip for the obvious cases.
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="favorite_movie" className="text-sm font-medium">
        Favorite movie
      </label>
      <input
        // Remount after a failed submit so the returned value is shown.
        key={state.value}
        id="favorite_movie"
        name="favorite_movie"
        defaultValue={state.value}
        placeholder="e.g. The Grand Budapest Hotel"
        required
        autoFocus
        autoComplete="off"
        maxLength={MOVIE_TITLE_MAX}
        onChange={(e) => setLength(e.target.value.length)}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={`favorite_movie-hint${state.error ? " favorite_movie-error" : ""}`}
        className="h-12 rounded-xl border border-border bg-background px-4 text-base outline-none transition-shadow placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/20 aria-invalid:border-danger aria-invalid:focus:ring-danger/20"
      />
      <div className="flex items-start justify-between gap-4 text-sm">
        {state.error ? (
          <p id="favorite_movie-error" role="alert" className="text-danger">
            {state.error}
          </p>
        ) : (
          <p id="favorite_movie-hint" className="text-muted">
            You can only set this once.
          </p>
        )}
        <span className="shrink-0 tabular-nums text-muted" aria-hidden="true">
          {length}/{MOVIE_TITLE_MAX}
        </span>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
      >
        {pending && <Spinner className="size-4" />}
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
