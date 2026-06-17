import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { bots } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, Settings } from "lucide-react";

export default async function AdminBotsPage() {
  await requireIT();

  const rows = await db.select().from(bots).orderBy(bots.kind, bots.title);

  const simBots = rows.filter((b) => b.kind === "simulation");
  const consultants = rows.filter((b) => b.kind === "consultant");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="t-heading font-bold">Ботове</h1>
        <p className="t-body text-muted-foreground">Управление на промптове и настройки</p>
      </div>

      {/* Consultant bots */}
      <section className="space-y-3">
        <h2 className="t-subheading font-semibold">Консултант</h2>
        {consultants.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </section>

      {/* Simulation bots */}
      <section className="space-y-3">
        <h2 className="t-subheading font-semibold">Симулации</h2>
        {simBots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </section>
    </div>
  );
}

function BotCard({ bot }: { bot: { key: string; title: string; kind: string; model: string; enabled: boolean; direction?: string | null } }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-medium t-body">{bot.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="t-small text-muted-foreground">{bot.model}</span>
            {!bot.enabled && (
              <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">Изключен</Badge>
            )}
            {bot.direction && (
              <Badge variant="secondary" className="text-xs">
                {bot.direction === "call" ? "Обаждане" : "Среща"}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Link
        href={`/admin/bots/${bot.key}`}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
      >
        <Settings className="h-3.5 w-3.5" />
        Настройки
      </Link>
    </div>
  );
}
