import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const base = process.argv[2] || "http://localhost:3100";
const out = process.argv[3];
const b = await pw.chromium.launch();
const ctx = await b.newContext({ ...pw.devices["iPhone 13"], reducedMotion: "reduce" });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(`${base}/demo`);
await p.waitForSelector(".pl-scene[data-phase='closed']");
await p.locator(".pl-scene").click();
const t0 = Date.now();
await p.waitForSelector(".pl-scroll[data-visible='true']", { timeout: 5000 });
console.log("reduced-motion: content visible after", Date.now() - t0, "ms");
await p.waitForTimeout(300);
console.log("names visible immediately:", await p.locator(".pl-name").first().evaluate((e) => getComputedStyle(e).opacity));
await p.screenshot({ path: out });
await b.close();
