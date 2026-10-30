/**
 * Т4: тест на нарязването на таблици и на хибридното търсене върху речника на клиента.
 *
 * НЕ пише в базата. Речникът се парсва и нарязва в паметта, embedding-ите се смятат в паметта
 * (OpenAI, не базата) и търсенето се пуска върху този временен списък — със същите чисти функции
 * (kb-exact.ts), които ползва и searchKnowledge. Накрая (само четене) се пускат няколко
 * заявки през истинския searchKnowledge срещу базата.
 *
 * Пускане:  npx tsx scripts/one-off/t4-glossary-test.ts ["C:/път/Речник - съкращения и термини.docx"]
 */
import "dotenv/config";
import fs from "fs";
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { chunkDocument, parseUploadedFile, searchKnowledge, searchSemantic } from "@/lib/kb-documents";
import { extractExactTokens, mergeHits, rankExactHits } from "@/lib/kb-exact";

const FILE = process.argv[2] ?? "C:/Users/Work Account/Downloads/Речник - съкращения и термини.docx";
const MODEL = "text-embedding-3-small";
const THRESHOLD = 0.45;

interface Q {
  q: string;
  /** Всички поднизове трябва да са в някой от върнатите откъси (за „ТД“ — и двете значения). */
  expect: string[];
}

