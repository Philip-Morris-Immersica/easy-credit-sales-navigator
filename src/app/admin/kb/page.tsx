import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { KBIngestButton } from "@/components/admin/KBIngestButton";

export default async function AdminKBPage() {
  await requireIT();

  const [stats] = await db.select({ count: count() }).from(knowledgeChunks);
  const [withEmbeddings] = await db
    .select({ count: count() })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.source, "tree"));

  const lastChunk = await db
    .select({ updatedAt: knowledgeChunks.updatedAt })
    .from(knowledgeChunks)
    .orderBy(knowledgeChunks.updatedAt)
    .limit(1)
    .then((r) => r[0] ?? null);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="t-heading font-bold">База знания</h1>
        <p className="t-body text-muted-foreground">Управление на индексирано съдържание</p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Статус</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Общо чанкове", value: stats.count },
            { label: "От tree.ts", value: withEmbeddings.count },
            { label: "Последно обновено", value: lastChunk ? new Date(lastChunk.updatedAt).toLocaleDateString("bg") : "—" },
          ].map((s) => (
            <div key={s.label} className="text-center border border-border rounded-xl p-4">
              <div className="t-heading font-bold">{s.value}</div>
              <div className="t-small text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Индексиране</h2>
        <p className="t-body text-muted-foreground">
          Преиндексирай цялото съдържание от <code className="bg-muted px-1 rounded">tree.ts</code>.
          Изтрива старите чанкове и генерира нови с embedding векторите.
          Изисква конфигуриран <code className="bg-muted px-1 rounded">OPENAI_API_KEY</code>.
        </p>
        <KBIngestButton />
      </div>
    </div>
  );
}
