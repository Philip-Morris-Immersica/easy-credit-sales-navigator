"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Monitor, User, LogOut, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const triggerClasses = cn(
  "fixed top-4 right-4 z-50",
  "flex items-center justify-center h-9 w-9 rounded-full",
  "bg-white/90 backdrop-blur border border-border shadow-sm",
  "hover:bg-primary hover:text-white hover:border-primary transition-colors",
  "data-[popup-open]:bg-primary data-[popup-open]:text-white data-[popup-open]:border-primary"
);

export function TopRightNav() {
  const { data: session } = useSession();

  if (!session?.user) {
    return (
      <Link href="/login" className={triggerClasses} title="Вход">
        <User className="h-4 w-4" />
      </Link>
    );
  }

  const role = session.user.role;
  const isAdminOrIT = role === "admin" || role === "it";
  const statsHref = isAdminOrIT ? "/admin" : "/me";
  const statsLabel = isAdminOrIT ? "Админ" : "Разговори";
  const StatsIcon = isAdminOrIT ? Monitor : MessageSquare;
  const displayName = session.user.name ?? session.user.email ?? "Профил";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClasses} title="Профил" aria-label="Профил">
        <User className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-52">
        <div className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">
          {displayName}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          render={<Link href={statsHref} />}
        >
          <StatsIcon className="h-4 w-4" />
          {statsLabel}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={() => {
            void signOut({ callbackUrl: "/login" });
          }}
        >
          <LogOut className="h-4 w-4" />
          Изход
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
