import { beforeAll, describe, expect, it } from "vitest";
import { getDb, __resetDbForTests, type Db } from "@/lib/db";
import { listThemes } from "@/lib/services/catalog";
import { issueCustomerAccess, resolveCustomerToken, recordRefund, ownerReissueCustomerToken, setGuestLimit, type IssueInput } from "@/lib/services/orders";
import { createAffiliate, recordReferralVisit, resolveAffiliateToken, affiliateOrders, affiliateSummary, updateAffiliate } from "@/lib/services/affiliates";
import { randomId } from "@/lib/security/tokens";
import { approveCommissions, recordPayout } from "@/lib/services/commissions";
import { addGuests, listGuests, resolveGuestLink, submitRsvp, updateGuest, reissueGuestLink, rsvpStats, deleteGuest } from "@/lib/services/guests";
import { getWorkspace, saveInvitation } from "@/lib/services/workspace";
import { beginOwnerSetup, completeOwnerSetup, ownerLogin } from "@/lib/services/owner";
import { totpAt } from "@/lib/security/totp";
import { commissionFor, parseMajorToMinor, formatMoney } from "@/lib/money";
import { normalizeSecret, newSecret } from "@/lib/security/tokens";

let db: Db;
let ownerId = "00000000-0000-0000-0000-000000000000";
const BASE = "https://example.test";

function issueInput(over: Partial<IssueInput> = {}): IssueInput {
  return { issuer: { type: "owner", id: ownerId }, customerName: "عميل تجريبي", themeSlug: "pearl-lace", variantKey: "white", guestLimit: 50, idempotencyKey: randomId(18), ...over };
}

async function paidWorkspace(over: Partial<IssueInput> = {}) {
  const r = await issueCustomerAccess(db, issueInput(over));
  if (r.kind !== "issued") throw new Error("expected issued");
  const ws = await getWorkspace(db, r.workspaceId);
  return { order: r, ws: ws! };
}

function tokenFromUrl(url: string) {
  return url.split("/i/")[1];
}

beforeAll(async () => {
  __resetDbForTests();
  db = await getDb();
  const s = await beginOwnerSetup(db, "owner", "correct horse 12345");
  await completeOwnerSetup(db, s.ownerId, totpAt(s.secret, Math.floor(Date.now() / 30000)));
  ownerId = s.ownerId;
  (globalThis as { __ownerSecret?: string }).__ownerSecret = s.secret;
});

describe("money", () => {
  it("computes 15% commission exactly in minor units", () => {
    expect(commissionFor(100_000, 1500)).toBe(15_000); // 100 LYD → 15 LYD
    expect(commissionFor(200_000, 1500)).toBe(30_000); // 200 LYD → 30 LYD
    expect(commissionFor(350_000, 1500)).toBe(52_500); // 350 LYD → 52.5 LYD
    expect(commissionFor(-175_000, 1500)).toBe(-26_250);
    expect(commissionFor(1, 1500)).toBe(0);
    expect(commissionFor(3, 5000)).toBe(2); // half-up
    expect(parseMajorToMinor("350", "LYD")).toBe(350_000);
    expect(parseMajorToMinor("٥٢٫٥", "LYD")).toBe(52_500);
    expect(parseMajorToMinor("1.2345", "LYD")).toBeNull();
    expect(formatMoney(52_500, "LYD")).toBe("52.5 د.ل");
  });
});

describe("token types are not interchangeable", () => {
  it("rejects a secret of the wrong type and accepts formatted input", () => {
    const c = newSecret("customer");
    expect(normalizeSecret(c.raw, "affiliate")).toBeNull();
    expect(normalizeSecret(c.raw, "receipt")).toBeNull();
    const pretty = c.raw.slice(0, 4) + c.raw.slice(4).toUpperCase().match(/.{1,4}/g)!.join("-");
    expect(normalizeSecret(" " + pretty + " ", "customer")).toBe(c.raw);
  });
});

describe("catalog", () => {
  it("has theme #1 at 350 LYD with curated variants", async () => {
    const themes = await listThemes(db);
    const t = themes.find((x) => x.slug === "pearl-lace")!;
    expect(t.priceMinor).toBe(350_000);
    expect(t.currency).toBe("LYD");
    expect(t.variants.map((v) => v.key)).toEqual(["white", "ivory", "champagne"]);
  });
});

