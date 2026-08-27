/**
 * Aligns the two meeting scenarios after the Блажка / Стоян persona swap:
 *   meeting-scenario-existing-new → Стоян Василев Илиев (заем за бизнес нужда, 500 EUR / 12 седмици)
 *   meeting-scenario-refinance    → Блажка Димитрова Шушкова (ВИП продукт, 3000 EUR / 10 седмици)
 *
 * The roleplay prompts were already swapped by hand; this script fixes what was left behind:
 * both analysis prompts still carried the focus text of the other scenario, and both welcome
 * messages still belonged to the previous personas.
 *
 * Блажка's own briefing (заявка „СРЕЩА В ОФИС Бързащ - нетърпелив – Арогантен-рефинансиране")
 * describes a next/second loan, not a refinancing calculation, so her roleplay prompt is left
 * exactly as the client wrote it. The script only undoes an earlier attempt to reword it.
 *
 * Run: npx tsx scripts/apply-vip-swap.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { bots } from "../src/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const STOYAN_FOCUS =
  "Дългогодишен VIP клиент — Стоян Василев Илиев — идва на среща в офис за заем за бизнес нужда от 500 евро за 12 седмици. Има няколко изплатени кредита и реално достигнат VIP статут, но след това плаща непостоянно, с закъснения до 180 дни. Влиза с демонстративно самочувствие и надменен тон, подчертава връзки, положение и компетентност, хваща се за дребни неточности, такси и формулировки, а при общи отговори иска друг служител. Оценявай особено: дали консултантът е започнал спокойно, делово и уважително и е признал дългогодишните отношения, без да преувеличава привилегиите; дали е установил конкретната бизнес нужда, вместо да приеме, че знае целта; дали е дал точни отговори за сумата, срока, вноските и таксите вместо общи приказки; дали е задавал по един конкретен въпрос наведнъж; дали е запазил професионален тон, без да спори, да поучава, да се оправдава или да се държи фамилиарно; дали не е обещал изключения от процедурите и не е засрамвал клиента за закъсненията му; дали е приключил с ясно решение дали се преминава към кандидатстване и каква е следващата стъпка.";

const BLAZHKA_FOCUS =
  "Настоящ ВИП клиент — Блажка Димитрова Шушкова — идва на предварително уговорена среща в офис за ново финансиране от 3000 евро за 10 седмици. Бързаща, нетърпелива и арогантна; очаква незабавно, приоритетно и дискретно обслужване; поставя срок от 20 минути; отказва телефонен контакт; заплашва, че ще отиде при конкуренция. Оценявай особено: дали консултантът е започнал кратко, спокойно и уверено и е показал, че разбира спешността и дискретността; дали е поставил ясна рамка и е задал само необходимите конкретни въпроси; дали не е отговорил на грубия тон с груб тон, не е спорил за ВИП статуса и не се е оправдавал; дали не е обещал одобрение или срок, който не е потвърден; дали е обяснил реалистично какво следва и е уточнил предпочитания начин за обратна връзка; дали е удържал рамката на срещата въпреки натиска, без да пропуска необходимите проверки.";

const STOYAN_WELCOME = "Добър ден.\nДойдох за заем за бизнес нужда. Бих искал да чуя точните условия.";

const BLAZHKA_WELCOME = "Добър ден.\nДойдох за кредита. Ще се радвам да стане възможно най-бързо.";

/**
 * An earlier pass reworded Блажка's SITUATION and PRICING_LOGIC into a refinancing calculation.
 * That contradicts her briefing, so these pairs restore the client's original wording. Both are
 * no-ops once the prompt is back to the original text.
 */
const REVERTS: { label: string; from: string; to: string }[] = [
  {
    label: "SITUATION",
    from: "Имаш текущ кредит при Изи Кредит, който плащаш редовно и винаги на падеж. Идваш заради рефинансиране — искаш текущият кредит да бъде подновен и да получиш разликата на ръка сега и веднага, защото парите ти трябват за лична нужда, за която не желаеш да говориш подробно.",
    to: "Това е пореден кредит. Искаш нов втори кредит сега и веднага, защото ти трябват пари за пластична операция.",
  },
  {
    label: "PRICING_LOGIC",
    from:
      "- Ако се обсъжда самият продукт, приемай за база рефинансиране на ВИП продукт: нов кредит от 3000 евро за 10 седмици, от който се погасява оставащата сума по текущия ти кредит, а разликата получаваш на ръка.\n" +
      "- Интересува те основно каква сума реално остава за теб и кога ще я получиш, а не как е структурирано вътрешно. Ако консултантът говори за рефинансиране, без да каже конкретни числа, настояваш за разликата в цифри.",
    to: "- Ако се обсъжда самият продукт, приемай за база, че става дума за ВИП продукт: 3000 евро за 10 седмици.",
  },
];

const FOCUS_LINE = /^ФОКУС НА СЦЕНАРИЯ: .*$/m;

function replaceFocus(analysisPrompt: string, focus: string, key: string): string {
  if (!FOCUS_LINE.test(analysisPrompt)) {
    throw new Error(`[${key}] Не намерих реда „ФОКУС НА СЦЕНАРИЯ:" в analysis_prompt.`);
  }
  return analysisPrompt.replace(FOCUS_LINE, `ФОКУС НА СЦЕНАРИЯ: ${focus}`);
}

async function main() {
  const [stoyan] = await db
    .select()
    .from(bots)
    .where(eq(bots.key, "meeting-scenario-existing-new"));
  const [blazhka] = await db.select().from(bots).where(eq(bots.key, "meeting-scenario-refinance"));

  if (!stoyan || !blazhka) throw new Error("Липсва един от двата бота в базата.");

  if (!stoyan.systemPrompt?.includes("Стоян Василев Илиев")) {
    throw new Error(
      "meeting-scenario-existing-new вече не е Стоян — прекъсвам, за да не презапиша нещо друго.",
    );
  }
  if (!blazhka.systemPrompt?.includes("Блажка Димитрова Шушкова")) {
    throw new Error(
      "meeting-scenario-refinance вече не е Блажка — прекъсвам, за да не презапиша нещо друго.",
    );
  }

  await db
    .update(bots)
    .set({
      analysisPrompt: replaceFocus(
        stoyan.analysisPrompt ?? "",
        STOYAN_FOCUS,
        "meeting-scenario-existing-new",
      ),
      welcomeMessage: STOYAN_WELCOME,
      updatedAt: new Date(),
    })
    .where(eq(bots.key, "meeting-scenario-existing-new"));
  console.log("✓ meeting-scenario-existing-new: анализ + начална реплика (Стоян)");

  let blazhkaSystem = blazhka.systemPrompt;
  for (const { label, from, to } of REVERTS) {
    if (blazhkaSystem.includes(from)) {
      blazhkaSystem = blazhkaSystem.split(from).join(to);
      console.log(`  ↩ ${label}: върнат оригиналният текст от заявката`);
    } else if (!blazhkaSystem.includes(to)) {
      throw new Error(`[meeting-scenario-refinance] ${label} не съвпада с нито един от двата текста.`);
    }
  }

  await db
    .update(bots)
    .set({
      systemPrompt: blazhkaSystem,
      analysisPrompt: replaceFocus(
        blazhka.analysisPrompt ?? "",
        BLAZHKA_FOCUS,
        "meeting-scenario-refinance",
      ),
      welcomeMessage: BLAZHKA_WELCOME,
      updatedAt: new Date(),
    })
    .where(eq(bots.key, "meeting-scenario-refinance"));
  console.log("✓ meeting-scenario-refinance: анализ + начална реплика (Блажка)");

  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
