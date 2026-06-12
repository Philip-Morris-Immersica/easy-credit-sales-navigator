"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
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

  // Dot sits centered on the timeline line (line is at left:6px)
  const dotClass = cn(
    "absolute top-[0.7rem] rounded-full ring-[3px] ring-[#DAE5ED] transition-colors",
    active
      ? "h-[11px] w-[11px] left-[1px] bg-primary"
      : isAncestor
        ? "h-[9px] w-[9px] left-[2px] bg-[#52626F]"
        : "h-[9px] w-[9px] left-[2px] bg-[#8a9aa5]"
  );

  const labelClass = cn(
    "block leading-snug transition-colors",
    active ? "text-primary" : "text-[#52626F] hover:text-primary"
  );

  // Figma: top-level items 18px, nested items 16px (in rem so they scale with the slide)
  const fontSize = depth === 0 ? "1.125rem" : "1rem";

  return (
    <li className="relative pl-4">
      <span className={dotClass} aria-hidden />
      {hasChildren ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(labelClass, "w-full cursor-pointer select-none py-[0.3rem] text-left")}
            style={{ fontSize }}
          >
            {node.title}
          </button>
          {open && (
            <ul className="relative mt-1 flex flex-col gap-0.5 pl-2.5">
              <span
                className="absolute top-2 bottom-2 left-[5px] w-px bg-[#aebcc6]"
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
          className={cn(labelClass, "block py-[0.3rem]")}
          style={{ fontSize }}
        >
          {node.title}
        </Link>
      )}
    </li>
  );
}

/** The floating light menu card (home button + panel + logo). Shared by desktop rail and mobile drawer. */
function SidebarContents({
  directionSlug,
  theme,
  onLinkClick,
}: {
  directionSlug: string;
  theme: NavigatorTheme;
  onLinkClick?: () => void;
}) {
  const direction = activeConfig.directions.find((d) => d.slug === directionSlug);

  return (
    <div className="relative h-full">
      {/* Home button — Figma: 54×54 at (21,17), r=12, neumorphic shadow */}
      <Link
        href="/"
        onClick={onLinkClick}
        aria-label="Начало"
        className="absolute left-[1.3125rem] top-[1.0625rem] z-10 flex h-[3.375rem] w-[3.375rem] items-center justify-center rounded-xl bg-[#52626F] text-[#D7E2EB] shadow-[3px_4px_6px_0px_#2c363f,-3px_0px_11px_-2px_rgba(215,226,235,0.6)] transition-colors hover:bg-primary hover:text-white"
      >
        <Home className="h-[1.375rem] w-[1.375rem]" />
      </Link>

      {/* Gray panel — Figma: x21 y89 w166, r=22, big soft shadow; sticks out right past the dark band */}
      <div className="absolute left-[1.3125rem] top-[5.5625rem] bottom-[2.1875rem] flex w-[10.375rem] flex-col overflow-hidden rounded-[1.375rem] bg-[#DAE5ED] shadow-[0px_50px_50px_-25px_rgba(23,23,23,0.4)]">
        {/* Direction label — Figma: 18px regular uppercase, #52626F, inset 15px/20px */}
        {direction && (
          <div className="shrink-0 px-[0.9375rem] pt-5 pb-3">
            <p className="text-[1.125rem] font-normal uppercase leading-[1.3125rem] tracking-wide text-[#52626F]">
              {direction.title}
            </p>
            <span className="mt-3 block h-px w-full bg-[#aebcc6]" />
          </div>
        )}

        {/* Timeline nav */}
        <nav className="timeline-scroll min-h-0 flex-1 overflow-y-auto pl-[0.5rem] pr-[0.625rem] pb-2">
          <ul className="relative flex flex-col gap-1 py-1 pl-0">
            <span className="absolute top-3 bottom-3 left-[0.3125rem] w-px bg-[#aebcc6]" aria-hidden />
            {direction?.children?.map((section) => (
              <TimelineItem
                key={section.id}
                node={section}
                slugPrefix={[directionSlug]}
                depth={0}
                onClose={onLinkClick}
              />
            ))}
          </ul>
        </nav>

        {/* EasyCredit logo — bottom of the panel */}
        <div className="shrink-0 px-[15px] pt-3 pb-4">
          <Image
            src={theme.logoRed}
            alt={theme.name}
            width={96}
            height={20}
            className="h-[1.25rem] w-auto object-contain"
          />
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({ directionSlug, theme }: AppSidebarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? "Затвори менюто" : "Отвори менюто"}
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#52626F] text-white shadow-md md:hidden"
      >
        <span className="flex w-4 flex-col items-center justify-center gap-[4px]">
          <span className={cn("block h-0.5 w-4 bg-current transition-transform duration-200", mobileOpen && "translate-y-[6px] rotate-45")} />
          <span className={cn("block h-0.5 w-4 bg-current transition-opacity duration-200", mobileOpen && "opacity-0")} />
          <span className={cn("block h-0.5 w-4 bg-current transition-transform duration-200", mobileOpen && "-translate-y-[6px] -rotate-45")} />
        </span>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      {/* Desktop rail — scales with the slide; content starts after it. */}
      <aside className="relative z-20 hidden w-[12.5rem] shrink-0 md:block">
        <SidebarContents directionSlug={directionSlug} theme={theme} />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[13.75rem] bg-[#52626F] transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContents directionSlug={directionSlug} theme={theme} onLinkClick={closeMobile} />
      </aside>
    </>
  );
}