describe("in-person sales → customer token (no online payment)", () => {
  it("owner issues a token with a guest limit: exactly one sale, payment, workspace and token (idempotent)", async () => {
    const key = randomId(18);
    const [a, b] = await Promise.all([issueCustomerAccess(db, issueInput({ idempotencyKey: key, guestLimit: 120 })), issueCustomerAccess(db, issueInput({ idempotencyKey: key, guestLimit: 120 }))]);
    const kinds = [a.kind, b.kind].sort();
    expect(kinds).toEqual(["duplicate", "issued"]);
    const issued = (a.kind === "issued" ? a : b) as Extract<typeof a, { kind: "issued" }>;
    const c = await db.query<Record<string, number>>(
      `select (select count(*)::int from orders where idempotency_key = $1) as o,
              (select count(*)::int from payments p join orders o on o.id = p.order_id where o.idempotency_key = $1) as p,
              (select count(*)::int from customer_workspaces w join orders o on o.id = w.order_id where o.idempotency_key = $1) as w,
              (select amount_minor from orders where idempotency_key = $1) as amt,
              (select guest_limit from invitations where workspace_id = $2) as lim`,
      [key, issued.workspaceId],
    );
    expect(c.rows[0]).toMatchObject({ o: 1, p: 1, w: 1, amt: 350_000, lim: 120 });
    expect(await resolveCustomerToken(db, issued.token)).toEqual({ workspaceId: issued.workspaceId });
  });

  it("an affiliate WITHOUT permission cannot issue tokens; a trusted one can and earns exactly 15%", async () => {
    const plain = await createAffiliate(db, { name: "مسوق عادي", referralCode: "PLAIN001" }, ownerId);
    await expect(issueCustomerAccess(db, issueInput({ issuer: { type: "affiliate", id: plain.affiliateId } }))).rejects.toThrow("غير مصرح");
    const { affiliateId, token } = await createAffiliate(db, { name: "ممثل ليبيا", referralCode: "LIBYA001", rateBps: 1500, canIssueTokens: true }, ownerId);
    const r = await issueCustomerAccess(db, issueInput({ issuer: { type: "affiliate", id: affiliateId }, guestLimit: 200 }));
    expect(r.kind).toBe("issued");
    const sum = await affiliateSummary(db, affiliateId);
    expect(sum).toMatchObject({ paidOrders: 1, pendingMinor: 52_500, eligibleMinor: 350_000 });
    const pay = await db.query<{ received_by_type: string; remitted_at: Date | null }>(`select received_by_type, remitted_at from payments where order_id = $1`, [(r as { orderId: string }).orderId]);
    expect(pay.rows[0]).toMatchObject({ received_by_type: "affiliate", remitted_at: null });
    expect(await resolveAffiliateToken(db, token)).toEqual({ affiliateId });
    expect(await recordReferralVisit(db, "libya001", "visitor-1", "/")).toBe(true);
  });

  it("owner can credit a representative; the commission uses the amount actually received", async () => {
    const { affiliateId } = await createAffiliate(db, { name: "ممثل بنغازي", referralCode: "BENGHAZI" }, ownerId);
    const r = await issueCustomerAccess(db, issueInput({ affiliateId, amountMinor: 200_000 }));
    const c = await db.query<{ amount_minor: number; basis_minor: number }>(`select amount_minor, basis_minor from commission_records where order_id = $1`, [(r as { orderId: string }).orderId]);
    expect(c.rows[0]).toEqual({ amount_minor: 30_000, basis_minor: 200_000 });
  });

  it("a sale with no representative creates no commission", async () => {
    const r = await issueCustomerAccess(db, issueInput());
    const c = await db.query<{ c: number }>(`select count(*)::int as c from commission_records where order_id = $1`, [(r as { orderId: string }).orderId]);
    expect(c.rows[0].c).toBe(0);
  });

  it("lost token: owner reissue replaces it and the old token stops working", async () => {
    const r = (await issueCustomerAccess(db, issueInput())) as { token: string; workspaceId: string };
    const fresh = await ownerReissueCustomerToken(db, r.workspaceId, ownerId);
    expect(await resolveCustomerToken(db, r.token)).toHaveProperty("error");
    expect(await resolveCustomerToken(db, fresh)).toEqual({ workspaceId: r.workspaceId });
  });

  it("changing an affiliate's rate does not rewrite past commissions", async () => {
    const { affiliateId } = await createAffiliate(db, { name: "تغيير النسبة", referralCode: "RATE0001" }, ownerId);
    await issueCustomerAccess(db, issueInput({ affiliateId }));
    await updateAffiliate(db, affiliateId, { rateBps: 2000 }, ownerId);
    await issueCustomerAccess(db, issueInput({ affiliateId }));
    const r = await db.query<{ amount_minor: number }>(`select amount_minor from commission_records where affiliate_id = $1 order by created_at`, [affiliateId]);
    expect(r.rows.map((x) => x.amount_minor)).toEqual([52_500, 70_000]);
  });
});

