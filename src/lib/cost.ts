import db from "@/db";
import { modelPricing } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function computeCost(
  model: string,
  tokensIn: number,
  tokensOut: number
): Promise<number> {
  const pricing = await db
    .select()
    .from(modelPricing)
    .where(eq(modelPricing.model, model))
    .then((r) => r[0]);

  if (!pricing) return 0;
  return (tokensIn / 1000) * pricing.inputPer1k + (tokensOut / 1000) * pricing.outputPer1k;
}
