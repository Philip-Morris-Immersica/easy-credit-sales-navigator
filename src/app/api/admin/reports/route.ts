import { auth } from "@/auth";
import { generateReportData } from "@/lib/reports";
import { isAdmin } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const data = await generateReportData(body);
  return Response.json(data);
}
