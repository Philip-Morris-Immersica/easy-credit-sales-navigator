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

  const CORE_MODELS = [
    "gpt-4.1-mini",
    "gpt-4.1",
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-nano",
    "o4-mini",
  ];
  const dbModels = models.map((m) => m.model);
  const availableModels = [...new Set([...CORE_MODELS, ...dbModels])];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/bots" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="t-heading font-bold">{bot.title}</h1>
      </div>
      <BotEditForm bot={bot} availableModels={availableModels} />
    </div>
  );
}
