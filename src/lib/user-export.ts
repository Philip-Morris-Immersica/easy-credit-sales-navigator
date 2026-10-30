/**
 * Изтегляне на резултатите на един потребител като Excel файл (Т7).
 *
 * Какво влиза: само симулационните разговори (`conversations.kind = 'simulation'`)
 * с техните стенограми и анализи. Разговорите с Роби (kind = 'consultant') НЕ влизат —
 * това са въпроси към помощен асистент, а не оценявано упражнение; в тях няма
 * оценка, а потребителят ги вижда и в приложението. Името на критериите се чете
 * от данните (никога не е зададено на ръка).
 *
 * Достъпът се проверява от викащия маршрут (потребител — само собствените си
 * данни; администратор — всеки). Тук няма проверка на права.
 */
import ExcelJS from "exceljs";
import { and, asc, eq, inArray } from "drizzle-orm";
import db from "@/db";
import { users, conversations, messages, analyses, bots } from "@/db/schema";

/** Срок на съхранение (месеци) — показва се в листа „Информация“. Синхронизирай с Т6. */
export const RETENTION_MONTHS = 12;

const TIME_ZONE = "Europe/Sofia";
const DATE_FMT = "dd.mm.yyyy hh:mm";
/** Excel позволява най-много 32 767 знака в клетка. */
const MAX_CELL = 32000;

export interface ExportRequester {
  name: string | null;
  email: string;
  role: string;
}

export interface UserExportResult {
  buffer: Buffer;
  /** Пълно име на файла (с кирилица). */
  fileName: string;
  /** ASCII вариант (транслитерация) за `filename=`. */
  asciiFileName: string;
  conversationCount: number;
  analysisCount: number;
  messageCount: number;
}

type Criterion = { name: string; score: number | null; comment: string };

// ─── Помощни ──────────────────────────────────────────────────────────────────

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

