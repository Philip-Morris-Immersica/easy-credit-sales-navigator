import "dotenv/config";
import { streamText, generateText, tool, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { getModelCallOptions } from "../src/lib/model-params";
import { computeCost } from "../src/lib/cost";

/**
 * Т8.3б: проверка на същия кодов път като в продукцията (getModelCallOptions +
 * streamText за чата / generateText за анализа) за всеки модел.
 * НЕ създава и не променя ботове; не записва нищо в базата (само чете цените).
 *
 *   npx tsx scripts/verify-models.ts [model1 model2 ...]
 */

const MODELS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["gpt-4.1", "gpt-5.4", "gpt-5.4-mini", "gpt-6-sol", "gpt-6-luna"];

const BOT_TEMPERATURE = 0.7; // както по подразбиране в bots
const BOT_MAX_TOKENS = 2000;
const ANALYSIS_TEMPERATURE = 0.3;
const ANALYSIS_MAX_TOKENS = 1500;

const PERSONA = `Ти играеш ролята на Петър, 45-годишен клиент на магазин за мебели, който се колебае дали да вземе мебели на изплащане. Говориш на „Вие“, кратко и естествено, на български. Имаш възражение: „Не искам да се задлъжнявам.“ Отговаряй само с една-две реплики.`;

const ANALYSIS_SYSTEM = `Анализираш разговор между консултант и клиент. Върни САМО валиден JSON на безупречен български: {"overallScore": число 1-10, "criteria": [{"name": string, "score": число 1-10, "comment": string}], "strengths": [string], "improvements": [string], "summary": string}.`;
const TRANSCRIPT = `Разговор:
Консултант: Добър ден, казвам се Мария от Изи Кредит. Може ли минута за Вас?
Клиент: Добър ден, да, но не искам да се задлъжнявам.
Консултант: Разбирам Ви напълно. Затова предлагаме изплащане без лихва за 6 месеца. Какво търсите?
Клиент: Диван, около 1200 лева.
Консултант: Вноската ще е 200 лева на месец. Подходящо ли е?`;

type Row = {
  model: string;
  test: string;
  ok: boolean;
  ttft?: number;
  total?: number;
  tokensIn?: number;
  tokensOut?: number;
  reasoning?: number;
  cost?: number;
  warnings?: string;
  note?: string;
};
const rows: Row[] = [];

function warn(w: unknown[] | undefined) {
  return (w ?? []).map((x) => JSON.stringify(x)).join("; ") || "-";
}

async function chat(model: string, withTools: boolean) {
  const test = withTools ? "чат+инструмент (Роби)" : "чат (клиент)";
  const t0 = Date.now();
  try {
    const opts = getModelCallOptions(model, "chat", BOT_TEMPERATURE, BOT_MAX_TOKENS);
    const result = streamText({
      model: openai(model),
      system: withTools
        ? "Ти си Роби, помощник на консултантите. За въпрос за фирмени документи ВИНАГИ първо извикай инструмента searchCompanyKnowledge, после отговори накратко на български."
        : PERSONA,
      messages: [
        {
          role: "user",
          content: withTools
            ? "Какво пише в наръчника за възвръщаемост на стоки?"
            : "Добър ден, ние предлагаме изплащане без лихва за 6 месеца. Интересува ли Ви?",
        },
      ],
      ...opts,
      ...(withTools
        ? {
            tools: {
              searchCompanyKnowledge: tool({
                description: "Търси във фирмените документи.",
                inputSchema: z.object({ query: z.string() }),
                execute: async () => ({ results: ["Стоки се връщат до 14 дни с касова бележка."] }),
              }),
            },
            stopWhen: stepCountIs(3),
          }
        : {}),
    });
    let ttft: number | undefined;
    let text = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        if (ttft === undefined) ttft = Date.now() - t0;
        text += part.text;
      }
      if (part.type === "error") throw part.error;
    }
    const usage = await result.totalUsage;
    const warnings = await result.warnings;
    const cost = await computeCost(model, usage.inputTokens ?? 0, usage.outputTokens ?? 0);
    rows.push({
      model,
      test,
      ok: text.length > 0,
      ttft,
      total: Date.now() - t0,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      reasoning: usage.outputTokenDetails?.reasoningTokens,
      cost,
      warnings: warn(warnings),
      note: text.replace(/\s+/g, " ").slice(0, 110),
    });
  } catch (e) {
    rows.push({ model, test, ok: false, note: String((e as Error).message ?? e).slice(0, 200) });
  }
}

async function analysis(model: string) {
  const test = "анализ (JSON)";
  const t0 = Date.now();
  try {
    const opts = getModelCallOptions(model, "analysis", ANALYSIS_TEMPERATURE, ANALYSIS_MAX_TOKENS);
    // Същият кодов път като в analysis.ts: generateText + извличане на JSON с regex.
    const { text, usage, warnings, finishReason } = await generateText({
      model: openai(model),
      system: ANALYSIS_SYSTEM,
      prompt: TRANSCRIPT,
      ...opts,
    });
    let parsedOk = false;
    const m = text.match(/\{[\s\S]*\}/);
    try {
      parsedOk = !!m && typeof JSON.parse(m[0]).overallScore === "number";
    } catch {
      parsedOk = false;
    }
    const cost = await computeCost(model, usage.inputTokens ?? 0, usage.outputTokens ?? 0);
    rows.push({
      model,
      test,
      ok: parsedOk,
      total: Date.now() - t0,
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      reasoning: usage.outputTokenDetails?.reasoningTokens,
      cost,
      warnings: warn(warnings),
      note: `finish=${finishReason}; JSON ${parsedOk ? "валиден" : "НЕВАЛИДЕН"}`,
    });
  } catch (e) {
    rows.push({ model, test, ok: false, note: String((e as Error).message ?? e).slice(0, 200) });
  }
}

async function main() {
  for (const model of MODELS) {
    console.log(`... ${model}`);
    await chat(model, false);
    await chat(model, true);
    await analysis(model);
  }
  console.log("\n");
  for (const r of rows) {
    console.log(
      [
        r.model.padEnd(13),
        r.test.padEnd(22),
        r.ok ? "OK  " : "FAIL",
        `ttft=${r.ttft ?? "-"}ms`,
        `total=${r.total ?? "-"}ms`,
        `in=${r.tokensIn ?? "-"}`,
        `out=${r.tokensOut ?? "-"}`,
        `reason=${r.reasoning ?? "-"}`,
        `cost=$${r.cost?.toFixed(6) ?? "-"}`,
        `warn=${r.warnings ?? "-"}`,
        `| ${r.note ?? ""}`,
      ].join("  ")
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
