import { auth } from "@/auth";
import db from "@/db";
import { modelPricing } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "it") {
    return Response.json({ error: "IT access required" }, { status: 403 });
  }

  const { pricing } = await req.json();

  for (const p of pricing) {
    const existing = await db
      .select({ model: modelPricing.model })
      .from(modelPricing)
      .where(eq(modelPricing.model, p.model))
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(modelPricing)
        .set({ inputPer1k: p.inputPer1k, outputPer1k: p.outputPer1k })
        .where(eq(modelPricing.model, p.model));
    } else {
      await db.insert(modelPricing).values(p);
    }
  }

  return Response.json({ success: true });
}