const QUESTIONS: Q[] = [
  { q: "ГПР", expect: ["| ГПР | Годишен процент на разходите"] },
  { q: "Какво означава ППЗ?", expect: ["| ППЗ | Предложение за сключване на договор"] },
  { q: "СЕФ", expect: ["| СЕФ | Стандартен европейски формуляр"] },
  { q: "Какво е ТД?", expect: ["Трудов договор", "Търговски директор"] },
  { q: "ИАМ / ИАМ АД", expect: ["| ИАМ / ИАМ АД | „Изи Асет Мениджмънт“"] },
  { q: "Bh-score", expect: ["| Bh-score / BhScore | Бихейвиър скоринг"] },
  { q: "Какво е ППП?", expect: ["| ППП | Приемо-предавателен протокол"] },
  { q: "Какво е ПП?", expect: ["| ПП | Погасителен план"] },
  { q: "УАК", expect: ["| УАК | Удостоверение за активен кредит"] },
  { q: "УЛЗ", expect: ["| УЛЗ | Удостоверение за липса на задължения"] },
  { q: "ЦКР", expect: ["| ЦКР | Централен кредитен регистър към БНБ"] },
  { q: "Какво означава КК?", expect: ["| КК | Кредитен консултант"] },
  { q: "ЕГН", expect: ["| ЕГН | Единен граждански номер"] },
  { q: "РКО", expect: ["| РКО | Ръководител Кредитен отдел"] },
  { q: "ОВС", expect: ["| ОВС | Отдел „Вътрешна сигурност“"] },
  { q: "МРЗ", expect: ["| МРЗ | Минимална работна заплата"] },
  { q: "KID", expect: ["| KID | Номер на договор за паричен заем"] },
  { q: "RegiX", expect: ["| RegiX | Държавна платформа"] },
  { q: "СОПП", expect: ["| СОПП | Седмичен отчет на паричните постъпления"] },
  { q: "ТОП КК", expect: ["| ТОП КК | Топ кредитен консултант"] },
  { q: "Каква е разликата между УАК и УЛЗ?", expect: ["| УАК | Удостоверение за активен кредит", "| УЛЗ | Удостоверение за липса на задължения"] },
];

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function main() {
  const parsed = await parseUploadedFile(FILE.split(/[\\/]/).pop()!, fs.readFileSync(FILE));
  const chunks = chunkDocument("Речник", "фирмена информация", parsed.meta, parsed.text);
  console.log(`\n=== 4.1 Нарязване: ${chunks.length} откъса ===`);
  chunks.forEach((c, i) => console.log(`  [${i}] ${c.content.length} зн. | ${c.title}`));

  // Проверка: всеки ред от таблица е цял и точно в един откъс; заглавният ред е повторен във всяка група.
  const sourceRows = parsed.text.split("\n").filter((l) => l.startsWith("|") && !/^\|[\s|-]+\|$/.test(l));
  const headerRows = new Set(["| Съкращение | Значение |", "| Термин | Обяснение |"]);
  let splitRows = 0, lost = 0, dup = 0;
  for (const row of sourceRows.filter((r) => !headerRows.has(r))) {
    const n = chunks.filter((c) => c.content.split("\n").includes(row)).length;
    if (n === 0) lost++;
    if (n > 1) dup++;
  }
  for (const c of chunks) {
    for (const l of c.content.split("\n")) if (l.startsWith("|") && !l.endsWith("|")) splitRows++;
  }
  const tableChunks = chunks.filter((c) => c.content.includes("| --- |"));
  const withHeader = tableChunks.filter((c) => /\n\| (Съкращение|Термин) \| (Значение|Обяснение) \|\n\| --- \| --- \|\n/.test(c.content));
  console.log(
    `  Редове от таблици в източника: ${sourceRows.length - 2} (без заглавни); загубени: ${lost}; в повече от един откъс: ${dup}; нецели редове: ${splitRows}`
  );
  console.log(`  Откъси-таблици: ${tableChunks.length}, от тях със заглавен ред: ${withHeader.length}`);

  // Временен списък в паметта (с embedding-и).
  const embedTexts = chunks.map((c) => `${c.title}\n${c.content}`);
  const { embeddings } = await embedMany({ model: openai.embedding(MODEL), values: embedTexts });
  const store = chunks.map((c, i) => ({ title: c.title, content: c.content, embedding: embeddings[i] }));

  async function semanticOnly(q: string) {
    const { embedding } = await embed({ model: openai.embedding(MODEL), value: q });
    return store
      .map((s) => ({ title: s.title, content: s.content, similarity: cosine(embedding, s.embedding) }))
      .filter((s) => s.similarity > THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  }
  async function hybrid(q: string) {
    const sem = await semanticOnly(q);
    const exact = rankExactHits(store, extractExactTokens(q), 4).map((h) => ({ title: h.title, content: h.content, similarity: 1 }));
    return mergeHits(exact, sem, 5);
  }

  console.log(`\n=== 4.3 Тест в паметта (речникът на клиента, ${QUESTIONS.length} въпроса) ===`);
  console.log("Колони: токени | чисто семантично (намерено?) | хибридно (намерено?, позиция на първия верен откъс)");
  let okHybrid = 0, okSem = 0;
  for (const { q, expect } of QUESTIONS) {
    const sem = await semanticOnly(q);
    const hyb = await hybrid(q);
    const found = (hits: { content: string }[]) => expect.every((e) => hits.some((h) => h.content.includes(e)));
    const pos = (hits: { content: string }[]) => hits.findIndex((h) => expect.some((e) => h.content.includes(e))) + 1;
    const s = found(sem), h = found(hyb);
    if (s) okSem++;
    if (h) okHybrid++;
    console.log(
      `${h ? "ДА " : "НЕ "} | ${q.padEnd(36)} | токени: ${extractExactTokens(q).map((t) => t.text).join(",") || "-"} | семантично: ${s ? "да" : "не"} (${sem.length} откъса) | хибридно: поз. ${pos(hyb) || "-"} от ${hyb.length}`
    );
  }
  console.log(`\nРезултат: хибридно ${okHybrid}/${QUESTIONS.length}; само семантично ${okSem}/${QUESTIONS.length}`);

  // ── Само четене от базата: истинската функция searchKnowledge ──
  console.log("\n=== Истинската searchKnowledge срещу базата (само четене; в базата са СТАРИТЕ откъси на „Речник“) ===");
  const dbQueries = ["ГПР", "СЕФ", "Какво е ТД?", "Bh-score", "ИАМ / ИАМ АД", "ППП", "УАК и УЛЗ", "ЦКР"];
  for (const q of dbQueries) {
    const hits = await searchKnowledge(q, "document");
    console.log(`  «${q}» → ${hits.map((h) => `${h.exact ? "[точно] " : ""}${h.title}`).join(" ; ") || "(нищо)"}`);
  }

  console.log("\n=== Обикновени (семантични) въпроси: хибридно == чисто семантично? ===");
  const normal = [
    "Как се обслужва клиент в неравностойно положение?",
    "Какви документи са нужни за лица в неравностойно положение?",
    "Колко е сумата на Изи Кредит и за какъв срок?",
    "Как работи програмата за лоялност и бонус точките?",
  ];
  for (const q of normal) {
    const [sem, hyb] = await Promise.all([searchSemantic(q, "document"), searchKnowledge(q, "document")]);
    const same = JSON.stringify(sem.map((h) => h.content)) === JSON.stringify(hyb.map((h) => h.content));
    console.log(`  «${q}» → ${same ? "ИДЕНТИЧНО" : "РАЗЛИЧНО"}; топ: ${hyb.slice(0, 3).map((h) => `${h.title} (${h.similarity.toFixed(2)})`).join(" ; ") || "(нищо)"}`);
  }

  console.log("\n=== Смесена заявка (съкращение + обикновен текст) ===");
  for (const q of ["ППЗ за лица в неравностойно положение", "Какво е СЕФ и кога се попълва?"]) {
    const hits = await searchKnowledge(q, "document");
    console.log(`  «${q}» → ${hits.map((h) => `${h.exact ? "[точно] " : ""}${h.title}`).join(" ; ") || "(нищо)"}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
