// Dev helper: node scripts/dev/shot.mjs <url> <out.png> [width] [height] [full]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [url, out, w = "390", h = "844", full] = process.argv.slice(2);
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForTimeout(2200);
await p.screenshot({ path: out, fullPage: full === "full" });
console.log("scrollWidth", await p.evaluate(() => document.documentElement.scrollWidth), "viewport", w);
await b.close();
