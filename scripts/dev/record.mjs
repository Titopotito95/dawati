// Dev helper: records the guest experience on an iPhone-sized screen → webm (convert with ffmpeg).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [url, dir] = process.argv.slice(2);
const b = await pw.chromium.launch();
const ctx = await b.newContext({ viewport: { width: 540, height: 1170 }, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 540, height: 1170 } } });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForSelector(".pl-scene[data-phase='closed']");
await p.waitForTimeout(3200);
await p.mouse.click(270, 650);
await p.waitForTimeout(7600);
for (let i = 0; i < 60; i++) {
  await p.evaluate(() => { const s = document.querySelector(".pl-scroll"); s.style.scrollBehavior = "auto"; s.scrollTop += 22; });
  await p.waitForTimeout(40);
}
await p.waitForTimeout(1500);
await ctx.close();
await b.close();