function transliterate(s: string): string {
  return Array.from(s)
    .map((ch) => {
      const lower = ch.toLowerCase();
      const t = CYR[lower];
      if (t === undefined) return ch;
      return ch === lower ? t : t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join("");
}

/** Оставя букви/цифри (вкл. кирилица), останалото става „_“. */
function safePart(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Excel няма часови зонa за датите — показва числото такова, каквото е записано.
 * Затова превръщаме моментa в „стенен часовник“ на София (записан като UTC), за да
 * се виждат часовете, които потребителят е видял в приложението.
 */
function sofiaWallClock(d: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")));
}

function isoDateSofia(d: Date): string {
  return sofiaWallClock(d).toISOString().slice(0, 10);
}

function fmtDateText(d: Date): string {
  const w = sofiaWallClock(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(w.getUTCDate())}.${p(w.getUTCMonth() + 1)}.${w.getUTCFullYear()} ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`;
}

function clip(s: string): string {
  return s.length > MAX_CELL ? s.slice(0, MAX_CELL) + "\n[… текстът е съкратен заради ограничение на Excel]" : s;
}

/** Content-Disposition със сигурна кирилица (RFC 5987/6266). */
export function contentDisposition(result: Pick<UserExportResult, "fileName" | "asciiFileName">): string {
  const encoded = encodeURIComponent(result.fileName).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${result.asciiFileName}"; filename*=UTF-8''${encoded}`;
}

// ─── Оформление ───────────────────────────────────────────────────────────────

const BRAND_RED = "FFD6071A";
const FILL_GOOD = "FFE4F3E6";
const FILL_MID = "FFFFF3CC";
const FILL_BAD = "FFFBE3E3";
const FILL_NOTE = "FFF3F4F6";
const BORDER = { style: "thin", color: { argb: "FFE0E0E0" } } as const;

/** Прагове както в интерфейса: ≥ 8 добре, ≥ 6 средно, иначе слабо. */
function scoreFill(score: number | null | undefined): ExcelJS.Fill | undefined {
  if (score == null || Number.isNaN(score)) return undefined;
  const argb = score >= 8 ? FILL_GOOD : score >= 6 ? FILL_MID : FILL_BAD;
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
  row.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  row.height = 28;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnCount } };
}

function borderRow(row: ExcelJS.Row, columnCount: number) {
  for (let c = 1; c <= columnCount; c++) row.getCell(c).border = { bottom: BORDER };
}

// ─── Основна функция ──────────────────────────────────────────────────────────

/** Връща null, ако потребителят не съществува. */
export async function buildUserExport(
  userId: string,
  requester: ExportRequester,
  now: Date = new Date()
): Promise<UserExportResult | null> {
  const user = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0]);
  if (!user) return null;

  const convRows = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      startedAt: conversations.startedAt,
      botTitle: bots.title,
      direction: bots.direction,
      overallScore: analyses.overallScore,
      criteria: analyses.criteria,
      strengths: analyses.strengths,
      improvements: analyses.improvements,
      summary: analyses.summary,
      hasAnalysis: analyses.id,
    })
    .from(conversations)
    .leftJoin(bots, eq(conversations.botId, bots.id))
    .leftJoin(analyses, eq(analyses.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), eq(conversations.kind, "simulation")))
    .orderBy(asc(conversations.startedAt));

  const ids = convRows.map((c) => c.id);
  const msgRows = ids.length
    ? await db
        .select({
          conversationId: messages.conversationId,
          role: messages.role,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(inArray(messages.conversationId, ids))
        .orderBy(asc(messages.createdAt))
    : [];

  const msgsByConv = new Map<string, typeof msgRows>();
  for (const m of msgRows) {
    if (m.role === "system") continue; // системните промптове не са част от разговора
    const list = msgsByConv.get(m.conversationId) ?? [];
    list.push(m);
    msgsByConv.set(m.conversationId, list);
  }

  // Подготвяме разговорите (номерът е по хронология: най-старият е № 1).
  const items = convRows.map((c, i) => {
    const msgs = msgsByConv.get(c.id) ?? [];
    const criteria = parseCriteria(c.criteria);
    let durationMin: number | null = null;
    if (msgs.length >= 2) {
      const ms = msgs[msgs.length - 1].createdAt.getTime() - msgs[0].createdAt.getTime();
      durationMin = Math.round((ms / 60000) * 10) / 10;
    }
    return { ...c, n: i + 1, msgs, criteria, durationMin };
  });

  // Колоните-критерии идват от данните: по реда на първо срещане.
  const criterionNames: string[] = [];
  for (const it of items) {
    for (const cr of it.criteria) if (!criterionNames.includes(cr.name)) criterionNames.push(cr.name);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "EasyCredit Sales Navigator";
  wb.created = now;

  // ── Лист 1: Обобщение ─────────────────────────────────────────────────────
  {
    const sh = wb.addWorksheet("Обобщение");
    const fixed = [
      { header: "Разговор №", key: "n", width: 11 },
      { header: "Дата", key: "date", width: 18 },
      { header: "Сценарий", key: "bot", width: 38 },
      { header: "Тип", key: "type", width: 12 },
      { header: "Продължителност (мин)", key: "dur", width: 16 },
      { header: "Обща оценка", key: "overall", width: 12 },
    ];
    const critCols = criterionNames.map((name, i) => ({ header: name, key: `c${i}`, width: 20 }));
    const statusCol = { header: "Статус", key: "status", width: 13 };
    sh.columns = [...fixed, ...critCols, statusCol];
    const colCount = fixed.length + critCols.length + 1;
    styleHeader(sh, colCount);

    for (const it of items) {
      const rowData: Record<string, unknown> = {
        n: it.n,
        date: sofiaWallClock(it.startedAt),
        bot: it.botTitle ?? "—",
        type: it.direction === "call" ? "Обаждане" : it.direction === "meeting" ? "Среща" : "—",
        dur: it.durationMin,
        overall: it.overallScore ?? null,
        status: it.status === "completed" ? "Завършен" : it.status === "active" ? "Активен" : "Изоставен",
      };
      criterionNames.forEach((name, i) => {
        const cr = it.criteria.find((x) => x.name === name);
        rowData[`c${i}`] = cr?.score ?? null;
      });
      const row = sh.addRow(rowData);
      row.getCell("date").numFmt = DATE_FMT;
      row.alignment = { vertical: "top", wrapText: true };
      row.getCell("n").alignment = { vertical: "top", horizontal: "center" };
      for (const key of ["dur", "overall", ...criterionNames.map((_, i) => `c${i}`)]) {
        row.getCell(key).alignment = { vertical: "top", horizontal: "center" };
      }
      const f = scoreFill(it.overallScore);
      if (f) row.getCell("overall").fill = f;
      criterionNames.forEach((name, i) => {
        const cr = it.criteria.find((x) => x.name === name);
        const cf = scoreFill(cr?.score);
        if (cf) row.getCell(`c${i}`).fill = cf;
      });
      row.getCell("overall").font = { bold: true };
      borderRow(row, colCount);
    }
    if (items.length === 0) {
      sh.addRow({ bot: "Няма проведени симулации." });
    }
  }

  // ── Лист 2: Анализи ───────────────────────────────────────────────────────
  {
    const sh = wb.addWorksheet("Анализи");
    sh.columns = [
      { header: "Дата", key: "date", width: 18 },
      { header: "Сценарий", key: "bot", width: 34 },
      { header: "Разговор №", key: "n", width: 11 },
      { header: "Критерий", key: "crit", width: 28 },
      { header: "Оценка", key: "score", width: 9 },
      { header: "Коментар", key: "comment", width: 100 },
    ];
    styleHeader(sh, 6);

    let analysed = 0;
    for (const it of items) {
      if (!it.hasAnalysis) continue;
      analysed++;
      const base = { date: sofiaWallClock(it.startedAt), bot: it.botTitle ?? "—", n: it.n };

      const addRow = (crit: string, score: number | null, comment: string, kind: "criterion" | "section") => {
        const row = sh.addRow({ ...base, crit, score, comment: clip(comment) });
        row.getCell("date").numFmt = DATE_FMT;
        row.alignment = { vertical: "top", wrapText: true };
        row.getCell("n").alignment = { vertical: "top", horizontal: "center" };
        row.getCell("score").alignment = { vertical: "top", horizontal: "center" };
        row.getCell("crit").font = { bold: true };
        if (kind === "criterion") {
          const f = scoreFill(score);
          if (f) row.getCell("score").fill = f;
        } else {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_NOTE } };
          });
        }
        borderRow(row, 6);
      };

      for (const cr of it.criteria) addRow(cr.name, cr.score, cr.comment, "criterion");
      if (it.overallScore != null) {
        const row = sh.addRow({ ...base, crit: "Обща оценка", score: it.overallScore, comment: "" });
        row.getCell("date").numFmt = DATE_FMT;
        row.alignment = { vertical: "top", wrapText: true };
        row.getCell("n").alignment = { vertical: "top", horizontal: "center" };
        row.getCell("score").alignment = { vertical: "top", horizontal: "center" };
        row.font = { bold: true };
        const f = scoreFill(it.overallScore);
        if (f) row.getCell("score").fill = f;
        borderRow(row, 6);
      }
      const bullets = (list: string[] | null) => (list ?? []).map((s) => `• ${s}`).join("\n");
      if (it.strengths?.length) addRow("Силни страни", null, bullets(it.strengths), "section");
      if (it.improvements?.length) addRow("Какво да подобри", null, bullets(it.improvements), "section");
      if (it.summary) addRow("Обобщение", null, it.summary, "section");
    }
    if (analysed === 0) sh.addRow({ crit: "Няма анализирани разговори." });
  }

  // ── Лист 3: Стенограми ────────────────────────────────────────────────────
  let messageCount = 0;
  {
    const sh = wb.addWorksheet("Стенограми");
    sh.columns = [
      { header: "Дата", key: "date", width: 18 },
      { header: "Сценарий", key: "bot", width: 34 },
      { header: "Разговор №", key: "n", width: 11 },
      { header: "Кой говори", key: "who", width: 13 },
      { header: "Текст", key: "text", width: 110 },
    ];
    styleHeader(sh, 5);
    for (const it of items) {
      for (const m of it.msgs) {
        messageCount++;
        const row = sh.addRow({
          date: sofiaWallClock(m.createdAt),
          bot: it.botTitle ?? "—",
          n: it.n,
          who: m.role === "user" ? "Консултант" : "Клиент",
          text: clip(m.content),
        });
        row.getCell("date").numFmt = DATE_FMT;
        row.alignment = { vertical: "top", wrapText: true };
        row.getCell("n").alignment = { vertical: "top", horizontal: "center" };
        if (m.role === "user") {
          row.getCell("who").font = { bold: true };
          row.getCell("who").fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL_NOTE } };
        }
        borderRow(row, 5);
      }
    }
    if (messageCount === 0) sh.addRow({ text: "Няма стенограми." });
  }

  // ── Лист 4: Информация ────────────────────────────────────────────────────
  const analysisCount = items.filter((i) => i.hasAnalysis).length;
  {
    const sh = wb.addWorksheet("Информация");
    sh.columns = [
      { header: "Показател", key: "k", width: 30 },
      { header: "Стойност", key: "v", width: 100 },
    ];
    const header = sh.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_RED } };
    header.height = 24;
    sh.views = [{ state: "frozen", ySplit: 1 }];

    const first = items[0]?.startedAt;
    const last = items[items.length - 1]?.startedAt;
    const period = first && last ? `${fmtDateText(first)} – ${fmtDateText(last)}` : "—";
    const requesterLabel = `${requester.name ?? requester.email} (${requester.email})`;

    const info: Array<[string, string | number]> = [
      ["Потребител", `${user.name ?? "—"} (${user.email})`],
      ["Изтеглено от", requesterLabel],
      ["Изтеглено на", fmtDateText(now)],
      ["Период на включените разговори", period],
      ["Брой симулации", items.length],
      ["Брой анализи", analysisCount],
      ["Брой реплики", messageCount],
      ["Скала на оценките", "от 1 до 10; цветът в таблицата: зелено = 8 и повече, жълто = 6 до 8, червено = под 6"],
      ["Не са включени", "Разговорите със служебния асистент Роби — файлът съдържа само симулациите."],
      ["Важно", "Само за обучение и развитие, не е оценка на работата."],
      ["Срок на съхранение", `Разговорите, стенограмите и анализите се пазят ${RETENTION_MONTHS} месеца от датата на провеждане на разговора и след това се изтриват окончателно.`],
    ];
    for (const [k, v] of info) {
      const row = sh.addRow({ k, v });
      row.getCell("k").font = { bold: true };
      row.alignment = { vertical: "top", wrapText: true };
      borderRow(row, 2);
    }
    const noteRow = sh.getRow(sh.rowCount - 1);
    noteRow.getCell("v").font = { bold: true, color: { argb: BRAND_RED } };
  }

  // ── Файл ──────────────────────────────────────────────────────────────────
  const rawName = user.name?.trim() || user.email.split("@")[0];
  const cyr = safePart(rawName) || "potrebitel";
  const date = isoDateSofia(now);
  const fileName = `Navigator_rezultati_${cyr}_${date}.xlsx`;
  const asciiFileName = `Navigator_rezultati_${safePart(transliterate(rawName)).replace(/[^\x20-\x7E]/g, "") || "potrebitel"}_${date}.xlsx`;

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer: buf,
    fileName,
    asciiFileName,
    conversationCount: items.length,
    analysisCount,
    messageCount,
  };
}

function parseCriteria(raw: unknown): Criterion[] {
  if (!Array.isArray(raw)) return [];
  const out: Criterion[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    const score = typeof o.score === "number" ? o.score : Number(o.score);
    out.push({
      name: o.name.trim(),
      score: Number.isFinite(score) ? score : null,
      comment: typeof o.comment === "string" ? o.comment : "",
    });
  }
  return out;
}
