// Fetch the same concepts across several icon styles, recolor to brand grey+red,
// and build an HTML comparison grid. Then screenshot with scripts/shot-file.mjs.
import { writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const GREY = "#52626F";
const RED = "#D6071A";

const concepts = ["crown", "shield", "chat"];

const styles = [
  { key: "solar-bd", label: "Solar Bold Duotone", ids: { crown: "solar:crown-bold-duotone", shield: "solar:shield-check-bold-duotone", chat: "solar:chat-round-dots-bold-duotone" } },
  { key: "solar-ld", label: "Solar Line Duotone", ids: { crown: "solar:crown-line-duotone", shield: "solar:shield-check-line-duotone", chat: "solar:chat-round-dots-line-duotone" } },
  { key: "ph-duo", label: "Phosphor Duotone", ids: { crown: "ph:crown-duotone", shield: "ph:shield-check-duotone", chat: "ph:chat-circle-dots-duotone" } },
  { key: "ph-bold", label: "Phosphor Bold (mono)", ids: { crown: "ph:crown-bold", shield: "ph:shield-check-bold", chat: "ph:chat-circle-dots-bold" } },
  { key: "tabler", label: "Tabler Filled (mono)", ids: { crown: "tabler:crown", shield: "tabler:shield-check", chat: "tabler:message-dots" } },
  { key: "solar-bold", label: "Solar Bold (плътна моно)", ids: { crown: "solar:crown-bold", shield: "solar:shield-check-bold", chat: "solar:chat-round-dots-bold" } },
];

function colorizeTag(tag) {
  // secondary tone = anything with reduced opacity → red, else grey
  const m = tag.match(/(?:fill-)?opacity="?([0-9.]+)"?/);
  const isSecondary = m && parseFloat(m[1]) < 1;
  const color = isSecondary ? RED : GREY;
  let t = tag.replace(/currentColor/g, color);
  // make secondary solid
  t = t.replace(/\s(?:fill-)?opacity="?[0-9.]+"?/g, "");
  const hasStroke = /stroke="(?!none)/.test(t);
  const fillNone = /fill="none"/.test(t);
  if (hasStroke && fillNone) {
    t = t.replace(/stroke="[^"]*"/, `stroke="${color}"`);
  } else if (fillNone && hasStroke) {
    t = t.replace(/stroke="[^"]*"/, `stroke="${color}"`);
  } else if (/fill="/.test(t)) {
    t = t.replace(/fill="[^"]*"/, `fill="${color}"`);
  } else {
    t = t.replace(/<(path|circle|rect|ellipse|polygon|polyline)\b/, `<$1 fill="${color}"`);
  }
  return t;
}

function recolor(svg) {
  let s = svg.replace(/<(path|circle|rect|ellipse|polygon|polyline)\b[^>]*?\/?>/g, colorizeTag);
  s = s.replace(/currentColor/g, GREY);
  return s;
}

async function fetchSvg(id) {
  const [prefix, name] = id.split(":");
  const url = `https://api.iconify.design/${prefix}/${name}.svg`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const txt = await res.text();
  if (!txt.includes("<svg") || txt.length < 40) return null;
  return txt;
}

const dir = join(tmpdir(), "icon_cmp");
mkdirSync(dir, { recursive: true });

let cells = [];
for (const st of styles) {
  for (const c of concepts) {
    const id = st.ids[c];
    let svg = await fetchSvg(id);
    let ok = !!svg;
    if (svg) {
      svg = recolor(svg).replace(/<svg /, '<svg style="width:44px;height:44px" ');
      writeFileSync(join(dir, `${st.key}_${c}.svg`), svg);
    }
    cells.push({ st, c, id, ok });
  }
}

const chip = (inner) => `<div style="display:inline-flex;height:64px;width:64px;align-items:center;justify-content:center;border-radius:16px;background:rgba(82,98,111,.10)">${inner}</div>`;

let rows = styles.map((st) => {
  const tds = concepts.map((c) => {
    const found = cells.find((x) => x.st.key === st.key && x.c === c);
    const inner = found.ok
      ? `<img src="file:///${join(dir, `${st.key}_${c}.svg`).replace(/\\/g, "/")}" style="height:44px;width:44px">`
      : `<span style="color:#bbb;font-size:11px">N/A</span>`;
    return `<td style="padding:10px;text-align:center">${chip(inner)}</td>`;
  }).join("");
  return `<tr><td style="padding:10px 16px;color:#52626F;font:600 13px Segoe UI,sans-serif;white-space:nowrap">${st.label}</td>${tds}</tr>`;
}).join("");

const head = `<tr><td></td>${concepts.map((c) => `<td style="text-align:center;color:#52626F;font:600 13px Segoe UI">${c}</td>`).join("")}</tr>`;

const html = `<!doctype html><html><body style="margin:0;background:#eef2f5;padding:24px">
<table style="border-collapse:collapse;background:#fff;border-radius:16px;padding:8px">${head}${rows}</table>
</body></html>`;

writeFileSync(join(dir, "compare.html"), html);
console.log("FILE:" + join(dir, "compare.html"));
console.log("Failed:", cells.filter((x) => !x.ok).map((x) => x.id).join(", ") || "none");
