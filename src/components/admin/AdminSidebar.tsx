"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  BarChart2,
  Bot,
  Database,
  Settings,
  ShieldCheck,
  ScrollText,
  LogOut,
  ArrowLeft,
  DollarSign,
  LineChart,
  Drama,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  itOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Дашборд", href: "/admin", icon: LayoutDashboard },
  { label: "Разговори", href: "/admin/conversations", icon: MessageSquare },
  { label: "Симулации", href: "/admin/simulations", icon: Drama },
  { label: "Потребители", href: "/admin/users", icon: Users },
  { label: "Разходи", href: "/admin/expenses", icon: DollarSign },
  { label: "Анализи", href: "/admin/analytics", icon: LineChart },
  { label: "Репорти", href: "/admin/reports", icon: BarChart2 },
  { label: "Ботове", href: "/admin/bots", icon: Bot, itOnly: true },
  { label: "База знания", href: "/admin/kb", icon: Database, itOnly: true },
  { label: "Конфигурация", href: "/admin/configuration", icon: Settings, itOnly: true },
  { label: "Администратори", href: "/admin/admins", icon: ShieldCheck, itOnly: true },
  { label: "Одит лог", href: "/admin/audit", icon: ScrollText, itOnly: true },
];

export function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const isIT = role === "it";

  const visibleItems = navItems.filter((item) => !item.itOnly || isIT);

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-border flex flex-col z-40">
      {/* Header */}
      <div className="px-4 py-5 border-b border-border">
        <div className="t-body font-bold text-foreground">ADMIN PANEL</div>
        <div className="t-small text-muted-foreground mt-0.5">
          {isIT ? "IT Access" : "Admin Access"}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg t-body transition-colors",
                isActive
                  ? "bg-primary text-white font-medium"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {item.itOnly && (
                <span
                  className={cn(
                    "ml-auto text-[0.65rem] font-semibold leading-none px-1.5 py-0.5 rounded",
                    isActive ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                  )}
                  title="Достъпно само за ИТ роля"
                >
                  ИТ
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg t-body text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Към навигатора
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg t-body text-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Изход
        </button>
      </div>
    </aside>
  );
}
