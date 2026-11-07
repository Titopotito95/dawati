// Dev helper: scrubs the opening timeline and saves frames (requires `npm run dev`).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const out = process.argv[2] || "./frames";
const url = process.argv[3] || "http://localhost:3000/demo";
const times = (process.argv[4] || "0,0.3,0.7,1.0,1.4,1.8,2.2,2.6,3.0,3.5,4.2").split(",").map(Number);
const vw = Number(process.env.VW || 390), vh = Number(process.env.VH || 844);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__plTl, null, { timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/closed.png` });
await page.evaluate(() => { window.__plIdle = true; });
// start opening via click then immediately pause and scrub
await page.mouse.click(vw / 2, vh / 2);
await page.waitForTimeout(50);
for (const t of times) {
  await page.evaluate((t) => { const tl = window.__plTl; tl.pause(); tl.time(t); }, t);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${out}/t_${t.toFixed(2)}.png` });
}
await page.evaluate(() => { const tl = window.__plTl; tl.play(); tl.timeScale(4); });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/open_written.png` });
await page.evaluate(() => { const s = document.querySelector(".pl-scroll"); s.style.scrollBehavior = "auto"; s.scrollTop = s.clientHeight * 0.9; });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/scroll1.png` });
await page.evaluate(() => { const s = document.querySelector(".pl-scroll"); s.scrollTop = s.clientHeight * 1.9; });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/scroll2.png` });
await page.evaluate(() => { const s = document.querySelector(".pl-scroll"); s.scrollTop = s.clientHeight * 2.9; });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/scroll3.png` });
await page.evaluate(() => { const s = document.querySelector(".pl-scroll"); s.scrollTop = s.scrollHeight; });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/scroll4.png` });
await browser.close();
console.log("saved frames to", out);
