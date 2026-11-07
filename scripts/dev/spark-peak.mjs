// Dev helper: freeze every sparkle at its peak to judge the material look.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const [url, out] = process.argv.slice(2);
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForSelector(".pl-scene[data-phase='closed']");
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/natural.png` });
await p.addStyleTag({ content: ".pl-spark{animation:none!important;opacity:.95!important;transform:scale(1) rotate(15deg)!important}.pl-sweep{animation:none!important;transform:translate3d(-8%,0,12px)!important}" });
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/peak.png` });
await b.close();
