"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import type { NavNode, NavigatorTheme } from "@/components/navigator/types";
import { activeConfig } from "@/content";

interface AppSidebarProps {
  directionSlug: string;
  theme: NavigatorTheme;
}

function buildHref(slugPath: string[]): string {
  return "/" + slugPath.join("/");
}

function isActiveOrAncestor(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

interface ItemProps {
  node: NavNode;
  slugPrefix: string[];
  depth: number;
  onClose?: () => void;
}

function TimelineItem({ node, slugPrefix, depth, onClose }: ItemProps) {
  const pathname = usePathname();
  const slugPath = [...slugPrefix, node.slug];
  const href = buildHref(slugPath);
  const active = pathname === href;
  const isAncestor = !active && isActiveOrAncestor(href, pathname);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const [open, setOpen] = React.useState(isAncestor || active);

  React.useEffect(() => {
    if (isAncestor || active) setOpen(true);
  }, [pathname, isAncestor, active]);

  const dotClass = cn(
    "absolute left-[1px] top-[0.55rem] rounded-full ring-2 ring-[#dbe6ed] transition-colors",
    active
      ? "h-3.5 w-3.5 -left-px bg-primary"
      : isAncestor
        ? "h-3 w-3 bg-[#52626F]"
        : "h-3 w-3 bg-[#8194a1]"
  );

  const labelClass = cn(
    "block leading-snug transition-colors",
    depth === 0 ? "font-semibold" : "font-medium",
    active
      ? "text-primary font-semibold"
      : "text-[#52626F] hover:text-primary"
  );

  return (
    <li className="relative pl-7">
      <span className={dotClass} aria-hidden />
      {hasChildren ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(labelClass, "w-full text-left py-1.5 text-[1rem] cursor-pointer select-none")}
          >
            {node.title}
          </button>
          {open && (
            <ul className="relative mt-1.5 flex flex-col gap-1.5 pl-3">
              <span
                className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-[#9fb1bd]"
                aria-hidden
              />
              {node.children!.map((child) => (
                <TimelineItem
                  key={child.id}
                  node={child}
                  slugPrefix={slugPath}
                  depth={depth + 1}
                  onClose={onClose}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <Link
          href={href}
          onClick={onClose}
          className={cn(labelClass, "block py-1.5 text-[0.95rem]")}
        >
          {node.title}
        </Link>
      )}
    </li>
  );
}

function MobileTriggerButton() {
  const { toggleSidebar, isMobile, openMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <button
      onClick={toggleSidebar}
      aria-label={openMobile ? "Затвори менюто" : "Отвори менюто"}
      className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#52626F] shadow-md text-white md:hidden"
    >
      <span className="flex flex-col gap-[4px] items-center justify-center w-4">
        <span
          className={cn(
            "block h-0.5 w-4 bg-current transition-transform duration-200",
            openMobile && "translate-y-[6px] rotate-45"
          )}
        />
        <span
          className={cn(
            "block h-0.5 w-4 bg-current transition-opacity duration-200",
            openMobile && "opacity-0"
          )}
        />
        <span
          className={cn(
            "block h-0.5 w-4 bg-current transition-transform duration-200",
            openMobile && "-translate-y-[6px] -rotate-45"
          )}
        />
      </span>
    </button>
  );
}

export function AppSidebar({ directionSlug, theme }: AppSidebarProps) {
  const { setOpenMobile, isMobile } = useSidebar();
  const direction = activeConfig.directions.find((d) => d.slug === directionSlug);

  function handleLinkClick() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <>
      <MobileTriggerButton />
      <Sidebar
        variant="sidebar"
        collapsible="offcanvas"
        className="border-0 [&_[data-slot=sidebar-inner]]:bg-gradient-to-b [&_[data-slot=sidebar-inner]]:from-[#404d58] [&_[data-slot=sidebar-inner]]:to-[#55636e]"
      >
        {/* Dark backdrop holds the home button + a floating light panel */}
        <div className="flex h-full flex-col gap-2 px-1.5 pt-2 pb-1.5">
          <Link
            href="/"
            onClick={handleLinkClick}
            aria-label="Начало"
            className="ml-0.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#5d6b76] to-[#4a5862] text-white shadow-lg ring-1 ring-white/15 hover:from-primary hover:to-primary transition-colors"
          >
            <Home className="h-5 w-5" />
          </Link>

          {/* Light floating panel */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl bg-[#dbe6ed] px-4 py-5 shadow-[0_4px_16px_rgba(0,0,0,0.18)]">
            {direction && (
              <div className="pb-4">
                <p className="text-[0.95rem] font-bold uppercase leading-tight tracking-wide text-[#52626F]">
                  {direction.title}
                </p>
                <span className="mt-2 block h-[2.5px] w-full rounded-full bg-primary" />
              </div>
            )}

            {/* Timeline menu */}
            <nav className="flex-1 overflow-y-auto">
              <ul className="relative flex flex-col gap-2 pl-1">
                <span
                  className="absolute left-[7px] top-2 bottom-2 w-[1.5px] bg-[#9fb1bd]"
                  aria-hidden
                />
                {direction?.children?.map((section) => (
                  <TimelineItem
                    key={section.id}
                    node={section}
                    slugPrefix={[directionSlug]}
                    depth={0}
                    onClose={handleLinkClick}
                  />
                ))}
              </ul>
            </nav>

            {/* Bottom logo */}
            <div className="pt-4">
              <Image
                src={theme.logoRed}
                alt={theme.name}
                width={120}
                height={34}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </Sidebar>
    </>
  );
}
