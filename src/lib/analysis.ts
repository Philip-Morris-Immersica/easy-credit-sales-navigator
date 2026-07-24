import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { eq, asc } from "drizzle-orm";
import db from "@/db";
import { conversations, messages, bots, analyses } from "@/db/schema";
import { computeCost } from "@/lib/cost";

export const TRAINING_FRAMEWORK = `
РАМКА НА ОБУЧЕНИЕТО (EasyCredit Sales Navigator):

СТЪПКИ В РАЗГОВОРА:
1. Отваряне — Представи се, установи контакт, изгради доверие
2. Представяне на целта — Ясно обясни причината за контакта и ползата за клиента
3. Идентификация на нуждите — Задавай въпроси, слушай активно, разбери ситуацията
4. Представяне на продукта — Свържи характеристиките директно с нуждите на клиента
5. Справяне с възражения — Прояви разбиране → отговори с полза → потвърди → премини
6. Затваряне — Предложи конкретна следваща стъпка и я потвърди с клиента

ТЕХНИКИ ЗА СПРАВЯНЕ С ВЪЗРАЖЕНИЯ:
- Огледална: Отразяваш притеснението на клиента, за да покажеш, че си го разбрал напълно
- Алтернативна: Предлагаш различна гледна точка или решение на притеснението
- Относителна: Поставяш притеснението в перспектива чрез сравнение или контекст
- Тирбушон: Задаваш серия от насочени въпроси, за да разкриеш истинското притеснение зад възражението

ОБЩА ЛОГИКА ЗА СПРАВЯНЕ С ВЪЗРАЖЕНИЯ:
1. Прояви разбиране (не спори директно)
2. Отговори с конкретна полза за клиента
3. Потвърди, че отговорът е бил удовлетворителен
4. Премини към следваща стъпка или затваряне

ПРИНЦИПИ НА ЕФЕКТИВНИЯ КОНСУЛТАНТ:
- Използвай името на клиента
- Говори конкретно — избягвай общи фрази
- Уважавай времето на клиента
- Не натискай — води разговора естествено към следваща стъпка
- Всеки разговор трябва да завърши с ясна следваща стъпка

ОБРЪЩЕНИЕ „ВИЕ" / „ТИ" (задължително отчитай при оценката):
- При НОВ или непознат клиент консултантът трябва да се обръща на „Вие", докато клиентът сам не предложи или изрично разреши преминаване на „ти".
- При лоялни/познати клиенти, или когато самият клиент премине на „ти", използването на „ти" е приемливо.
- Ако консултантът премине на „ти" с нов/непознат клиент, без клиентът да е дал позволение, това е пропуск: отбележи го изрично в „improvements" и го отрази в оценката по критерий „Установяване на контакт".
`;

const INCOMPLETE_NOTE = `
ВАЖНО — НЕЗАВЪРШЕН РАЗГОВОР: Този разговор е бил прекъснат и НЕ е завършен от консултанта (сесията е изоставена, без явно приключване). Затова:
- Не занижавай оценката за етапи, до които разговорът просто не е стигнал заради прекъсването — оценявай само реално осъщественото до момента на прекъсването.
- В „summary" изрично отбележи, че разговорът е останал незавършен, и посочи коя е била логичната следваща стъпка, която липсва.
- В „improvements" може да включиш „доведи разговора до ясно затваряне", ако това е било пропуснато.
`;

export type AnalysisResult =
  | {
      ok: true;
      analysis: typeof analyses.$inferSelect;
      cost?: number;
      alreadyExisted?: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * Generates (or returns the existing) analysis for a simulation conversation.
 * Ownership/auth is the caller's responsibility. Marks the conversation
 * "completed" on success. Optionally enforces a minimum number of consultant
 * turns and adds an "incomplete conversation" instruction to the prompt.
 */
export async function generateAnalysisForConversation(
  conversationId: string,
  opts: { incomplete?: boolean; minUserTurns?: number } = {}
): Promise<AnalysisResult> {
  const conv = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .then((r) => r[0]);

  if (!conv) return { ok: false, status: 404, error: "Not found" };
  if (conv.kind !== "simulation") {
    return { ok: false, status: 400, error: "Analysis only available for simulations" };
  }

  // Return the existing analysis if already generated.
  const existing = await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(eq(analyses.conversationId, conversationId))
    .then((r) => r[0]);

  if (existing) {
    const full = await db
      .select()
      .from(analyses)
      .where(eq(analyses.id, existing.id))
      .then((r) => r[0]);
    return { ok: true, analysis: full, alreadyExisted: true };
  }

  const bot = await db
    .select()
    .from(bots)
    .where(eq(bots.id, conv.botId))
    .then((r) => r[0]);

  if (!bot?.analysisPrompt) {
    return { ok: false, status: 400, error: "No analysis prompt configured" };
  }

  const msgs = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  const userTurns = msgs.filter((m) => m.role === "user").length;
  if (opts.minUserTurns != null && userTurns < opts.minUserTurns) {
    return {
      ok: false,
      status: 400,
      error: `Разговорът е твърде кратък за анализ (нужни са поне ${opts.minUserTurns} реплики).`,
    };
  }

  const transcript = msgs
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "Консултант" : "Клиент"}: ${m.content}`)
    .join("\n");

  // Mark conversation as completed
  await db
    .update(conversations)
    .set({ status: "completed" })
    .where(eq(conversations.id, conversationId));

  const analysisModel = bot.analysisModel ?? "gpt-4.1-mini";
  const analysisTemperature = bot.analysisTemperature ?? 0.3;
  const analysisMaxTokens = bot.analysisMaxTokens ?? 1500;

  const system = `${bot.analysisPrompt}\n\n${TRAINING_FRAMEWORK}${
    opts.incomplete ? `\n${INCOMPLETE_NOTE}` : ""
  }`;

  const { text, usage } = await generateText({
    model: openai(analysisModel),
    system,
    prompt: `Разговор:\n${transcript}`,
    temperature: analysisTemperature,
    maxOutputTokens: analysisMaxTokens,
  });

  const cost = await computeCost(
    analysisModel,
    usage?.inputTokens ?? 0,
    usage?.outputTokens ?? 0
  );

  let parsed: Record<string, unknown> = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    parsed = { summary: text };
  }

  const [analysis] = await db
    .insert(analyses)
    .values({
      conversationId,
      botId: bot.id,
      overallScore: (parsed.overallScore as number) ?? null,
      criteria: (parsed.criteria as object) ?? null,
      strengths: (parsed.strengths as string[]) ?? [],
      improvements: (parsed.improvements as string[]) ?? [],
      summary: (parsed.summary as string) ?? null,
      rawJson: parsed,
      model: analysisModel,
    })
    .returning();

  return { ok: true, analysis, cost };
}
