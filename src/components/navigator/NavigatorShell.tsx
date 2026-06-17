import * as React from "react";
import { AppSidebar } from "@/components/navigator/AppSidebar";
import { activeConfig } from "@/content";

interface NavigatorShellProps {
  directionSlug: string;
  children: React.ReactNode;
}

export function NavigatorShell({ directionSlug, children }: NavigatorShellProps) {
  const { theme } = activeConfig;

  return (
    <div className="relative flex min-h-screen bg-background">
      {/* Dark slate band behind the left ~half of the menu (Figma: x 0–100). */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-[6.25rem] bg-[#52626F] md:block"
        aria-hidden
      />

      <AppSidebar directionSlug={directionSlug} theme={theme} />

      <main className="relative z-10 min-w-0 flex-1 p-5 pt-14 md:p-8 md:pt-6 md:pr-20">
        {children}
      </main>
    </div>
  );
}
