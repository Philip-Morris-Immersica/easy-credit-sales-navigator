"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Monitor, User, LogOut, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

export function TopRightNav() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className={cn(
          "fixed top-4 right-4 z-50",
          "flex items-center justify-center h-9 w-9 rounded-full",
          "bg-[#DAE5ED] text-[#52626F] shadow-[3px_4px_6px_0px_rgba(90,122,150,0.35),-3px_0px_11px_-2px_rgba(255,255,255,0.85)]",
          "hover:bg-primary hover:text-white transition-colors"
        )}
        title="Вход"
      >
        <User className="h-4 w-4" />
      </Link>
    );
  }

  const role = session.user.role;
  const isAdminOrIT = role === "admin" || role === "it";
  const displayName = session.user.name ?? session.user.email ?? "Профил";

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Профил"
        aria-label="Профил"
        aria-expanded={open}
        className={cn(
          "flex items-center justify-center h-9 w-9 rounded-full",
          "bg-[#DAE5ED] text-[#52626F] shadow-[3px_4px_6px_0px_rgba(90,122,150,0.35),-3px_0px_11px_-2px_rgba(255,255,255,0.85)]",
          "hover:bg-primary hover:text-white transition-colors",
          open && "bg-primary text-white"
        )}
      >
        <User className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-52 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1">
          <div className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">
            {displayName}
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />

          <Link
            href="/me"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            Разговори
          </Link>

          {isAdminOrIT && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Monitor className="h-4 w-4 shrink-0" />
              Админ панел
            </Link>
          )}

          <div className="-mx-1 my-1 h-px bg-border" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/login" });
            }}
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-destructive cursor-pointer hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Изход
          </button>
        </div>
      )}
    </div>
  );
}
