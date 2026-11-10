import Link from "next/link";
import type { ReactNode } from "react";
import { LogoIcon } from "./icons";

/** Top bar with the app logo; `children` render on the right. */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <LogoIcon className="size-6 text-accent" />
          Movie Memory
        </Link>
        {children}
      </div>
    </header>
  );
}