describe("isolation", () => {
  it("customer A cannot touch customer B's guests even with B's real ids", async () => {
    const A = await paidWorkspace();
    const B = await paidWorkspace();
    await addGuests(db, B.ws.invitationId, ["ضيف العميل ب"], 1, B.ws.workspaceId);
    const bGuests = await listGuests(db, B.ws.invitationId, BASE);
    await expect(updateGuest(db, A.ws.invitationId, bGuests[0].id, { name: "اختراق" })).rejects.toThrow("الضيف غير موجود");
    await expect(deleteGuest(db, A.ws.invitationId, bGuests[0].id, A.ws.workspaceId)).rejects.toThrow("الضيف غير موجود");
    expect(await listGuests(db, A.ws.invitationId, BASE)).toHaveLength(0);
  });

  it("affiliate A only sees their own sales and no customer data", async () => {
    const A = await createAffiliate(db, { name: "أ", referralCode: "AFFAAAA1" }, ownerId);
    const B = await createAffiliate(db, { name: "ب", referralCode: "AFFBBBB1" }, ownerId);
    const oa = (await issueCustomerAccess(db, issueInput({ affiliateId: A.affiliateId, customerName: "سرّي جداً", customerPhone: "0910000000" }))) as { reference: string };
    await issueCustomerAccess(db, issueInput({ affiliateId: B.affiliateId }));
    const listB = await affiliateOrders(db, B.affiliateId);
    expect(listB.map((x) => x.reference)).not.toContain(oa.reference);
    const listA = await affiliateOrders(db, A.affiliateId);
    expect(listA.map((x) => x.reference)).toContain(oa.reference);
    expect(JSON.stringify(listA)).not.toMatch(/سرّي|0910000000|workspace|token/i);
  });
});

describe("guest links and RSVP", () => {
  it("issues unique 7-day links, personalises, enforces expiry server-side, keeps RSVP on reissue", async () => {
    const W = await paidWorkspace({ guestLimit: 3 });
    await addGuests(db, W.ws.invitationId, ["أحمد", "فاطمة", "  ", "عائلة سالم"], 3, W.ws.workspaceId);
    await expect(addGuests(db, W.ws.invitationId, ["ضيف رابع"], 1, W.ws.workspaceId)).rejects.toThrow("الحد الأقصى");
    await expect(setGuestLimit(db, W.ws.workspaceId, 2, ownerId)).rejects.toThrow("أقل من عدد المدعوين");
    let guests = await listGuests(db, W.ws.invitationId, BASE);
    expect(guests).toHaveLength(3);
    const urls = guests.map((g) => g.linkUrl!);
    expect(new Set(urls).size).toBe(3);
    for (const g of guests) {
      const days = (new Date(g.linkExpiresAt!).getTime() - new Date(g.linkCreatedAt!).getTime()) / 86400000;
      expect(days).toBeCloseTo(7, 5);
      expect(g.linkUrl).not.toContain(encodeURIComponent(g.name));
    }
    const t0 = tokenFromUrl(urls[0]);
    const res = await resolveGuestLink(db, t0);
    expect(res.state).toBe("ok");
    if (res.state === "ok") expect(res.guestName).toBe("أحمد");

    // a customer dashboard token is never accepted as a guest link, and vice versa
    expect((await resolveGuestLink(db, newSecret("customer").raw)).state).toBe("not_found");
    expect(await resolveCustomerToken(db, t0)).toHaveProperty("error");

    // RSVP validation, update and history
    await saveInvitation(db, W.ws.workspaceId, {
      content: { ...W.ws.content, photos: undefined, musicUrl: undefined },
      pages: W.ws.pages,
      settings: { ...W.ws.settings, allowPartySize: true },
      variant: "white",
    });
    expect((await submitRsvp(db, t0, "accepted", 9, "ip")).ok).toBe(false);
    expect((await submitRsvp(db, t0, "accepted", 2, "ip")).ok).toBe(true);
    expect((await submitRsvp(db, t0, "declined", 0, "ip")).ok).toBe(true);
    expect((await submitRsvp(db, t0, "accepted", 3, "ip")).ok).toBe(true);
    const hist = await db.query<{ c: number }>(`select count(*)::int as c from rsvp_history where guest_id = $1`, [guests[0].id]);
    expect(hist.rows[0].c).toBe(3);
    let stats = await rsvpStats(db, W.ws.invitationId);
    expect(stats).toMatchObject({ total: 3, accepted: 1, attendees: 3, declined: 0, awaiting: 2 });

    // expiry is decided by the database clock
    await db.query(`update guest_links set expires_at = now() - interval '1 second' where guest_id = $1 and revoked_at is null`, [guests[1].id]);
    const t1 = tokenFromUrl(urls[1]);
    expect((await resolveGuestLink(db, t1)).state).toBe("expired");
    const late = await submitRsvp(db, t1, "accepted", 1, "ip");
    expect(late).toMatchObject({ ok: false, code: 410 });

    // reissue: old URL revoked, RSVP of guest 0 preserved
    await reissueGuestLink(db, W.ws.invitationId, guests[0].id, W.ws.workspaceId);
    expect((await resolveGuestLink(db, t0)).state).toBe("revoked");
    guests = await listGuests(db, W.ws.invitationId, BASE);
    expect(guests[0].rsvp).toBe("accepted");
    const fresh = await resolveGuestLink(db, tokenFromUrl(guests[0].linkUrl!));
    expect(fresh.state).toBe("ok");
    stats = await rsvpStats(db, W.ws.invitationId);
    expect(stats.accepted).toBe(1);
  });
});

