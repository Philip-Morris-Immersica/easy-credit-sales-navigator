// Generate brand-coloured Solar "Line Duotone" SVGs for every concept used in tree.ts.
// Grey line (#52626F, bolder) + red duotone accent (#D6071A). Saved to public/icons2/<LucideName>.svg
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const GREY = "#52626F";
const RED = "#D6071A";
const OUT = "public/icons2";

// LucideName -> ordered candidate Solar names + a search fallback term
const MAP = {
  ClipboardList: { c: ["solar:clipboard-list-line-duotone", "solar:clipboard-text-line-duotone", "solar:checklist-minimalistic-line-duotone"], q: "clipboard list" },
  UserX: { c: ["solar:user-cross-rounded-line-duotone", "solar:user-block-rounded-line-duotone", "solar:user-block-line-duotone"], q: "user block" },
  UserCheck: { c: ["solar:user-check-rounded-line-duotone", "solar:user-check-line-duotone"], q: "user check" },
  RefreshCw: { c: ["solar:refresh-line-duotone", "solar:refresh-circle-line-duotone"], q: "refresh" },
  Lightbulb: { c: ["solar:lightbulb-line-duotone", "solar:lightbulb-bolt-line-duotone"], q: "lightbulb" },
  ListOrdered: { c: ["solar:list-check-line-duotone", "solar:checklist-minimalistic-line-duotone", "solar:list-line-duotone"], q: "checklist" },
  DoorOpen: { c: ["solar:door-line-duotone", "solar:exit-line-duotone", "solar:login-2-line-duotone"], q: "door" },
  Target: { c: ["solar:target-line-duotone"], q: "target" },
  ShieldCheck: { c: ["solar:shield-check-line-duotone"], q: "shield check" },
  CheckCircle: { c: ["solar:check-circle-line-duotone"], q: "check circle" },
  Drama: { c: ["solar:masks-line-duotone", "solar:theater-line-duotone", "solar:clapperboard-play-line-duotone"], q: "mask theater" },
  Heart: { c: ["solar:heart-line-duotone"], q: "heart" },
  BadgeCheck: { c: ["solar:verified-check-line-duotone", "solar:medal-ribbon-star-line-duotone", "solar:diploma-verified-line-duotone"], q: "verified" },
  Megaphone: { c: ["solar:megaphone-line-duotone", "solar:speaker-line-duotone"], q: "megaphone" },
  Armchair: { c: ["solar:armchair-line-duotone", "solar:armchair-2-line-duotone"], q: "armchair" },
  Share2: { c: ["solar:share-line-duotone", "solar:share-circle-line-duotone"], q: "share" },
  Flame: { c: ["solar:fire-line-duotone", "solar:fire-square-line-duotone"], q: "fire" },
  BarChart2: { c: ["solar:chart-2-line-duotone", "solar:chart-line-duotone"], q: "chart" },
  HelpCircle: { c: ["solar:question-circle-line-duotone"], q: "question circle" },
  Ban: { c: ["solar:forbidden-circle-line-duotone", "solar:forbidden-line-duotone"], q: "forbidden" },
  Crown: { c: ["solar:crown-line-duotone", "solar:crown-star-line-duotone"], q: "crown" },
  Shuffle: { c: ["solar:shuffle-line-duotone", "solar:reorder-line-duotone", "solar:transfer-horizontal-line-duotone"], q: "shuffle" },
  Eye: { c: ["solar:eye-line-duotone", "solar:eye-scan-line-duotone"], q: "eye" },
  GitBranch: { c: ["solar:branching-paths-up-line-duotone", "solar:routing-2-line-duotone", "solar:routing-line-duotone"], q: "routing branch" },
  Zap: { c: ["solar:bolt-line-duotone", "solar:bolt-circle-line-duotone"], q: "bolt" },
  MessageCircle: { c: ["solar:chat-round-line-duotone", "solar:chat-round-dots-line-duotone"], q: "chat round" },
  Users: { c: ["solar:users-group-rounded-line-duotone", "solar:users-group-two-rounded-line-duotone"], q: "users group" },
  Phone: { c: ["solar:phone-line-duotone", "solar:phone-calling-rounded-line-duotone"], q: "phone" },
  Rocket: { c: ["solar:rocket-line-duotone", "solar:rocket-2-line-duotone"], q: "rocket" },
  Reply: { c: ["solar:reply-line-duotone", "solar:undo-left-round-line-duotone", "solar:arrow-left-line-duotone"], q: "reply" },
  Search: { c: ["solar:magnifer-line-duotone", "solar:magnifer-zoom-in-line-duotone"], q: "magnifer" },
  FileText: { c: ["solar:document-text-line-duotone", "solar:document-line-duotone"], q: "document text" },
  Building: { c: ["solar:buildings-line-duotone", "solar:buildings-2-line-duotone", "solar:building-line-duotone"], q: "buildings" },
  PlusCircle: { c: ["solar:add-circle-line-duotone"], q: "add circle" },
  ArrowRightLeft: { c: ["solar:transfer-horizontal-line-duotone", "solar:round-transfer-horizontal-line-duotone", "solar:refresh-square-line-duotone"], q: "transfer horizontal" },
  Home: { c: ["solar:home-line-duotone", "solar:home-2-line-duotone", "solar:home-smile-line-duotone"], q: "home" },
};

