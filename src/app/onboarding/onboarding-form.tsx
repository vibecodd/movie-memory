"use client";

import { useActionState } from "react";
import { saveFavoriteMovie, type OnboardingState } from "./actions";
import { MOVIE_TITLE_MAX } from "@/lib/validation";

const initialState: OnboardingState = {};

// Minimal wiring for the onboarding action; styled on the frontend branch.
export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(saveFavoriteMovie, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-2">
      <label htmlFor="favorite_movie">What&apos;s your favorite movie?</label>
      <input
        id="favorite_movie"
        name="favorite_movie"
        defaultValue={state.value}
        maxLength={MOVIE_TITLE_MAX}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "favorite_movie-error" : undefined}
        className="rounded border px-3 py-2"
      />
      {state.error && (
        <p id="favorite_movie-error" role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded border px-3 py-2">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
