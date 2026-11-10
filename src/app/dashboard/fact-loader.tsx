"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Rewinding the tape…",
  "Asking the projectionist…",
  "Checking the director's cut…",
  "Reading the end credits…",
  "Digging through the outtakes…",
  "Interviewing the stunt doubles…",
];

// Frame tints (repeated twice so the strip can loop seamlessly).
const TINTS = [60, 35, 75, 45, 25, 65, 40, 70];
const FRAMES = [...TINTS, ...TINTS, ...TINTS, ...TINTS];

/** Fun-fact loader: a rolling film strip, rotating messages and shimmer lines. */
export function FactLoader() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-4" role="status">
      <div className="film-strip" aria-hidden="true">
        <div className="film-frames">
          {FRAMES.map((tint, i) => (
            <span
              key={i}
              className="film-frame"
              style={{ "--tint": `${tint}%` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
      <p key={index} className="fade-up text-sm font-medium text-accent">
        {MESSAGES[index]}
      </p>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="shimmer h-4 w-full rounded-full" />
        <div className="shimmer h-4 w-10/12 rounded-full" />
      </div>
    </div>
  );
}
