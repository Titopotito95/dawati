"use client";

import { useRef, useState, useTransition } from "react";
import { addGuestsAction, updateGuestAction, deleteGuestAction } from "@/app/dashboard/actions";

export type GuestRow = { id: string; name: string; maxPartySize: number; rsvp: "accepted" | "declined" | null; partySize: number; linkState: string };

const RSVP_BADGE: Record<string, [string, string]> = {
  accepted: ["سيحضر", "badge badge-green"],
  declined: ["اعتذر", "badge badge-red"],
  awaiting: ["في انتظار الرد", "badge badge-gold"],
};
const LINK_BADGE: Record<string, [string, string]> = {
  active: ["فعّال", "badge badge-green"],
  expired: ["منتهي", "badge badge-red"],
  revoked: ["ملغى", "badge"],
  none: ["بدون رابط", "badge"],
};

export function parseNames(text: string): { name: string; party?: number }[] {
  const out: { name: string; party?: number }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split(/[,;\t،]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const name = cols[0];
    if (!name || /^(name|الاسم|اسم الضيف)$/i.test(name)) continue;
    const n = Number((cols[1] || "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    out.push({ name, party: Number.isFinite(n) && n > 0 ? n : undefined });
  }
  return out;
}

export default function GuestManager({ guests, guestLimit, allowPartySize, defaultParty }: { guests: GuestRow[]; guestLimit: number; allowPartySize: boolean; defaultParty: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState("");
  const [party, setParty] = useState(defaultParty);
  const [bulk, setBulk] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editParty, setEditParty] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const left = Math.max(0, guestLimit - guests.length);

  function run(p: Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await p;
      setMsg({ ok: r.ok, text: r.message || "" });
      if (r.ok) after?.();
    });
  }

  function addBatch(rows: { name: string; party?: number }[]) {
    if (rows.length === 0) {
      setMsg({ ok: false, text: "لم يتم العثور على أسماء" });
      return;
    }
    // group by party size so each batch keeps its own allowance
    const groups = new Map<number, string[]>();
    for (const r of rows) {
      const p = allowPartySize ? r.party ?? party : 1;
      groups.set(p, [...(groups.get(p) ?? []), r.name]);
    }
    setMsg(null);
    start(async () => {
      let total = 0;
      for (const [p, names] of groups) {
        const r = await addGuestsAction(names, p);
        if (!r.ok) {
          setMsg({ ok: false, text: r.message || "تعذرت الإضافة" });
          return;
        }
        total += names.length;
      }
      setMsg({ ok: true, text: `تمت إضافة ${total} من الضيوف وإنشاء روابطهم` });
      setBulk("");
    });
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p>
          عدد المدعوين: <b className="num">{guests.length}</b> من <b className="num">{guestLimit}</b>
          <span className="text-ink-soft"> — متبقٍ {left}</span>
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-rose/15 sm:w-64" aria-hidden="true">
          <div className="h-full bg-burgundy" style={{ width: `${Math.min(100, (guests.length / Math.max(1, guestLimit)) * 100)}%` }} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            run(addGuestsAction([name], allowPartySize ? party : 1), () => setName(""));
          }}
        >
          <h2 className="font-semibold">إضافة ضيف</h2>
          <label className="block">
            <span className="label">اسم الضيف كما سيظهر في الدعوة</span>
            <input className="field" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="مثال: الأستاذ أحمد وعائلته" />
          </label>
          {allowPartySize ? (
            <label className="block">
              <span className="label">عدد الحاضرين المسموح</span>
              <input type="number" min={1} max={50} className="field w-28" value={party} onChange={(e) => setParty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
            </label>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={pending || left === 0}>إضافة وإنشاء الرابط</button>
        </form>

        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">إضافة عدة أسماء دفعة واحدة</h2>
          <textarea className="field min-h-[140px]" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"اسم في كل سطر\nمثال:\nعائلة الأستاذ سالم\nالحاجة فاطمة"} />
          <p className="hint">يمكنك أيضاً كتابة العدد بعد فاصلة: «عائلة سالم، 4».</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending || !bulk.trim() || left === 0} onClick={() => addBatch(parseNames(bulk))}>
              إضافة القائمة
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 500_000) {
                  setMsg({ ok: false, text: "الملف كبير جداً" });
                  return;
                }
                addBatch(parseNames(await f.text()));
              }}
            />
            <button type="button" className="btn btn-outline btn-sm" disabled={pending || left === 0} onClick={() => fileRef.current?.click()}>
              استيراد ملف CSV
            </button>
          </div>
        </div>
      </div>

      <div aria-live="polite">{msg ? <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>{msg.text}</p> : null}</div>

      <div className="card overflow-x-auto">
        {guests.length === 0 ? (
          <p className="p-8 text-center text-ink-soft">لم تتم إضافة ضيوف بعد.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الضيف</th>
                {allowPartySize ? <th>العدد المسموح</th> : null}
                <th>الرد</th>
                <th>الرابط</th>
                <th><span className="sr-only">إجراءات</span></th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => {
                const [rl, rc] = RSVP_BADGE[g.rsvp ?? "awaiting"];
                const [ll, lc] = LINK_BADGE[g.linkState] ?? LINK_BADGE.none;
                const isEd = editing === g.id;
                return (
                  <tr key={g.id}>
                    <td className="min-w-[180px]">
                      {isEd ? <input className="field" value={editName} maxLength={120} onChange={(e) => setEditName(e.target.value)} /> : g.name}
                    </td>
                    {allowPartySize ? (
                      <td>
                        {isEd ? (
                          <input type="number" min={1} max={50} className="field w-20" value={editParty} onChange={(e) => setEditParty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
                        ) : (
                          <span className="num">{g.maxPartySize}</span>
                        )}
                      </td>
                    ) : null}
                    <td>
                      <span className={rc}>{rl}</span>
                      {g.rsvp === "accepted" && g.partySize > 1 ? <span className="mr-1 text-xs text-ink-soft">({g.partySize})</span> : null}
                    </td>
                    <td><span className={lc}>{ll}</span></td>
                    <td className="whitespace-nowrap text-left">
                      {isEd ? (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(updateGuestAction(g.id, { name: editName, maxPartySize: editParty }), () => setEditing(null))}>حفظ</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>إلغاء</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(g.id); setEditName(g.name); setEditParty(g.maxPartySize); }}>تعديل</button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm text-danger"
                            disabled={pending}
                            onClick={() => {
                              if (window.confirm(`حذف «${g.name}»؟ سيتوقف رابطه فوراً.`)) run(deleteGuestAction(g.id));
                            }}
                          >
                            حذف
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
