/* Cached Firestore reads plus the bookkeeping that used to be typed by hand:
   next numbers, legislator names, history lines, and amendment links between acts, bills and MCL sections. */
import { db, collection, getDocs, doc, serverTimestamp } from "./fb.js";
import { asList } from "./util.js";
import { longDate, todayISO } from "./dash-ui.js";
import { ROLES, PUBLIC_ROLE } from "./fb.js";

const cache = {};
export async function load(coll, force = false) {
  if (!force && cache[coll]) return cache[coll];
  const snap = await getDocs(collection(db, coll));
  return (cache[coll] = snap.docs.map(d => ({ _id: d.id, ...d.data() })));
}
export const invalidate = (...names) => names.forEach(n => delete cache[n]);

export const nextNumber = rows => rows.reduce((m, r) => Math.max(m, Number(r.number) || 0), 0) + 1;
/* Orders are numbered per year: 2026-1, 2026-2 … */
export function nextOrder(rows, year = new Date().getFullYear()) {
  const max = rows.reduce((m, r) => { const [y, n] = String(r.number).split("-"); return Number(y) === year ? Math.max(m, Number(n) || 0) : m; }, 0);
  return `${year}-${max + 1}`;
}

/* Everyone with a legislature role, for sponsor pickers. Only admins can read accounts; others get an empty list. */
export async function legislatorOptions() {
  try {
    const rows = await load("accounts");
    return rows.filter(a => a.role && a.role !== PUBLIC_ROLE && ROLES.includes(a.role) && a.role !== "Clerk of the Legislature")
      .map(a => ({ value: a.name, label: a.name, sub: a.role })).sort((a, b) => a.label.localeCompare(b.label));
  } catch { return []; }
}

export const stamp = who => ({ updatedAt: serverTimestamp(), updatedBy: who });
export const dated = text => `${text} — ${longDate(todayISO())}`;
export const appendHistory = (old, text) => (String(old || "").trim() + " " + text).trim();

/* Keep amendatoryBills ("594B" pending / "973A" enacted amendment / "12R" repeal) on the target bills in step with
   the amending bill's amendsActs / repealsActs lists and its status. Writes into `batch`. */
export async function syncAmendments(batch, bill, who) {
  const [bills, acts] = await Promise.all([load("bills"), load("publicActs")]);
  const n = String(bill.number), mine = new RegExp(`^${n}\\s*[A-Za-z]$`);
  const dead = ["Defeated", "Tabled", "Vetoed"].includes(bill.status), enacted = bill.status === "Enacted";
  const upd = new Map(bills.map(b => [b._id, { list: asList(b.amendatoryBills).filter(e => !mine.test(e)), fields: {}, changed: asList(b.amendatoryBills).some(e => mine.test(e)) }]));
  const actUpd = {};
  const targets = [...(bill.amendsActs || []).map(pa => [pa, "amend"]), ...(bill.repealsActs || []).map(pa => [pa, "repeal"])];
  for (const [pa, mode] of targets) {
    const target = bills.find(b => Number(b.paNumber) === Number(pa));
    if (target && !dead && target._id !== String(bill.number)) {
      const u = upd.get(target._id); u.list.push(`${n}${enacted ? (mode === "repeal" ? "R" : "A") : "B"}`); u.changed = true;
      if (enacted && mode === "repeal") u.fields.status = "Repealed";
    }
    const act = acts.find(a => Number(a.number) === Number(pa));
    if (act && enacted) actUpd[act._id] = { status: mode === "repeal" ? "Repealed" : "Amended" };
  }
  for (const [id, u] of upd) if (u.changed || Object.keys(u.fields).length) batch.update(doc(db, "bills", id), { amendatoryBills: u.list, ...u.fields, ...stamp(who) });
  for (const [id, f] of Object.entries(actUpd)) batch.update(doc(db, "publicActs", id), { ...f, ...stamp(who) });
  invalidate("bills", "publicActs");
}

/* Write a Public Act, add its citation to the history of every MCL section it amends, and mark the source bill enacted. */
export async function writePublicAct(batch, data, who) {
  const id = String(data.number);
  batch.set(doc(db, "publicActs", id), { ...data, ...stamp(who) });
  const cite = `${data.year} PA ${data.number}`, eff = data.effectiveDate || data.signedDate;
  const secs = await load("mclSections");
  for (const c of data.amends || []) {
    const s = secs.find(x => x.cite === c);
    if (s && !String(s.history || "").includes(cite))
      batch.update(doc(db, "mclSections", s._id), { history: appendHistory(s.history, `${cite}${eff ? ", Eff. " + longDate(eff) : ""}.`), ...stamp(who) });
  }
  if (data.billNumber) {
    const bills = await load("bills"), b = bills.find(x => Number(x.number) === Number(data.billNumber));
    if (b) batch.update(doc(db, "bills", b._id), { paNumber: Number(data.number), ...(b.status === "Repealed" ? {} : { status: "Enacted" }), ...stamp(who) });
  }
  invalidate("publicActs", "mclSections", "bills");
}