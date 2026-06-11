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

  // Dot sits centered on the timeline line (line is at left:6px)
  const dotClass = cn(
    "absolute top-[0.5rem] rounded-full ring-[3px] ring-[#dae5ec] transition-colors",
    active
      ? "h-[11px] w-[11px] left-[1px] bg-primary"
      : isAncestor
        ? "h-[9px] w-[9px] left-[2px] bg-[#52626F]"
        : "h-[9px] w-[9px] left-[2px] bg-[#8a9aa5]"
  );

  const labelClass = cn(
    "block leading-snug transition-colors",
    active ? "text-primary font-semibold" : "text-[#52626F] hover:text-primary",
    depth === 0 ? "font-semibold" : "font-normal"
  );

  // Scales lightly with the slide; 15px/14px floor
  const fontSize = depth === 0 ? "clamp(0.9375rem, 0.95vw, 1.15rem)" : "clamp(0.875rem, 0.85vw, 1.05rem)";

  return (
    <li className="relative pl-5">
      <span className={dotClass} aria-hidden />
      {hasChildren ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(labelClass, "w-full text-left py-[0.3rem] cursor-pointer select-none")}
            style={{ fontSize }}
          >
            {node.title}
          </button>
          {open && (
            <ul className="relative mt-1 flex flex-col gap-0.5 pl-4">
              <span
                className="absolute left-[6px] top-2 bottom-2 w-px bg-[#aebcc6]"
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
        <span className={cn("block h-0.5 w-4 bg-current transition-transform duration-200", openMobile && "translate-y-[6px] rotate-45")} />
        <span className={cn("block h-0.5 w-4 bg-current transition-opacity duration-200", openMobile && "opacity-0")} />
        <span className={cn("block h-0.5 w-4 bg-current transition-transform duration-200", openMobile && "-translate-y-[6px] -rotate-45")} />
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
      <Sidebar variant="sidebar" collapsible="offcanvas" className="border-0">
        {/* Dark charcoal backdrop (forced via globals.css) */}
        <div className="flex h-full flex-col gap-2.5 px-2.5 py-2.5">

          {/* Home button */}
          <Link
            href="/"
            onClick={handleLinkClick}
            aria-label="Начало"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-b from-[#5d6b76] to-[#48555f] text-white shadow-lg ring-1 ring-white/15 hover:from-primary hover:to-primary transition-colors shrink-0"
          >
            <Home className="h-[22px] w-[22px]" />
          </Link>

          {/* Floating light panel */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl bg-[#dae5ec] px-3.5 pt-4 pb-3 shadow-[0_4px_18px_rgba(0,0,0,0.22)]">

            {/* Direction label + red underline */}
            {direction && (
              <div className="pb-3 shrink-0">
                <p
                  className="font-bold uppercase leading-tight tracking-wide text-[#52626F]"
                  style={{ fontSize: "clamp(0.8125rem, 0.85vw, 1rem)" }}
                >
                  {direction.title}
                </p>
                <span className="mt-2 block h-[2.5px] w-full rounded-full bg-primary" />
              </div>
            )}

            {/* Timeline nav */}
            <nav className="timeline-scroll flex-1 min-h-0 overflow-y-auto">
              <ul className="relative flex flex-col gap-1 pl-1 py-1">
                <span
                  className="absolute left-[6px] top-3 bottom-3 w-px bg-[#aebcc6]"
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

            {/* EasyCredit logo */}
            <div className="pt-3 shrink-0">
              <Image src={theme.logoRed} alt={theme.name} width={104} height={29} className="object-contain" />
            </div>
          </div>
        </div>
      </Sidebar>
    </>
  );
}
