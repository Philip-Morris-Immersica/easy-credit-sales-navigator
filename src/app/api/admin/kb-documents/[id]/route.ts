import { getAdminApiUser } from "@/lib/auth-helpers";
import {
  KbError,
  archiveDocument,
  restoreDocumentVersion,
  unarchiveDocument,
} from "@/lib/kb-documents";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Действия върху документ: { action: "archive" | "unarchive" | "restore", versionId? } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminApiUser();
  if (!user) return Response.json({ error: "Нужен е достъп на администратор." }, { status: 403 });

  const { id } = await params;
  try {
    const body = await req.json();
    switch (body?.action) {
      case "archive":
        await archiveDocument(id, user.id);
        break;
      case "unarchive":
        await unarchiveDocument(id, user.id);
        break;
      case "restore":
        if (typeof body.versionId !== "string") throw new KbError("Липсва версия.");
        await restoreDocumentVersion(id, body.versionId, user.id);
        break;
      default:
        throw new KbError("Непознато действие.");
    }
    return Response.json({ success: true });
  } catch (e) {
    if (e instanceof KbError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
