import { requireIT } from "@/lib/auth-helpers";
import db from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { count, desc, eq } from "drizzle-orm";
import { KBIngestButton } from "@/components/admin/KBIngestButton";
import { KBEditor } from "@/components/admin/KBEditor";

/** Съдържанието на обучението (tree.ts) — отделено от документите, само за ИТ. */
export default async function AdminTreePage() {
  await requireIT();

  const [stats] = await db.select({ count: count() }).from(knowledgeChunks);
  const [treeCount] = await db
    .select({ count: count() })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.source, "tree"));
  const [docCount] = await db
    .select({ count: count() })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.source, "document"));
  const lastChunk = await db
    .select({ updatedAt: knowledgeChunks.updatedAt })
    .from(knowledgeChunks)
    .orderBy(desc(knowledgeChunks.updatedAt))
    .limit(1)
    .then((r) => r[0] ?? null);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="t-heading font-bold">Обучение (tree.ts)</h1>
        <p className="t-body text-muted-foreground">
          Структурираното съдържание на обучението. Достъпно само за ИТ — грешка тук може да счупи приложението.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Статус на индекса</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Общо откъси", value: stats.count },
            { label: "От tree.ts", value: treeCount.count },
            { label: "От документи", value: docCount.count },
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
        <h2 className="t-subheading font-semibold">Реиндексиране</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Какво прави реиндексирането?</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700">
            <li>Чете текущото съдържание от <code className="bg-amber-100 px-1 rounded">tree.ts</code> (включително картите на персонажите)</li>
            <li>Първо генерира нови embedding вектори чрез OpenAI — ако това не успее, старият индекс остава</li>
            <li>Заменя само откъсите от tree.ts; <strong>качените документи не се пипат</strong></li>
          </ul>
          <p className="mt-2 font-medium text-amber-800">Трябва да реиндексираш само след промяна на tree.ts.</p>
        </div>
        <KBIngestButton />
      </div>

      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Съдържание на tree.ts</h2>
        {process.env.VERCEL ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
            <p className="font-semibold">Редакторът не работи на продукция</p>
            <p>
              Файлът е част от компилираното приложение, затова тук не може да се редактира. Променете{" "}
              <code className="bg-amber-100 px-1 rounded">src/content/sales-navigator/tree.ts</code> локално, комитнете и
              внедрете, след което натиснете „Преиндексирай“ по-горе.
            </p>
          </div>
        ) : (
          <>
            <p className="t-small text-muted-foreground">
              Може да го прегледаш и редактираш директно (само при локална работа). След редакция натисни „Запази файла“,
              а след това „Реиндексирай“ — приложението трябва да се презареди, за да чете новото съдържание.
              Предишното съдържание се пази при всяко запазване (последните 10).
            </p>
            <KBEditor />
          </>
        )}
      </div>
    </div>
  );
}
