import db from "@/db";
import { auditLog } from "@/db/schema";
import { getAdminApiUser } from "@/lib/auth-helpers";
import { buildUserExport, contentDisposition } from "@/lib/user-export";

export const runtime = "nodejs";

/** Администратор изтегля резултатите на избран потребител (Excel). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAdminApiUser();
  if (!actor) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const result = await buildUserExport(id, {
      name: actor.name ?? null,
      email: actor.email ?? "",
      role: actor.role,
    });
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });

    await db.insert(auditLog).values({
      actorId: actor.id,
      action: "user.export",
      target: id,
      meta: {
        conversations: result.conversationCount,
        analyses: result.analysisCount,
      },
    });

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(result),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[admin/users/export] GET error:", err);
    return Response.json({ error: "Грешка при генериране на файла." }, { status: 500 });
  }
}
