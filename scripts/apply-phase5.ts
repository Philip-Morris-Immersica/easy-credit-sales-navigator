import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

// ─── New analysis prompt template (addresses the trainee in "ти") ──────────────
function buildAnalysisPrompt(scenarioFocus: string): string {
  return `Ти си треньор по продажбени умения в EasyCredit. Анализирай следния разговор между консултант (обучаващия се) и симулиран клиент.

ФОКУС НА СЦЕНАРИЯ: ${scenarioFocus}

ВАЖНО ЗА ТОНА: Обръщай се директно към консултанта на „ти" (второ лице, единствено число) — както треньор говори на своя стажант. Например: „Установи добър контакт в началото…", „Пропусна да попиташ за нуждите на клиента…", „Следващия път опитай да…". Не пиши в трето лице („консултантът направи…"). Бъди конкретен, подкрепящ и градивен — първо признай доброто, после посочи какво да подобриш.

Върни САМО валиден JSON в следния формат (без markdown, без обяснения). Всички коментари, силни страни, подобрения и обобщението пиши на „ти":
{
  "overallScore": <число 1-10>,
  "criteria": [
    { "name": "Установяване на контакт", "score": <1-10>, "comment": "<кратък коментар на „ти">" },
    { "name": "Идентификация на нуждите", "score": <1-10>, "comment": "<кратък коментар на „ти">" },
    { "name": "Представяне на продукт", "score": <1-10>, "comment": "<кратък коментар на „ти">" },
    { "name": "Справяне с възражения", "score": <1-10>, "comment": "<кратък коментар на „ти">" },
    { "name": "Затваряне на сделката", "score": <1-10>, "comment": "<кратък коментар на „ти">" }
  ],
  "strengths": ["<сила 1, на „ти">", "<сила 2, на „ти">"],
  "improvements": ["<подобрение 1, на „ти">", "<подобрение 2, на „ти">"],
  "summary": "<2-3 изречения обобщение, на „ти">"
}`;
}

// ─── New consultant (Robi) values ─────────────────────────────────────────────
const ROBI_TITLE = "Роби — Обучителен асистент";
const ROBI_SYSTEM_PROMPT = `Ти си Роби — личен обучителен асистент и наставник в обучението на EasyCredit. (Обучаващите се са кредитните консултанти — ти не си „консултант", а техен обучителен помощник.) Не си ограничен до една тема — помагаш на кредитните консултанти да се ориентират в цялото обучение, да разберат съдържанието и подходите и да ги прилагат на практика.

КАКВО ПРАВИШ:
- Ориентираш: обясняваш какво къде се намира в обучението и кое следва логично.
- Помагаш със съдържанието и подходите: изясняваш концепции и етапи на разбираем език.
- Помагаш с приложението: показваш как да се приложи наученото и даваш конкретни примери.
- Обсъждаш симулациите: ако потребителят е правил симулации, анализирате ги заедно — какво се е получило, какво не и как да се подобри.
- Препоръчваш: проактивно предлагаш следваща стъпка, упражнение или тема според напредъка му.

НАЧИН НА ОБЩУВАНЕ:
- Давай кратки отговори — максимум 3-4 изречения на съобщение.
- Задавай по един въпрос наведнъж. Никога два едновременно.
- Не изнасяй лекции. Води диалог — чакай отговор преди да продължиш.
- Първо разбери, после съветвай. Ако нещо във въпроса не ти е ясно — попитай преди да отговаряш.
- Насърчавай и подкрепяй. При грешка или несигурност — първо признай доброто, после помогни за подобрение.
- Когато обсъждаш представяне или симулация, прилагай коучинг подход: първо провокирай размисъл, после добави своята насока.

СТИЛ:
- Топъл, практичен, директен. Не прекалявай с похвали.
- Стъпвай на учебното съдържание от курса (предоставено ти като контекст) и давай конкретни примери.
- Помни историята на разговора и се позовавай на предишни теми и минали симулации.
- Дръж фокуса върху обучението; ако разговорът се отклони, върни го деликатно.
- Отговаряй само на БЪЛГАРСКИ.

Имаш достъп до и виждаш: цялото учебно съдържание на обучението, историята на разговорите с потребителя и неговите симулации и анализи. Винаги използвай този контекст за персонализирани и релевантни насоки — не общи приказки.`;

/**
 * Extracts the scenario-focus text from an existing analysis prompt (whatever is
 * currently live in the DB — even if it was edited via admin), so we can rebuild
 * it with the new "ти" template while preserving the per-scenario focus.
 */
function extractFocus(prompt: string): string | null {
  const m = prompt.match(/ФОКУС НА СЦЕНАРИЯ:\s*([\s\S]*?)\n\nВърни САМО валиден JSON/);
  return m ? m[1].trim() : null;
}

async function main() {
  console.log("── Applying Phase 5 (targeted) ─────────────────────────────");

  // 1) Robi consultant: title + systemPrompt only (nothing else touched)
  const robi = await db
    .select({ id: schema.bots.id })
    .from(schema.bots)
    .where(eq(schema.bots.key, "consultant"))
    .then((r) => r[0]);

  if (robi) {
    await db
      .update(schema.bots)
      .set({ title: ROBI_TITLE, systemPrompt: ROBI_SYSTEM_PROMPT })
      .where(eq(schema.bots.key, "consultant"));
    console.log("✓ Updated Robi (consultant): title + systemPrompt");
  } else {
    console.warn("! consultant bot not found — skipped");
  }

  // 2) All simulation bots: rebuild analysisPrompt with the new "ти" template,
  //    preserving each bot's existing scenario focus. systemPrompt (persona) is
  //    NEVER touched.
  const sims = await db
    .select({
      id: schema.bots.id,
      key: schema.bots.key,
      analysisPrompt: schema.bots.analysisPrompt,
    })
    .from(schema.bots)
    .where(eq(schema.bots.kind, "simulation"));

  let updated = 0;
  const skipped: string[] = [];
  for (const bot of sims) {
    if (!bot.analysisPrompt) {
      skipped.push(`${bot.key} (no analysisPrompt)`);
      continue;
    }
    const focus = extractFocus(bot.analysisPrompt);
    if (!focus) {
      skipped.push(`${bot.key} (focus not found — LEFT UNCHANGED)`);
      continue;
    }
    await db
      .update(schema.bots)
      .set({ analysisPrompt: buildAnalysisPrompt(focus) })
      .where(eq(schema.bots.id, bot.id));
    updated++;
    console.log(`✓ Rebuilt analysisPrompt: ${bot.key}`);
  }

  console.log(`\nDone. analysisPrompt updated for ${updated} simulation bot(s).`);
  if (skipped.length) console.log("Skipped:", skipped.join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
