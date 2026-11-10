"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshIcon, SparkleIcon, Spinner } from "@/components/icons";
import type { FactFallback } from "@/lib/facts";
import { FactLoader } from "./fact-loader";

type Phase =
  | { kind: "loading" }
  | { kind: "streaming"; text: string }
  | { kind: "done"; text: string }
  | { kind: "fallback"; text: string }
  | { kind: "interrupted"; text: string }
  | { kind: "unavailable" }
  | { kind: "redirect"; to: string };

/**
 * Request a new fact from POST /api/fact and report progress via `onPhase`
 * as the text streams in. Aborting `signal` cancels it (the server then
 * skips saving the fact) and suppresses further updates.
 */
async function streamFact(signal: AbortSignal, onPhase: (phase: Phase) => void) {
  let text = "";
  try {
    const res = await fetch("/api/fact", { method: "POST", signal });
    if (res.status === 401) return onPhase({ kind: "redirect", to: "/" });
    if (res.status === 409) return onPhase({ kind: "redirect", to: "/onboarding" });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    // JSON means generation couldn't start; show a stored fact if any.
    if (res.headers.get("content-type")?.includes("application/json")) {
      const body = (await res.json()) as FactFallback;
      return onPhase(
        body.status === "fallback" ? { kind: "fallback", text: body.content } : { kind: "unavailable" },
      );
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += value;
      onPhase({ kind: "streaming", text });
    }
    onPhase({ kind: "done", text: text.trim() });
  } catch {
    if (signal.aborted) return;
    onPhase(text ? { kind: "interrupted", text } : { kind: "unavailable" });
  }
}

/** Fun-fact card: streams a new fact on mount and on "Another fact". */
export function FactCard() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // Bumped by "Another fact" to start a new generation.
  const [run, setRun] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    void streamFact(controller.signal, (next) => {
      if (!controller.signal.aborted) setPhase(next);
    });
    return () => controller.abort();
  }, [run]);

  useEffect(() => {
    if (phase.kind === "redirect") router.replace(phase.to);
  }, [phase, router]);

  const busy = phase.kind === "loading" || phase.kind === "streaming";

  return (
    <section className="rounded-3xl border border-accent/30 bg-accent-soft/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent">
          <SparkleIcon className="size-4" />
          Fun fact
        </h2>
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            setPhase({ kind: "loading" });
            setRun((n) => n + 1);
          }}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? <Spinner className="size-4" /> : <RefreshIcon className="size-4" />}
          {busy ? "Finding a fact…" : "Another fact"}
        </button>
      </div>

      <div className="mt-4" aria-live="polite" aria-busy={busy}>
        {(phase.kind === "loading" || phase.kind === "redirect") && <FactLoader />}

        {phase.kind === "unavailable" && (
          <p className="text-muted">
            Couldn&apos;t generate a fun fact right now. Please try again in a moment.
          </p>
        )}

        {"text" in phase && (
          <>
            <p className="text-lg leading-relaxed">
              {phase.text}
              {phase.kind === "streaming" && <span className="caret" aria-hidden="true" />}
            </p>
            {phase.kind === "fallback" && (
              <p className="mt-3 text-sm text-muted">
                Showing a previous fact; couldn&apos;t generate a new one right now.
              </p>
            )}
            {phase.kind === "interrupted" && (
              <p className="mt-3 text-sm text-muted">
                The fact got cut off. Try &ldquo;Another fact&rdquo;.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
