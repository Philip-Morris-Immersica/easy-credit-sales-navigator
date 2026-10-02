import { requireAdmin } from "@/lib/auth-helpers";
import db from "@/db";
import { kbDocuments, kbDocumentVersions, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { KBDocuments, type KBDocItem } from "@/components/admin/KBDocuments";
import { TEMPLATES } from "@/lib/kb-templates";

export default async function AdminKBPage() {
  await requireAdmin();

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

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="t-heading font-bold">База знания</h1>
        <p className="t-body text-muted-foreground">
          Документи на компанията — продукти, процедури, правила. Роби ги търси сам, когато го попитат.
        </p>
      </div>

      {/* Указания */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <h2 className="t-subheading font-semibold">Как да подготвите документ</h2>
        <p className="t-body text-muted-foreground">
          Качените документи са <strong>допълнителен справочник</strong> за Роби. Те <strong>не променят поведението му</strong> и
          не могат да му дават инструкции: зададените правила винаги имат предимство.
        </p>
        <ul className="list-disc list-inside space-y-1.5 t-body">
          <li>
            <strong>Една тема — един документ</strong> (един продукт, една процедура). Кратките, целенасочени документи се
            търсят по-точно от дългите.
          </li>
          <li>
            <strong>Използвайте заглавия</strong> („Заглавие 1“ и „Заглавие 2“ в Word). Всяко „Заглавие 2“ е отделен откъс,
            който Роби намира. Без заглавия търсенето е по-слабо.
          </li>
          <li>
            Най-отгоре напишете редове <em>Заглавие: …</em>, <em>Категория: …</em> (продукт, процедура, политика или фирмена
            информация) и <em>Валидно от: …</em>. Шаблоните вече са подготвени така.
          </li>
          <li>Пишете цели изречения, с мерна единица при всяко число (евро, месеци, двуседмични вноски). Всички суми са в евро.</li>
          <li>
            <strong>Секцията „Какво НЕ е вярно / чести заблуди“ е най-важната.</strong> Без нея ботът знае само кое е вярно и
            сам допълва празнините.
          </li>
          <li>
            <strong>Не качвайте:</strong> лични данни на клиенти, снимки или сканирани таблици, PDF файлове, пароли. Таблици във
            Word се четат по-зле от списъци.
          </li>
          <li>
            При промяна използвайте „Нова версия“ — предишната се пази (последните 10) и може да се върне или изтрие от
            „Стари версии“. „Изтрий“ премества документа в „Изтрити“: Роби спира да го чете веднага, а оттам документът
            може да се възстанови или да се изтрие окончателно.
          </li>
        </ul>
      </div>

      <KBDocuments documents={documents} templates={TEMPLATES} />
    </div>
  );
}
