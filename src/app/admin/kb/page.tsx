import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { kbDocuments, kbDocumentVersions, knowledgeChunks, users } from "@/db/schema";
import { count, desc, eq } from "drizzle-orm";
import { KBIngestButton } from "@/components/admin/KBIngestButton";
import { KBEditor } from "@/components/admin/KBEditor";
import {
  KBDocuments,
  type KBDocItem,
} from "@/components/admin/KBDocuments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";

const TEMPLATES = [
  { file: "shablon-produkt.docx", label: "Шаблон: продукт" },
  { file: "shablon-procedura.docx", label: "Шаблон: процедура" },
  { file: "shablon-chzv.docx", label: "Шаблон: ЧЗВ / правила / фирмена информация" },
  { file: "primer-izi-maks.docx", label: "Попълнен пример (Изи Макс)" },
];

export default async function AdminKBPage() {
  const user = await requireAdmin();
  const isIT = user.role === "it";

  // Документи + версии
  const docRows = await db
    .select({
      id: kbDocuments.id,
      title: kbDocuments.title,
      category: kbDocuments.category,
      fileName: kbDocuments.fileName,
      version: kbDocuments.version,
      status: kbDocuments.status,
      updatedAt: kbDocuments.updatedAt,
      uploadedByName: users.name,
    })
    .from(kbDocuments)
    .leftJoin(users, eq(kbDocuments.uploadedBy, users.id))
    .orderBy(desc(kbDocuments.updatedAt));

  const versionRows = await db
    .select({
      id: kbDocumentVersions.id,
      documentId: kbDocumentVersions.documentId,
      version: kbDocumentVersions.version,
      changedAt: kbDocumentVersions.changedAt,
      reason: kbDocumentVersions.reason,
      changedByName: users.name,
    })
    .from(kbDocumentVersions)
    .leftJoin(users, eq(kbDocumentVersions.changedBy, users.id))
    .orderBy(desc(kbDocumentVersions.changedAt));

  const documents: KBDocItem[] = docRows.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    fileName: d.fileName,
    version: d.version,
    status: d.status,
    uploadedByName: d.uploadedByName,
    updatedAt: d.updatedAt.toISOString(),
    versions: versionRows
      .filter((v) => v.documentId === d.id)
      .map((v) => ({
        id: v.id,
        version: v.version,
        changedAt: v.changedAt.toISOString(),
        changedByName: v.changedByName,
        reason: v.reason,
      })),
  }));

  // Статистика за дървото (само ИТ)
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
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="t-heading font-bold">База знания</h1>
        <p className="t-body text-muted-foreground">
          Документи на компанията и индексирано съдържание на обучението
        </p>
      </div>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Документи</TabsTrigger>
          {isIT && <TabsTrigger value="tree">Обучение (tree.ts)</TabsTrigger>}
        </TabsList>

        <TabsContent value="documents" className="space-y-6 pt-4">
          {/* Указания */}
          <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
            <h2 className="t-subheading font-semibold">Как да подготвите документ</h2>
            <p className="t-body text-muted-foreground">
              Качените документи са <strong>допълнителен справочник</strong> за Роби — той ги търси сам, когато го попитат
              за продукт, процедура или правило на компанията. Те <strong>не променят поведението му</strong> и не могат да
              му дават инструкции: зададените правила винаги имат предимство.
            </p>
            <ul className="list-disc list-inside space-y-1.5 t-body">
              <li>
                <strong>Една тема — един документ</strong> (един продукт, една процедура). Кратките, целенасочени документи
                се търсят по-точно от дългите.
              </li>
              <li>
                <strong>Използвайте заглавия</strong> („Заглавие 1“ и „Заглавие 2“ в Word). Всяко „Заглавие 2“ е отделен
                откъс, който Роби намира и цитира. Без заглавия търсенето е по-слабо.
              </li>
              <li>
                Най-отгоре напишете редове <em>Заглавие: …</em>, <em>Категория: …</em> (продукт, процедура, политика или
                фирмена информация) и <em>Валидно от: …</em>. Шаблоните вече са подготвени така.
              </li>
              <li>
                Пишете цели изречения, с мерна единица при всяко число (евро, месеци, двуседмични вноски). Всички суми са в
                евро.
              </li>
              <li>
                <strong>Секцията „Какво НЕ е вярно / чести заблуди“ е най-важната.</strong> Без нея ботът знае само кое е
                вярно и сам допълва празнините.
              </li>
              <li>
                <strong>Не качвайте:</strong> лични данни на клиенти, снимки или сканирани таблици, PDF файлове, пароли и
                вътрешни достъпи. Таблици във Word се четат по-зле от списъци.
              </li>
              <li>
                При нова версия на документ използвайте „Нова версия“ — предишната се пази (последните 10) и може да се върне.
                „Архивирай“ не трие текста — документът може да бъде възстановен.
              </li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {TEMPLATES.map((t) => (
                <a
                  key={t.file}
                  href={`/templates/${t.file}`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 t-small hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t.label}
                </a>
              ))}
            </div>
          </div>

          <KBDocuments documents={documents} />
        </TabsContent>

        {isIT && (
          <TabsContent value="tree" className="space-y-6 pt-4">
            <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
              <h2 className="t-subheading font-semibold">Статус</h2>
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
              <p className="t-small text-muted-foreground">
                Файлът съдържа структурираното съдържание на обучението. Може да го прегледаш и редактираш директно.
                След редакция натисни „Запази файла“, а след това „Реиндексирай“ за да влязат в сила промените в бота.
                Предишното съдържание се пази при всяко запазване.
              </p>
              <KBEditor />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
