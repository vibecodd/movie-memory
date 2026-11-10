"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshIcon, SparkleIcon, Spinner } from "@/components/icons";
import type { FactEvent, FactSource } from "@/lib/facts";
import { FactLoader } from "./fact-loader";

/** Mirrors CACHE_WINDOW_SECONDS on the server (lib/facts.ts). */
const CACHE_WINDOW_MS = 60_000;
const FRIENDLY_ERROR = "Couldn't generate a fun fact right now. Please try again in a moment.";

type Phase =
  | { kind: "loading" }
  | { kind: "streaming"; text: string }
  | { kind: "fact"; text: string; source: FactSource; createdAt: number; receivedAt: number }
  | { kind: "error"; message: string }
  | { kind: "redirect"; to: string };

/**
 * Request a fact from POST /api/fact and report progress via `onPhase` while
 * the NDJSON event stream arrives. Aborting `signal` cancels it (the server
 * then stores nothing and releases its lock).
 */
async function streamFact(signal: AbortSignal, onPhase: (phase: Phase) => void) {
  let text = "";
  let finished = false;
  const handle = (event: FactEvent) => {
    if (event.type === "delta") {
      text += event.text;
      onPhase({ kind: "streaming", text });
    } else if (event.type === "fact") {
      finished = true;
      onPhase({
        kind: "fact",
        text: event.content,
        source: event.source,
        createdAt: Date.parse(event.created_at),
        receivedAt: Date.now(),
      });
    } else {
      finished = true;
      onPhase({ kind: "error", message: event.message });
    }
  };

  try {
    const res = await fetch("/api/fact", { method: "POST", signal });
    if (res.status === 401) return onPhase({ kind: "redirect", to: "/" });
    if (res.status === 409) return onPhase({ kind: "redirect", to: "/onboarding" });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) handle(JSON.parse(line) as FactEvent);
    }
    if (!finished) throw new Error("stream ended early");
  } catch {
    if (signal.aborted) return;
    onPhase({ kind: "error", message: FRIENDLY_ERROR });
  }
}

/**
 * Seconds until a new fact can be generated (0 = now). Ticks every second;
 * `receivedAt` keeps the first render after a fact arrives from using a
 * stale clock.
 */
function useCooldown(fact: { createdAt: number; receivedAt: number } | null) {
  const [now, setNow] = useState(() => Date.now());
  const createdAt = fact?.createdAt ?? null;
  useEffect(() => {
    if (createdAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [createdAt]);
  if (!fact) return 0;
  const current = Math.max(now, fact.receivedAt);
  return Math.max(0, Math.ceil((fact.createdAt + CACHE_WINDOW_MS - current) / 1000));
}

const SOURCE_NOTE: Partial<Record<FactSource, string>> = {
  fallback: "Showing a previous fact; couldn't generate a new one right now.",
};

/** Fun-fact card: streams a fact on mount and on "Another fact". */
export function FactCard() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  // Bumped by "Another fact" to start a new request.
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

  // Facts are cached server-side for 60s; a fallback fact doesn't block retries.
  const cooldown = useCooldown(phase.kind === "fact" && phase.source !== "fallback" ? phase : null);
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
          disabled={busy || cooldown > 0}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium tabular-nums text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Spinner className="size-4" /> : <RefreshIcon className="size-4" />}
          {busy ? "Finding a fact…" : cooldown > 0 ? `New fact in ${cooldown}s` : "Another fact"}
        </button>
      </div>

      <div className="mt-4" aria-live="polite" aria-busy={busy}>
        {(phase.kind === "loading" || phase.kind === "redirect") && <FactLoader />}

        {phase.kind === "error" && <p className="text-muted">{phase.message}</p>}

        {(phase.kind === "streaming" || phase.kind === "fact") && (
          <>
            <p className="text-lg leading-relaxed">
              {phase.text}
              {phase.kind === "streaming" && <span className="caret" aria-hidden="true" />}
            </p>
            {phase.kind === "fact" && SOURCE_NOTE[phase.source] && (
              <p className="mt-3 text-sm text-muted">{SOURCE_NOTE[phase.source]}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
