import { auth } from "@/auth";
import db from "@/db";
import { auditLog } from "@/db/schema";
import { isUserActive } from "@/lib/auth-helpers";
import { buildUserExport, contentDisposition } from "@/lib/user-export";

export const runtime = "nodejs";

/**
 * Изтегляне на собствените резултати (Excel). Идентификаторът идва САМО от
 * сесията — никога от параметър — така че потребителят получава само своите данни.
 */
export async function GET() {
  const session = await auth();
  const me = session?.user;
  if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isUserActive(me.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await buildUserExport(me.id, {
      name: me.name ?? null,
      email: me.email ?? "",
      role: me.role,
    });
    if (!result) return Response.json({ error: "Not found" }, { status: 404 });

    await db.insert(auditLog).values({
      actorId: me.id,
      action: "user.export",
      target: me.id,
      meta: {
        self: true,
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
    console.error("[me/export] GET error:", err);
    return Response.json({ error: "Грешка при генериране на файла." }, { status: 500 });
  }
}
