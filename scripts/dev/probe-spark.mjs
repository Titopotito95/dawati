import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto("http://localhost:3000/demo", { waitUntil: "networkidle" });
await p.waitForSelector(".pl-scene[data-phase='closed']");
await p.waitForTimeout(1500);
console.log(await p.evaluate(() => {
  const s = [...document.querySelectorAll(".pl-scene .pl-spark")];
  const info = s.slice(0, 4).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { w: r.width.toFixed(1), x: r.x.toFixed(0), y: r.y.toFixed(0), op: cs.opacity, anim: cs.animationName, width: cs.width }; });
  const maxOp = Math.max(...s.map((e) => +getComputedStyle(e).opacity));
  return JSON.stringify({ count: s.length, maxOp, info });
}));
await b.close();
