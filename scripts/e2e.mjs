/**
 * End-to-end walkthrough of the whole business in a real Chromium (Playwright):
 *   owner setup + MFA → affiliate → in-person sale (token) → customer edits + guests →
 *   guest opens invitation on an iPhone-sized screen and RSVPs → customer sees RSVP →
 *   affiliate sees commission → owner approves + records payout → affiliate sees payout.
 *
 * Requires a FRESH database and the dev server started with OWNER_SETUP_TOKEN:
 *   OWNER_SETUP_TOKEN=local-dev-setup-token-123456 npm run dev
 *   npm run test:e2e
 */
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require("/opt/node22/lib/node_modules/playwright");
}
const BASE = process.env.E2E_BASE || "http://localhost:3000";
const SETUP = process.env.OWNER_SETUP_TOKEN || "local-dev-setup-token-123456";
const OUT = process.env.E2E_OUT || "./test-results/e2e";
fs.mkdirSync(OUT, { recursive: true });

function totp(secret, step) {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secret) bits += B32.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
const step = () => Math.floor(Date.now() / 30000);
let n = 0;
const shot = async (page, name) => page.screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: false });
const ok = (cond, msg) => {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  ✓", msg);
};
const secretText = async (page) => (await page.locator("p.mono.select-all").last().innerText()).trim();

