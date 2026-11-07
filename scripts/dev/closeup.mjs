// Dev helper: high-DPR close-ups of the closed envelope at several moments (sparkles / sweep / gloss)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [url, out] = process.argv.slice(2);
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForSelector(".pl-scene[data-phase='closed']");
for (const t of [1500, 2600, 3700]) {
  await p.waitForTimeout(t === 1500 ? 1500 : 1100);
  await p.screenshot({ path: `${out}/closeup_${t}.png` });
}
await b.close();
