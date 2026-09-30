import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { eq, asc } from "drizzle-orm";
import db from "@/db";
import { conversations, messages, bots, analyses } from "@/db/schema";
import { computeCost } from "@/lib/cost";
import { salesNavigatorConfig } from "@/content/index";
import type { PersonaData } from "@/components/navigator/types";

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

ОБРЪЩЕНИЕ „ВИЕ" / „ТИ" МЕЖДУ КОНСУЛТАНТА И КЛИЕНТА (задължително отчитай при оценката; не го бъркай с обръщението на теб към консултанта, което е винаги на „ти"):
- Ако по-горе има раздел „ДАННИ ЗА КЛИЕНТА", оценявай обръщението на консултанта КЪМ КЛИЕНТА спрямо полето „Очаквано обръщение" на този конкретен персонаж, а не по общо правило.
- Когато „Очаквано обръщение" сочи установеното между двамата (лоялен/познат клиент, с когото си говорят на „ти"), „ти" НЕ е пропуск — не го отбелязвай като грешка и не сваляй оценка заради него.
- Когато клиентът държи на „Вие" и дистанция, спазването на „Вие" е изискване на персонажа, а не заслуга на консултанта; преминаването на „ти" е пропуск.
- Ако няма данни за клиента: при НОВ или непознат клиент консултантът трябва да се обръща на „Вие", докато клиентът сам не предложи „ти"; при познати клиенти „ти" е приемливо.
- Нарушение на обръщението отбелязвай САМО ако можеш да посочиш конкретната реплика на консултанта, в която се е случило (виж „ТОЧНОСТ НА ТВЪРДЕНИЯТА"). Реално нарушение отбележи в „improvements" и отрази по критерий „Установяване на контакт".

ДЪЛБОЧИНА НА РАЗГОВОРА СПРЯМО ОТНОШЕНИЕТО С КЛИЕНТА:
- При НОВ клиент се очаква пълно преминаване през идентификация на нуждите.
- При лоялен, познат или VIP клиент консултантът вече знае много за клиента. Пълното разпитване от нулата не се изисква и липсата му НЕ се наказва. Оценявай дали е използвал вече известното и е уточнил само променилото се и онова, което изрично изисква „Целта" в данните за клиента.
- „Целта", „Очакваната следваща стъпка" и списъкът „Какво консултантът НЕ бива да прави" на конкретния персонаж имат предимство пред общите правила по-горе.

ТОЧНОСТ НА ТВЪРДЕНИЯТА (най-важното правило за целия анализ):
- Всяко твърдение за това какво консултантът е направил или казал — в силните страни, в подобренията и в коментарите по критериите — трябва да стъпва на реална реплика „Консултант:" от разговора. Вплитай реалната реплика естествено в изречението, например: „Пропусна да уточниш срока — каза «...». Опитай вместо това: «...»." или „Добре започна — «...»."
- Цитирай само дословен текст, който наистина е в разговора. Не измисляй и не перифразирай реплики, представяни като цитат.
- Ако не можеш да посочиш реплика, НЕ твърдиш, че нещо се е случило. Това важи и за твърдения като „премина на ти", „обеща одобрение", „натисна клиента". По-добре по-малко наблюдения, но верни.
- Твърдение за пропуск („не попита за...", „не предложи...") правиш само след като си прегледал целия разговор и това наистина липсва; тогава посочи в кой момент е било мястото му и предложи готова реплика.
- Списъкът „Какво консултантът НЕ бива да прави" е само контролен списък. Не приписвай на консултанта точка от него, ако няма реплика, която я показва. Липсата на нарушение не е пропуск и не се споменава като такъв.
- Това правило не е причина анализът да е кратък. Анализът остава пълен и практичен: наблюдения, конкретни примери от самия разговор, готови по-добри реплики и практични препоръки. Не използвай в текста думи като „доказателство" или „цитат" — репликите се вплитат естествено.

КРИТЕРИЙ „ПРОДАЖБЕН РЕЗУЛТАТ" (шестият критерий, задължителен във всеки анализ):
- Мери доколко разговорът реално е придвижил клиента към конкретна следваща стъпка (кандидатстване, уговорена среща или обаждане, ясно решение) — а не дали е бил приятен или процесно правилен.
- За разлика от „Затваряне на сделката" (как е проведен финалът), тук оценяваш крайния резултат: къде е клиентът в края спрямо началото.
- Реалистичната следваща стъпка е тази от „Очаквана следваща стъпка" в данните за клиента. Когато тя е по-лека стъпка или клиентът не бива да се притиска, уговорена по-лека стъпка е добър резултат, а натискът за незабавно кандидатстване — не.
- В коментара посочи какво конкретно е липсвало, за да е по-близо разговорът до продажба, и предложи готова реплика.
- Общата оценка „overallScore" отразява всичките шест критерия.
`;

/** Намира картата на персонажа за даден бот (botKey) в учебното дърво. */
let personaIndex: Map<string, PersonaData> | null = null;
function findPersonaByBotKey(botKey: string): PersonaData | undefined {
  if (!personaIndex) {
    const index = new Map<string, PersonaData>();
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const n = node as { type?: string; botKey?: string; persona?: PersonaData };
      if (n.type === "actions" && n.botKey && n.persona) index.set(n.botKey, n.persona);
      for (const v of Object.values(node)) walk(v);
    };
    walk(salesNavigatorConfig);
    personaIndex = index;
  }
  return personaIndex.get(botKey);
}

/** Реалните данни за клиента, подавани на анализа (вместо перифраза в analysisPrompt). */
function buildPersonaBlock(p: PersonaData): string {
  return `ДАННИ ЗА КЛИЕНТА (от картата на персонажа, която консултантът е видял преди разговора — това е истината за клиента; оценявай спрямо нея):
- Име: ${p.name}
- Тип контакт: ${p.contactType}
- Отношение: ${p.relationship}
- Очаквано обръщение: ${p.addressForm}
- Цел на разговора: ${p.goal}
- Очаквана следваща стъпка: ${p.nextStep}
- Какво консултантът НЕ бива да прави (контролен списък — вж. „ТОЧНОСТ НА ТВЪРДЕНИЯТА"): ${p.doNotDo}`;
}

/** Системният промпт на анализа: analysisPrompt на бота + реалните данни за клиента + рамката. */
export function buildAnalysisSystemPrompt(
  botKey: string,
  analysisPrompt: string,
  incomplete = false
): string {
  const persona = findPersonaByBotKey(botKey);
  const personaBlock = persona ? `\n\n${buildPersonaBlock(persona)}` : "";
  return `${analysisPrompt}${personaBlock}\n\n${TRAINING_FRAMEWORK}${
    incomplete ? `\n${INCOMPLETE_NOTE}` : ""
  }`;
}

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

  const system = buildAnalysisSystemPrompt(bot.key, bot.analysisPrompt, !!opts.incomplete);

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