const browser = await pw.chromium.launch();
try {
  // ---------------------------------------------------------------- owner
  console.log("owner setup + login (password + TOTP)");
  const owner = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  owner.on("pageerror", (e) => console.log("  [owner pageerror]", e.message));
  await owner.goto(`${BASE}/owner/setup`);
  await owner.fill('input[name="setupToken"]', SETUP);
  await owner.fill('input[name="username"]', "owner");
  await owner.fill('input[name="password"]', "Pearl-Lace-2027-secure");
  await owner.fill('input[name="password2"]', "Pearl-Lace-2027-secure");
  await owner.click('button[type="submit"]');
  await owner.waitForSelector("text=أو أدخل المفتاح يدوياً");
  const secret = (await owner.locator("span.mono.select-all").innerText()).trim();
  const s0 = step();
  await owner.fill('input[name="code"]', totp(secret, s0));
  await owner.click('button[type="submit"]');
  await owner.waitForURL(/\/owner\?ready=1/);
  await owner.fill('input[name="username"]', "owner");
  await owner.fill('input[name="password"]', "Pearl-Lace-2027-secure");
  await owner.fill('input[name="code"]', totp(secret, s0 + 1));
  await owner.click('button[type="submit"]');
  await owner.waitForURL(/\/owner\/dashboard$/);
  ok(true, "owner logged in with MFA");

  console.log("owner creates the Libya representative");
  await owner.goto(`${BASE}/owner/dashboard/affiliates`);
  await owner.fill('input[name="name"]', "ممثلنا في ليبيا");
  await owner.fill('input[name="code"]', "LIBYA001");
  await owner.fill('input[name="phone"]', "0912345678");
  await owner.check('input[name="canIssue"]');
  await owner.click('button:has-text("إنشاء المسوق وإصدار رمزه")');
  await owner.waitForSelector("text=رمز دخول المسوق");
  const affToken = await secretText(owner);
  ok(affToken.startsWith("dwa_"), "affiliate token issued once");

  console.log("owner records an in-person sale credited to the rep (guest limit 5)");
  await owner.goto(`${BASE}/owner/dashboard/orders`);
  await owner.fill('input[name="customerName"]', "عائلة الأستاذ سالم");
  await owner.fill('input[name="customerPhone"]', "0920000000");
  await owner.fill('input[name="guestLimit"]', "5");
  const affOpt = await owner.locator('select[name="affiliateId"] option').nth(1).getAttribute("value");
  await owner.selectOption('select[name="affiliateId"]', affOpt);
  await owner.click('button:has-text("إصدار الرمز")');
  await owner.waitForSelector("text=رمز دخول العميل إلى لوحة دعوته");
  const custToken = await secretText(owner);
  ok(custToken.startsWith("dwc_"), "customer token issued after cash sale");
  await shot(owner, "owner-issued-token");

  // ---------------------------------------------------------------- customer
  console.log("customer redeems token, edits invitation, adds guests");
  const custCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const cust = await custCtx.newPage();
  cust.on("pageerror", (e) => console.log("  [customer pageerror]", e.message));
  await cust.goto(`${BASE}/access`);
  await cust.fill('input[name="token"]', custToken.toUpperCase().replace("DWC_", "dwc_"));
  await cust.click('button:has-text("الدخول إلى لوحة دعوتي")');
  await cust.waitForURL(/\/dashboard$/);
  ok(await cust.locator("text=تهانينا! دعوتك جاهزة للتخصيص").isVisible(), "customer dashboard unlocked by token only");
  const ls = await cust.evaluate(() => JSON.stringify(localStorage) + document.cookie);
  ok(!ls.includes("dwc_"), "token not stored in localStorage or readable cookies");
  await cust.goto(`${BASE}/dashboard/edit`);
  const fields = cust.locator("section").first().locator("input.field");
  await fields.nth(0).fill("يوسف");
  await fields.nth(1).fill("مريم");
  await fields.nth(2).fill("ي م");
  await cust.locator('input[type="date"]').fill("2027-06-12");
  await cust.locator('input[type="time"]').fill("20:30");
  await cust.locator("label:has-text('اسم القاعة') input").fill("قاعة الياسمين");
  await cust.locator("label:has-text('العنوان') input").fill("طرابلس — حي الأندلس");
  await cust.click('button:has-text("حفظ التغييرات")');
  await cust.waitForSelector("text=تم حفظ التغييرات");
  ok(true, "invitation content saved");
  await shot(cust, "customer-editor");

  await cust.goto(`${BASE}/dashboard/guests`);
  await cust.fill("textarea", "الأستاذ أحمد وعائلته\nالحاجة فاطمة\nعائلة المهدي");
  await cust.click('button:has-text("إضافة القائمة")');
  await cust.waitForSelector("text=تمت إضافة 3");
  await cust.fill("textarea", "ضيف 4\nضيف 5\nضيف 6");
  await cust.click('button:has-text("إضافة القائمة")');
  await cust.waitForSelector("text=باقتك تسمح بإضافة 2");
  ok(true, "guest limit from the sale is enforced (5)");
  await shot(cust, "customer-guests");

  await cust.goto(`${BASE}/dashboard/links`);
  const firstUrl = (await cust.locator("p.mono").first().innerText()).trim();
  ok(/\/i\/[A-Za-z0-9_-]{43}$/.test(firstUrl), "unique high-entropy guest link generated: " + firstUrl.slice(0, 40) + "…");
  ok(!firstUrl.includes(encodeURIComponent("أحمد")), "guest link does not contain the guest name");
  await shot(cust, "customer-links");

  // ---------------------------------------------------------------- guest on a phone
  console.log("guest opens the link on an iPhone-sized screen");
  const iphone = pw.devices["iPhone 13"];
  const guestCtx = await browser.newContext({ ...iphone });
  const guest = await guestCtx.newPage();
  guest.on("pageerror", (e) => console.log("  [guest pageerror]", e.message));
  await guest.goto(firstUrl.replace(/^https?:\/\/[^/]+/, BASE));
  await guest.waitForSelector(".pl-scene[data-phase='closed']", { timeout: 20000 });
  await guest.waitForTimeout(600);
  await shot(guest, "guest-closed-envelope");
  ok(await guest.locator("text=إلى: الأستاذ أحمد وعائلته").isVisible(), "closed envelope shows the guest's own name");
  await guest.locator(".pl-scene").click();
  await guest.waitForTimeout(1300);
  await shot(guest, "guest-opening-1300ms");
  await guest.waitForSelector(".pl-scroll[data-visible='true']", { timeout: 15000 });
  await guest.waitForTimeout(3200);
  await shot(guest, "guest-card-written");
  ok(await guest.locator(".pl-hero >> text=يوسف").isVisible(), "personalized names on the card");
  ok(await guest.locator(".pl-guest-name", { hasText: "الأستاذ أحمد وعائلته" }).isVisible(), "guest name on the card");
  await guest.locator('button:has-text("سأحضر بإذن الله")').scrollIntoViewIfNeeded();
  await guest.waitForTimeout(900);
  await guest.locator('button:has-text("سأحضر بإذن الله")').click();
  await guest.waitForSelector("text=تم تأكيد حضوركم");
  await shot(guest, "guest-rsvp-saved");
  ok(true, "guest RSVP 'سأحضر بإذن الله' saved");

  // guest token must never unlock a dashboard
  const tokenOnly = firstUrl.split("/i/")[1];
  const probe = await (await browser.newContext()).newPage();
  await probe.goto(`${BASE}/access`);
  await probe.fill('input[name="token"]', tokenOnly);
  await probe.click('button:has-text("الدخول إلى لوحة دعوتي")');
  await probe.waitForSelector("text=رمز الدخول غير صحيح");
  ok(true, "guest link token is rejected as a dashboard token");

  // ---------------------------------------------------------------- customer sees RSVP
  await cust.goto(`${BASE}/dashboard/rsvp`);
  const accepted = await cust.locator(".card:has-text('المؤكد حضورهم') p.text-2xl").innerText();
  ok(accepted.trim() === "1", "customer sees the new RSVP (1 accepted)");

  // ---------------------------------------------------------------- affiliate
  console.log("affiliate sees the sale and 15% commission, and nothing private");
  const aff = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await aff.goto(`${BASE}/affiliate`);
  await aff.fill('input[name="token"]', affToken);
  await aff.click('button[type="submit"]');
  await aff.waitForURL(/\/affiliate\/dashboard$/);
  const body = await aff.locator("main").innerText();
  ok(body.includes("52.5 د.ل"), "affiliate sees 52.5 LYD pending commission on a 350 LYD sale");
  ok(!body.includes("0920000000") && !body.includes("عائلة الأستاذ سالم") && !body.includes("dwc_"), "affiliate sees no customer name, phone or token");
  await shot(aff, "affiliate-dashboard");
  const ownerAsAff = await aff.goto(`${BASE}/owner/dashboard`);
  ok(aff.url().endsWith("/owner"), "affiliate session cannot open the owner CRM");
  void ownerAsAff;

  // ---------------------------------------------------------------- owner approves and pays
  console.log("owner approves the commission and records an offline payout");
  await owner.goto(`${BASE}/owner/dashboard/commissions`);
  await owner.click('button:has-text("اعتماد العمولات المحددة")');
  await owner.waitForSelector("text=تم اعتماد 1");
  await owner.goto(`${BASE}/owner/dashboard/payments`);
  await owner.fill('input[name="reference"]', "إيصال نقدي رقم 1");
  owner.once("dialog", (d) => d.accept());
  await owner.click('button:has-text("تسجيل الدفعة")');
  await owner.waitForSelector("text=لا يحوّل أي أموال");
  await owner.goto(`${BASE}/owner/dashboard`);
  await shot(owner, "owner-overview");
  await aff.goto(`${BASE}/affiliate/dashboard/payouts`);
  ok((await aff.locator("main").innerText()).includes("52.5 د.ل"), "affiliate sees the recorded payout");

  console.log("\nALL E2E CHECKS PASSED — screenshots in", OUT);
} catch (e) {
  console.error(e);
  for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await pg.screenshot({ path: `${OUT}/failure-${Math.random().toString(36).slice(2, 7)}.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
