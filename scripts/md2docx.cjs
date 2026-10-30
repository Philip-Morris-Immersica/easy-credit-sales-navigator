// Markdown (ограничен поднабор, както в docs/09-instrukcia) → .docx (Т10).
// Употреба: node scripts/md2docx.cjs <in.md> <out.docx> "<заглавие за долния колонтитул>"
// След това съдържанието (TOC) се попълва и файлът се записва през Word (COM): TablesOfContents.Update() + Save.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat, Footer, PageNumber,
  TableOfContents, PageBreak,
} = require(path.join(process.cwd(), "node_modules", "docx"));

const [inFile, outFile, footerTitle] = process.argv.slice(2);
const baseDir = path.dirname(inFile);
const lines = fs.readFileSync(inFile, "utf8").replace(/\r/g, "").split("\n");

const RED = "C8102E";
const FONT = "Calibri";
const CONTENT_DXA = 9638; // A4, полета 2 см
const MAX_W = 640, MAX_H = 820;

// ── inline: **bold**, *italic*, `code`, [ДА СЕ ПРОВЕРИ: …] ────────────────────
function inline(text, base = {}) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[ДА СЕ ПРОВЕРИ[^\]]*\]|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  const push = (t, o = {}) => t && runs.push(new TextRun({ text: t, font: FONT, ...base, ...o }));
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index));
    const s = m[0];
    if (s.startsWith("**")) {
      // вложен ДА СЕ ПРОВЕРИ в удебелен текст
      const inner = s.slice(2, -2);
      const hl = inner.startsWith("[ДА СЕ ПРОВЕРИ") ? { highlight: "yellow" } : {};
      runs.push(...inline(inner.startsWith("[ДА СЕ ПРОВЕРИ") ? inner.replace(/`/g, "") : inner, { ...base, bold: true, ...hl }));
    } else if (s.startsWith("`")) push(s.slice(1, -1), { font: "Consolas", size: 19, color: "444444" });
    else if (s.startsWith("[ДА СЕ ПРОВЕРИ")) push(s.replace(/`/g, ""), { highlight: "yellow" });
    else if (s.startsWith("[")) push(s.replace(/\]\([^)]+\)$/, "").slice(1));
    else push(s.slice(1, -1), { italics: true });
    last = m.index + s.length;
  }
  push(text.slice(last));
  return runs;
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), buf: b };
}

const children = [];
const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function table(rows) {
  const cols = rows[0].length;
  // ширини по дължината на текста, с минимум
  const lens = Array.from({ length: cols }, (_, c) =>
    Math.max(...rows.map((r) => Math.min((r[c] || "").length, 60)), 6));
  const sum = lens.reduce((a, b) => a + b, 0);
  const widths = lens.map((l) => Math.floor((l / sum) * CONTENT_DXA));
  widths[cols - 1] += CONTENT_DXA - widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: widths.map((w, c) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders: cellBorders,
        shading: i === 0 ? { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: inline((r[c] || "").trim(), { size: 19, bold: i === 0 }) })],
      })),
    })),
  });
}

let i = 0;
let firstH1 = true;
let numInstance = 1;
let firstH2Index = -1;
while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }

  let m;
  if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
    const level = m[1].length;
    if (level === 1) {
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: inline(m[2]) }));
      if (firstH1) { firstH1 = false; }
    } else {
      if (level === 2 && firstH2Index < 0) firstH2Index = children.length;
      const map = { 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3 };
      children.push(new Paragraph({ heading: map[level], children: inline(m[2]) }));
    }
    i++; continue;
  }
  if (/^---+\s*$/.test(line)) { i++; continue; }

  if (line.startsWith(">")) {
    const block = [];
    while (i < lines.length && lines[i].startsWith(">")) { block.push(lines[i].replace(/^>\s?/, "")); i++; }
    for (const b of block) if (b.trim()) children.push(new Paragraph({
      children: inline(b),
      indent: { left: 240 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: RED, space: 8 } },
      shading: { type: ShadingType.CLEAR, fill: "FBF3F4", color: "auto" },
      spacing: { after: 60 },
    }));
    children.push(new Paragraph({ children: [] }));
    continue;
  }

  if (line.startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith("|")) {
      const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|");
      if (!cells.every((c) => /^\s*:?-{2,}:?\s*$/.test(c))) rows.push(cells);
      i++;
    }
    children.push(table(rows));
    children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
    continue;
  }

  if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/))) {
    const file = path.join(baseDir, m[2]);
    const { w, h, buf } = pngSize(file);
    let s = Math.min(1, MAX_W / w, MAX_H / h);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120 },
      children: [new ImageRun({
        type: "png", data: buf,
        transformation: { width: Math.round(w * s), height: Math.round(h * s) },
        altText: { title: m[1], description: m[1], name: path.basename(file) },
      })],
    }));
    i++;
    // курсивният надпис след снимката
    if (lines[i] && /^\*[^*].*\*\s*$/.test(lines[i])) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: lines[i].trim().slice(1, -1), italics: true, size: 18, color: "666666", font: FONT })],
      }));
      i++;
    }
    continue;
  }

  if ((m = line.match(/^(\s*)([-*])\s+(.*)$/))) {
    const lvl = m[1].length >= 2 ? 1 : 0;
    children.push(new Paragraph({ numbering: { reference: "bullets", level: lvl }, children: inline(m[3]) }));
    i++; continue;
  }
  if ((m = line.match(/^(\s*)(\d+)\.\s+(.*)$/))) {
    // нова номерация за всяка поредица
    const inst = numInstance;
    while (i < lines.length && (m = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/) || lines[i].match(/^(\s+)([-*])\s+(.*)$/))) {
      if (/^\d+$/.test(m[2])) children.push(new Paragraph({ numbering: { reference: "numbers", level: 0, instance: inst }, children: inline(m[3]) }));
      else children.push(new Paragraph({ numbering: { reference: "bullets", level: 1 }, children: inline(m[3]) }));
      i++;
    }
    numInstance++;
    continue;
  }

  // обикновен абзац (събира съседните редове)
  const para = [];
  while (i < lines.length && lines[i].trim() && !/^(#|>|\||!\[|---|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
    para.push(lines[i].trim()); i++;
  }
  if (!para.length) { para.push(lines[i].trim()); i++; }
  children.push(new Paragraph({ children: inline(para.join(" ")) }));
}


if (firstH2Index > 0) {
  children.splice(firstH2Index, 0,
    new Paragraph({ children: [new TextRun({ text: "Съдържание", bold: true, size: 28, color: RED, font: FONT })], spacing: { after: 120 } }),
    new TableOfContents("Съдържание", { hyperlink: true, headingStyleRange: "1-2" }),
    new Paragraph({ children: [new PageBreak()] }),
  );
}

const doc = new Document({
  creator: "Immersica",
  title: footerTitle,
  styles: {
    default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { after: 100, line: 276 } } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 40, bold: true, color: RED, font: FONT }, paragraph: { spacing: { after: 240 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: RED, font: FONT }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 25, bold: true, color: "222222", font: FONT }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: "444444", font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
      ] },
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `${footerTitle} · стр. `, size: 16, color: "888888", font: FONT }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888", font: FONT }),
      ],
    })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(outFile, b); console.log("OK", outFile, (b.length / 1e6).toFixed(1) + " MB"); });
