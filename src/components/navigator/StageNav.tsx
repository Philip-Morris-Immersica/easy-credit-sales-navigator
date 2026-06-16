"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavNode } from "@/components/navigator/types";

interface StageNavProps {
  /** All sibling stage nodes */
  stages: NavNode[];
  /** Base href of the parent stages node, e.g. "/call/steps" */
  parentHref: string;
}

export function StageNav({ stages, parentHref }: StageNavProps) {
  const pathname = usePathname();

  return (
    <nav className="mb-7">
      {/* Desktop: "1. Отваряне" style tabs */}
      <div className="hidden sm:flex justify-start flex-wrap gap-2">
        {stages.map((stage, idx) => {
          const href = `${parentHref}/${stage.slug}`;
          const isActive = pathname === href;
          return (
            <Link
              key={stage.id}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-card text-foreground/70 hover:border-primary/40 hover:text-foreground"
              )}
            >
              <span className={cn("font-bold tabular-nums", isActive ? "text-white/80" : "text-primary/70")}>
                {idx + 1}.
              </span>
              {stage.title}
            </Link>
          );
        })}
      </div>

      {/* Mobile: compact "Етап N" tabs */}
      <div className="flex sm:hidden justify-start flex-wrap gap-2">
        {stages.map((stage, idx) => {
          const href = `${parentHref}/${stage.slug}`;
          const isActive = pathname === href;
          return (
            <Link
              key={stage.id}
              href={href}
              className={cn(
                "inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                isActive
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-border bg-card text-foreground/70 hover:border-primary/40"
              )}
            >
              Етап {idx + 1}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