describe("refunds, chargebacks and payouts", () => {
  it("full refund before payout reverses the commission and suspends the invitation", async () => {
    const { affiliateId } = await createAffiliate(db, { name: "استرجاع", referralCode: "REFUND01" }, ownerId);
    const { order } = await paidWorkspace({ affiliateId });
    await recordRefund(db, { orderId: order.orderId, amountMinor: 350_000, kind: "refund", note: "إلغاء", ownerId, idempotencyKey: "rf-1" });
    await recordRefund(db, { orderId: order.orderId, amountMinor: 350_000, kind: "refund", note: "إلغاء", ownerId, idempotencyKey: "rf-1" }); // idempotent
    const c = await db.query<{ status: string }>(`select status from commission_records where order_id = $1`, [order.orderId]);
    expect(c.rows.map((x) => x.status)).toEqual(["reversed"]);
    const w = await db.query<{ status: string }>(`select status from customer_workspaces where order_id = $1`, [order.orderId]);
    expect(w.rows[0].status).toBe("suspended");
    await expect(recordRefund(db, { orderId: order.orderId, amountMinor: 1, kind: "refund", note: "", ownerId, idempotencyKey: "rf-2" })).rejects.toThrow();
  });

  it("payout settles approved commissions; a later partial chargeback becomes a claw-back adjustment", async () => {
    const { affiliateId } = await createAffiliate(db, { name: "دفعات", referralCode: "PAYOUT01" }, ownerId);
    const { order } = await paidWorkspace({ affiliateId });
    const ids = (await db.query<{ id: string }>(`select id from commission_records where affiliate_id = $1`, [affiliateId])).rows.map((r) => r.id);
    await expect(recordPayout(db, { affiliateId, method: "cash", reference: "إيصال 1", paidOn: "2026-11-07", note: "", ownerId })).rejects.toThrow("لا توجد عمولات معتمدة");
    expect(await approveCommissions(db, ids, ownerId)).toBe(1);
    const p = await recordPayout(db, { affiliateId, method: "cash", reference: "إيصال 1", paidOn: "2026-11-07", note: "", ownerId });
    expect(p.amountMinor).toBe(52_500);
    expect((await affiliateSummary(db, affiliateId)).paidMinor).toBe(52_500);

    await recordRefund(db, { orderId: order.orderId, amountMinor: 175_000, kind: "chargeback", note: "نزاع", ownerId, idempotencyKey: "cb-1" });
    const recs = await db.query<{ kind: string; amount_minor: number; status: string }>(`select kind, amount_minor, status from commission_records where order_id = $1 order by created_at`, [order.orderId]);
    expect(recs.rows).toEqual([
      { kind: "sale", amount_minor: 52_500, status: "paid" },
      { kind: "adjustment", amount_minor: -26_250, status: "approved" },
    ]);
    const o = await db.query<{ status: string }>(`select status from orders where id = $1`, [order.orderId]);
    expect(o.rows[0].status).toBe("partially_refunded");
  });
});

describe("owner authentication", () => {
  it("requires password + fresh TOTP and blocks code replay", async () => {
    const secret = (globalThis as { __ownerSecret?: string }).__ownerSecret!;
    const step = Math.floor(Date.now() / 30000) + 1;
    const code = totpAt(secret, step);
    await expect(ownerLogin(db, { username: "owner", password: "wrong password 1", code, ipHash: "t1" })).rejects.toThrow("بيانات الدخول غير صحيحة");
    const ok = await ownerLogin(db, { username: "owner", password: "correct horse 12345", code, ipHash: "t1" });
    expect(ok.ownerId).toBe(ownerId);
    await expect(ownerLogin(db, { username: "owner", password: "correct horse 12345", code, ipHash: "t1" })).rejects.toThrow("بيانات الدخول غير صحيحة");
  });
});
