import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { KBIngestButton } from "@/components/admin/KBIngestButton";
import { KBEditor } from "@/components/admin/KBEditor";

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
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="t-heading font-bold">База знания</h1>
        <p className="t-body text-muted-foreground">Управление на индексирано съдържание</p>
      </div>

      {/* Status */}
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

      {/* Reindex — clearly explained */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Реиндексиране</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Какво прави реиндексирането?</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700">
            <li>Чете текущото съдържание от <code className="bg-amber-100 px-1 rounded">tree.ts</code></li>
            <li>Изтрива старите чанкове от базата данни</li>
            <li>Генерира нови embedding вектори чрез OpenAI (ако е конфигуриран API ключ)</li>
            <li>Записва новите чанкове — консултантският бот ще ги ползва за отговори</li>
          </ul>
          <p className="mt-2 font-medium text-amber-800">Трябва да реиндексираш само след промяна на tree.ts.</p>
        </div>
        <KBIngestButton />
      </div>

      {/* File viewer/editor */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Съдържание на tree.ts</h2>
        <p className="t-small text-muted-foreground">
          Файлът съдържа структурираното съдържание на обучението. Може да го прегледаш и редактираш директно.
          След редакция натисни „Запази файла", а след това „Реиндексирай" за да влязат в сила промените в бота.
        </p>
        <KBEditor />
      </div>
    </div>
  );
}
