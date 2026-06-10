import * as React from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigator/AppSidebar";
import { activeConfig } from "@/content";

interface NavigatorShellProps {
  directionSlug: string;
  children: React.ReactNode;
}

export function NavigatorShell({ directionSlug, children }: NavigatorShellProps) {
  const { theme } = activeConfig;

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
    >
      <AppSidebar directionSlug={directionSlug} theme={theme} />
      <SidebarInset className="flex flex-col min-h-screen">
        {/* Content area — padded on mobile to account for hamburger */}
        <main className="flex-1 p-5 md:p-8 md:pt-6 pt-14">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
