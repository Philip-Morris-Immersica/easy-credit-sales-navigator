"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Home, X } from "lucide-react";
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
  /** Controlled open state (used for top-level accordion items) */
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

function TimelineItem({ node, slugPrefix, depth, onClose, isOpen: controlledOpen, onToggleOpen }: ItemProps) {
  const pathname = usePathname();
  const slugPath = [...slugPrefix, node.slug];
  const href = buildHref(slugPath);
  const active = pathname === href;
  const isAncestor = !active && isActiveOrAncestor(href, pathname);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isControlled = controlledOpen !== undefined;

  const [localOpen, setLocalOpen] = React.useState(isAncestor || active);

  React.useEffect(() => {
    if (!isControlled && (isAncestor || active)) setLocalOpen(true);
  }, [pathname, isAncestor, active, isControlled]);

  const open = isControlled ? controlledOpen : localOpen;

  const handleToggle = () => {
    if (isControlled && onToggleOpen) {
      onToggleOpen();
    } else {
      setLocalOpen((v) => !v);
    }
  };

  const dotClass = cn(
    "absolute top-[0.7rem] rounded-full ring-[3px] ring-[#DAE5ED] transition-colors",
    depth === 0
      ? active
        ? "h-[11px] w-[11px] left-[1px] bg-primary"
        : "h-[9px] w-[9px] left-[2px] bg-[#49575f]"
      : active
        ? "h-[7px] w-[7px] left-[3px] bg-primary"
        : "h-[6px] w-[6px] left-[3px] bg-[#49575f]"
  );

  const labelClass = cn(
    "block leading-snug transition-colors",
    active ? "text-primary" : "text-[#52626F] hover:text-primary"
  );

  const fontSize = depth === 0 ? "1.125rem" : "0.875rem";

  return (
    <li className="relative pl-4">
      <span className={dotClass} aria-hidden />
      {hasChildren ? (
        <>
          <Link
            href={href}
            onClick={onClose}
            aria-current={active ? "page" : undefined}
            className={cn(labelClass, "block py-[0.3rem]")}
            style={{ fontSize }}
          >
            {node.title}
          </Link>
          {open && (
            <ul className="mt-1 flex flex-col gap-0.5 pl-1">
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
          aria-current={active ? "page" : undefined}
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
  const pathname = usePathname();
  const direction = activeConfig.directions.find((d) => d.slug === directionSlug);

  const getActiveSectionId = React.useCallback(() => {
    return (
      direction?.children?.find((child) => {
        const href = buildHref([directionSlug, child.slug]);
        return isActiveOrAncestor(href, pathname);
      })?.id ?? null
    );
  }, [direction, directionSlug, pathname]);

  const [openSectionId, setOpenSectionId] = React.useState<string | null>(getActiveSectionId);
  const navRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const found = getActiveSectionId();
    if (found) setOpenSectionId(found);
  }, [pathname, getActiveSectionId]);

  // Scroll the nav so the open section header is at the top, keeping all items visible
  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    // Wait for the section to expand before measuring
    const timer = setTimeout(() => {
      const activeEl = nav.querySelector<HTMLElement>("a[aria-current='page']");
      if (!activeEl) return;

      // Walk up to find the top-level <li> inside the nav's direct <ul>
      const rootUl = nav.querySelector<HTMLElement>(":scope > ul");
      let sectionLi: HTMLElement | null = activeEl.parentElement;
      while (sectionLi && sectionLi.parentElement !== rootUl) {
        sectionLi = sectionLi.parentElement;
      }
      const scrollTarget = sectionLi ?? activeEl;

      const navRect = nav.getBoundingClientRect();
      const targetRect = scrollTarget.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      const sectionFitsInNav = targetRect.height <= navRect.height;

      if (sectionFitsInNav) {
        // The whole section fits — scroll so the section header is at the top
        const targetIsVisible =
          targetRect.top >= navRect.top && targetRect.bottom <= navRect.bottom;
        if (!targetIsVisible) {
          scrollTarget.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      } else {
        // Section is taller than nav — just ensure the active item is visible
        const activeIsVisible =
          activeRect.top >= navRect.top && activeRect.bottom <= navRect.bottom;
        if (!activeIsVisible) {
          activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="relative h-full">
      {/* Home button */}
      <Link
        href="/"
        onClick={onLinkClick}
        aria-label="Начало"
        className="absolute left-[1.3125rem] top-[1.0625rem] z-10 flex h-[3.375rem] w-[3.375rem] items-center justify-center rounded-xl bg-[#52626F] text-[#D7E2EB] shadow-[3px_4px_6px_0px_#2c363f,-3px_0px_11px_-2px_rgba(215,226,235,0.6)] transition-colors hover:bg-primary hover:text-white"
      >
        <Home className="h-[1.375rem] w-[1.375rem]" />
      </Link>

      {/* Gray panel */}
      <div className="absolute left-[1.3125rem] top-[5.5625rem] bottom-[2.1875rem] flex w-[10.375rem] flex-col overflow-hidden rounded-[1.375rem] bg-[#DAE5ED] shadow-[0px_50px_50px_-25px_rgba(23,23,23,0.4)]">
        {/* Direction tab switcher */}
        <div className="shrink-0 px-[0.6875rem] pt-4 pb-3">
          <div className="flex gap-1 rounded-xl bg-[#c5d3dc] p-[3px]">
            {activeConfig.directions.map((dir) => {
              const isActive = dir.slug === directionSlug;
              const label = dir.slug === "call" ? "ОБАЖДАНЕ" : "СРЕЩА";
              const href = "/" + dir.slug;
              return (
                <Link
                  key={dir.slug}
                  href={href}
                  className={cn(
                    "flex-1 rounded-[0.5rem] py-[0.3rem] text-center text-[0.65rem] font-bold uppercase leading-tight tracking-wide transition-all duration-150",
                    isActive
                      ? "bg-white text-primary shadow-sm"
                      : "text-[#52626F] hover:bg-white/50 hover:text-primary cursor-pointer"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
          <span className="mt-3 block h-px w-full bg-[#aebcc6]" />
        </div>

        {/* Accordion nav */}
        <nav
          ref={navRef}
          className="timeline-scroll min-h-0 flex-1 overflow-y-auto pl-[0.5rem] pr-[0.625rem] pb-2"
        >
          <ul className="flex flex-col gap-1 py-1 pl-0">
            {direction?.children?.map((section) => (
              <TimelineItem
                key={section.id}
                node={section}
                slugPrefix={[directionSlug]}
                depth={0}
                onClose={onLinkClick}
                isOpen={openSectionId === section.id}
                onToggleOpen={() =>
                  setOpenSectionId((id) => (id === section.id ? null : section.id))
                }
              />
            ))}
          </ul>
        </nav>

        {/* EasyCredit logo — centered at the bottom */}
        <div className="shrink-0 flex items-center justify-center pt-3 pb-4">
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
      {/* Mobile top-left controls — menu + home, shown only when the drawer is closed */}
      {!mobileOpen && (
        <div className="fixed top-3 left-3 z-50 flex items-center gap-2 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Отвори менюто"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#52626F] text-white shadow-md transition-colors hover:bg-primary"
          >
            <span className="flex w-4 flex-col items-center justify-center gap-[4px]">
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
            </span>
          </button>
          <Link
            href="/"
            aria-label="Начало"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#52626F] text-white shadow-md transition-colors hover:bg-primary"
          >
            <Home className="h-[1.15rem] w-[1.15rem]" />
          </Link>
        </div>
      )}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}

      {/* Desktop rail */}
      <aside className="sticky top-0 h-screen z-20 hidden w-[12.5rem] shrink-0 md:block">
        <SidebarContents directionSlug={directionSlug} theme={theme} />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[13.75rem] bg-[#52626F] transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button — top-right of the menu */}
        <button
          onClick={closeMobile}
          aria-label="Затвори менюто"
          className="absolute top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-xl bg-[#3f4d57] text-white shadow-md transition-colors hover:bg-primary"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContents directionSlug={directionSlug} theme={theme} onLinkClick={closeMobile} />
      </aside>
    </>
  );
}