async function get(id) {
  const [p, n] = id.split(":");
  const r = await fetch(`https://api.iconify.design/${p}/${n}.svg`);
  if (!r.ok) return null;
  const t = await r.text();
  if (!t.includes("<svg") || t.length < 60) return null;
  return t;
}

async function resolve(entry) {
  for (const id of entry.c) { const s = await get(id); if (s) return { id, svg: s }; }
  const r = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(entry.q)}&prefix=solar&limit=48`);
  if (r.ok) {
    const j = await r.json();
    const hit = (j.icons || []).find((x) => x.includes("line-duotone")) || (j.icons || [])[0];
    if (hit) { const s = await get(hit); if (s) return { id: hit, svg: s }; }
  }
  return null;
}

function recolor(svg) {
  let s = svg.replace(/currentColor/g, GREY);
  s = s.replace(/<(path|circle|rect|ellipse|line|polygon|polyline)\b[^>]*?\/?>/g, (tag) => {
    if (!/\b(fill-)?opacity="?(0?\.\d+)"?/.test(tag)) return tag;
    let t = tag.replace(/\s(fill-)?opacity="?[0-9.]+"?/g, "");
    if (/stroke="#52626F"/.test(t)) t = t.replace(/stroke="#52626F"/g, `stroke="${RED}"`);
    else if (/fill="#52626F"/.test(t)) t = t.replace(/fill="#52626F"/g, `fill="${RED}"`);
    else t = t.replace(/<(\w+)/, `<$1 stroke="${RED}"`);
    return t;
  });
  s = s.replace(/stroke-width="1\.5"/g, 'stroke-width="2.2"');
  s = s.replace(/stroke-width="2"/g, 'stroke-width="2.6"');
  s = s.replace(/width="1em"/, 'width="24"').replace(/height="1em"/, 'height="24"');
  return s;
}

mkdirSync(OUT, { recursive: true });
const used = [];
const failed = [];
for (const [name, entry] of Object.entries(MAP)) {
  const res = await resolve(entry);
  if (!res) { failed.push(name); continue; }
  writeFileSync(join(OUT, `${name}.svg`), recolor(res.svg));
  used.push({ name, id: res.id });
}

console.log("USED:");
for (const u of used) console.log(`  ${u.name} <- ${u.id}`);
console.log("FAILED:", failed.join(", ") || "none");
console.log("\nSET = [" + used.map((u) => `"${u.name}"`).join(", ") + "]");
