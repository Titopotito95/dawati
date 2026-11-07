import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const out = process.argv[2]; const url = process.argv[3] || "http://localhost:3000/demo";
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__plTl, null, { timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/hero_closed.png` });
await page.mouse.click(195, 422);
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/hero_written.png` });
await browser.close();
