import { getAdminApiUser } from "@/lib/auth-helpers";
import { getDocument } from "@/lib/kb-documents";
import db from "@/db";
import { kbDocumentVersions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Изтегля извлечения текст като .md (оригиналният файл не се пази — пази се текстът,
 * който ботът реално чете). `?versionId=` изтегля по-стара версия.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminApiUser();
  if (!user) return Response.json({ error: "Нужен е достъп на администратор." }, { status: 403 });

  const { id } = await params;
  const versionId = new URL(req.url).searchParams.get("versionId");

  let title: string;
  let rawText: string;
  let version: number;
  if (versionId) {
    const v = await db
      .select()
      .from(kbDocumentVersions)
      .where(and(eq(kbDocumentVersions.id, versionId), eq(kbDocumentVersions.documentId, id)))
      .then((r) => r[0]);
    if (!v) return Response.json({ error: "Версията не е намерена." }, { status: 404 });
    ({ title, rawText, version } = v);
  } else {
    const doc = await getDocument(id);
    if (!doc) return Response.json({ error: "Документът не е намерен." }, { status: 404 });
    ({ title, rawText, version } = doc);
  }

  const safe = title.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60) || "dokument";
  const fileName = `${safe}_v${version}.md`;
  return new Response(rawText, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="document.md"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
