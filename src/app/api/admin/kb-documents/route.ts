import { getAdminApiUser } from "@/lib/auth-helpers";
import {
  KbError,
  createDocument,
  normalizeCategory,
  parseUploadedFile,
  replaceDocument,
} from "@/lib/kb-documents";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Качване на документ (multipart/form-data):
 *   file        — .docx | .md | .txt (задължително)
 *   title       — по избор (иначе от метаданните или от името на файла)
 *   category    — продукт | процедура | политика | фирмена информация
 *   documentId  — ако е зададено, файлът е НОВА ВЕРСИЯ на този документ
 */
export async function POST(req: Request) {
  const user = await getAdminApiUser();
  if (!user) return Response.json({ error: "Нужен е достъп на администратор." }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new KbError("Липсва файл.");

    const parsed = await parseUploadedFile(file.name, Buffer.from(await file.arrayBuffer()));

    const documentId = String(form.get("documentId") ?? "").trim();
    const titleInput = String(form.get("title") ?? "").trim();
    const title =
      titleInput || parsed.meta.title || file.name.replace(/\.[^.]+$/, "").trim();
    const categoryRaw = String(form.get("category") ?? "").trim();
    const category = normalizeCategory(categoryRaw) ?? normalizeCategory(parsed.meta.category);

    if (documentId) {
      const { doc, chunks } = await replaceDocument(documentId, {
        title: titleInput || parsed.meta.title || "",
        category: category ?? undefined,
        fileName: file.name,
        mimeType: file.type,
        parsed,
        actorId: user.id,
      });
      return Response.json({ success: true, id: doc.id, version: doc.version, chunks });
    }

    if (!title) throw new KbError("Въведете заглавие.");
    if (!category) {
      throw new KbError("Изберете категория: продукт, процедура, политика или фирмена информация.");
    }
    const { doc, chunks } = await createDocument({
      title,
      category,
      fileName: file.name,
      mimeType: file.type,
      parsed,
      actorId: user.id,
    });
    return Response.json({ success: true, id: doc.id, version: doc.version, chunks });
  } catch (e) {
    if (e instanceof KbError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
