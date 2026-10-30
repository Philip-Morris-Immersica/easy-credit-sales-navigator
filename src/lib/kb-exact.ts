/**
 * Търсене по точно съвпадение в „База знания“ — чисти функции, без достъп до базата.
 *
 * Защо е нужно: embedding-ите не улучват кратки съкращения („ГПР“, „ППЗ“, „СЕФ“, „Bh-score“).
 * Затова към семантичното търсене добавяме точно търсене на цяла дума за токени,
 * които изглеждат като съкращение (главни букви / цифри / тире).
 *
 * Граница на дума: Postgres `\m \M` и `\b` НЕ работят с кирилица в тази база
 * (проверено: 'а ГПР.' ~ '\mГПР\M' → false), затова SQL прави само груб предфилтър
 * (strpos), а точното съвпадение на цяла дума се проверява тук, с Unicode regex.
 */

export interface ExactToken {
  /** Токенът така, както е написан в заявката. */
  text: string;
  /** Токени с малки букви (напр. „Bh-score“) се сравняват без значение на регистъра. */
  caseInsensitive: boolean;
}

export interface ExactCandidate {
  title: string | null;
  content: string;
}

export interface ExactHit extends ExactCandidate {
  score: number;
}

const MAX_TOKENS = 5;
const MIN_TOKEN_LEN = 2;
const MAX_TOKEN_LEN = 16;

/** Служебни думи с главни букви, които не са съкращения. */
const STOP_TOKENS = new Set(["ДА", "НЕ", "ИЛИ", "ЗА", "НА", "ОТ", "ПО", "ДО", "ТОВА", "КАК", "КАКВО", "КОЙ", "КАКЪВ"]);

const WORD_RE = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu;

/**
 * Изважда от заявката токените, които приличат на съкращение:
 *  - само главни букви (ГПР, ППЗ, ИАМ), по желание с цифри/тире;
 *  - думи с цифра (Т2, 70А);
 *  - думи с тире и главна буква (Bh-score).
 * Обикновените думи („лихва“, „Изи“) не са кандидати — за тях важи само семантичното търсене.
 */
export function extractExactTokens(query: string): ExactToken[] {
  const seen = new Set<string>();
  const out: ExactToken[] = [];
  for (const m of query.match(WORD_RE) ?? []) {
    if (m.length < MIN_TOKEN_LEN || m.length > MAX_TOKEN_LEN) continue;
    if (STOP_TOKENS.has(m)) continue;
    const hasLetter = /\p{L}/u.test(m);
    const hasUpper = /\p{Lu}/u.test(m);
    const hasLower = /\p{Ll}/u.test(m);
    const hasDigit = /\p{N}/u.test(m);
    const allCaps = hasLetter && hasUpper && !hasLower;
    const mixedWithHyphen = hasUpper && hasLower && m.includes("-");
    const internalCapital = /\p{Ll}\p{Lu}/u.test(m); // RegiX, BhScore
    const withDigit = hasLetter && hasDigit;
    if (!(allCaps || mixedWithHyphen || internalCapital || withDigit)) continue;
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: m, caseInsensitive: hasLower });
    if (out.length >= MAX_TOKENS) break;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWordRegex(token: ExactToken): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapeRegex(token.text)}(?![\\p{L}\\p{N}_])`,
    token.caseInsensitive ? "giu" : "gu"
  );
}

/** Съдържа ли текстът токена като цяла дума (работи и с кирилица). */
export function containsWholeWord(text: string, token: ExactToken): boolean {
  return wholeWordRegex(token).test(text);
}

function countWholeWord(text: string, token: ExactToken): number {
  return (text.match(wholeWordRegex(token)) ?? []).length;
}

/**
 * „Термините“ на откъса: първата клетка на всеки ред от таблица (`| ГПР | Годишен процент … |`),
 * а за по-стари документи, нарязани преди таблиците да се пазят като цели редове —
 * и кратките самостоятелни редове („ГПР“ на отделен ред над определението).
 */
function firstCells(content: string): string[] {
  const cells: string[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t.startsWith("|")) {
      const cell = t.slice(1).split("|")[0]?.trim();
      if (cell && t.endsWith("|")) cells.push(cell);
    } else if (t.length > 0 && t.length <= 40) {
      cells.push(t);
    }
  }
  return cells;
}

/**
 * Оценка на откъс спрямо токените; 0 = няма съвпадение (трябва да съдържа ПОНЕ ЕДИН токен).
 * Най-високо: токенът е цялата първа клетка на ред (определението на съкращението),
 * после — в първата клетка, после — другаде в текста.
 */
export function scoreExact(content: string, tokens: ExactToken[]): number {
  const cells = firstCells(content);
  let score = 0;
  let matched = 0;
  for (const tok of tokens) {
    const n = countWholeWord(content, tok);
    if (n === 0) continue;
    matched++;
    score += 10 + Math.min(n, 5);
    const cellRe = wholeWordRegex(tok);
    for (const cell of cells) {
      cellRe.lastIndex = 0;
      if (cell.length === tok.text.length && (tok.caseInsensitive ? cell.toLowerCase() === tok.text.toLowerCase() : cell === tok.text)) {
        score += 200;
        break;
      }
      // „ИАМ / ИАМ АД“, „ТОП КК“: токенът е в първата клетка, но не е цялата
      if (cellRe.test(cell)) { score += 100; break; }
    }
  }
  return matched > 0 ? score + matched * 20 : 0;
}

/** Филтрира кандидатите (предфилтрирани грубо в SQL) и ги подрежда: най-доброто съвпадение първо. */
export function rankExactHits(candidates: ExactCandidate[], tokens: ExactToken[], limit: number): ExactHit[] {
  if (tokens.length === 0) return [];
  return candidates
    .map((c) => ({ ...c, score: scoreExact(c.content, tokens) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Слива точните и семантичните резултати: точните са първи, дубликатите (същото съдържание) се махат.
 * `semanticLimit` ограничава колко семантични се добавят след точните.
 */
export function mergeHits<T extends { content: string }>(exact: T[], semantic: T[], semanticLimit: number): T[] {
  const seen = new Set(exact.map((h) => h.content));
  const rest = semantic.filter((h) => !seen.has(h.content)).slice(0, semanticLimit);
  return [...exact, ...rest];
}
