// Screenshot a local file:// URL. Usage: node scripts/shot-file.mjs <fileUrl> <out> [w] [h]
import { chromium } from "playwright";

const url = process.argv[2];
const out = process.argv[3] ?? "file-shot.png";
const width = Number(process.argv[4] ?? 800);
const height = Number(process.argv[5] ?? 260);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
  console.log(`Saved ${out}`);
} catch (e) {
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
