// Quick visual-diff helper: screenshots a running-app route at a given viewport.
// Usage: node scripts/shot.mjs [path] [outfile] [port] [width] [height]
//   node scripts/shot.mjs /call/steps/opening app.png 3000 1920 1080
import { chromium } from "playwright";

const path = process.argv[2] ?? "/call/steps/opening";
const out = process.argv[3] ?? "app-shot.png";
const port = process.argv[4] ?? "3000";
const width = Number(process.argv[5] ?? 1280);
const height = Number(process.argv[6] ?? 720);
const url = `http://localhost:${port}${path}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out });
  console.log(`Saved ${out} from ${url}`);
} catch (e) {
  console.error("Screenshot failed:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
