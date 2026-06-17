import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { modelPricing } from "@/db/schema";
import { ConfigurationForm } from "@/components/admin/ConfigurationForm";

export default async function AdminConfigurationPage() {
  await requireIT();

  const pricing = await db.select().from(modelPricing).orderBy(modelPricing.model);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="t-heading font-bold">Конфигурация</h1>
        <p className="t-body text-muted-foreground">Ценоразпис на модели и глобални настройки</p>
      </div>

      <ConfigurationForm initialPricing={pricing} />
    </div>
  );
}
