"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Spinner } from "./icons";

/**
 * Submit button that disables itself and shows a spinner while its parent
 * <form>'s server action is running.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-wait disabled:opacity-70 ${className ?? ""}`}
    >
      {pending ? (
        <>
          <Spinner className="size-4" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
