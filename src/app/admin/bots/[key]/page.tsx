import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { bots, modelPricing } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { BotEditForm } from "@/components/admin/BotEditForm";

export default async function BotDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireIT();
  const { key } = await params;

  const bot = await db
    .select()
    .from(bots)
    .where(eq(bots.key, key))
    .then((r) => r[0]);

  if (!bot) notFound();

  const models = await db.select({ model: modelPricing.model }).from(modelPricing);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/bots" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="t-heading font-bold">{bot.title}</h1>
      </div>
      <BotEditForm bot={bot} availableModels={models.map((m) => m.model)} />
    </div>
  );
}
