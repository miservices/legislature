/* Dashboard core: sign-in and page shell, small form widgets, Firestore helpers, the schema-driven form builder
   and the pieces of a detail view. dash-pages.js builds every dashboard page on top of this. */
import {
  auth, db, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp, PUBLIC_ROLE, ROLES, ADMIN_ROLES
} from "./fb.js";
import { mountShell } from "./shell.js";
import { esc, asList, safeUrl, docEmbed, badgeClass, tsDate } from "./util.js";

/* ================================================================
   Small inputs: add/remove rows and a searchable chip picker
   ================================================================ */
export const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const longDate = iso => { const d = new Date(String(iso).slice(0, 10) + "T12:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/* Rows of text/url inputs. Enter adds a row, pasting several lines splits them into rows. */
export function repeater(host, { values = [], placeholder = "", type = "text" } = {}) {
  host.classList.add("rep");
  const row = v => `<div class="rep-row"><input type="${type}" value="${esc(v)}" placeholder="${esc(placeholder)}"><button type="button" class="rep-x" data-rm aria-label="Remove">&times;</button></div>`;
  host.innerHTML = `<div class="rep-rows">${(values.length ? values : [""]).map(row).join("")}</div><button type="button" class="btn btn-outline btn-sm" data-add>+ Add</button>`;
  const rows = host.querySelector(".rep-rows");
  const addRow = (v = "", after) => {
    const t = document.createElement("div"); t.innerHTML = row(v);
    const el = t.firstChild; after ? after.after(el) : rows.append(el); el.querySelector("input").focus(); return el;
  };
  host.addEventListener("click", e => {
    if (e.target.closest("[data-add]")) addRow();
    const rm = e.target.closest("[data-rm]");
    if (rm) { const r = rm.closest(".rep-row"); if (rows.children.length > 1) r.remove(); else r.querySelector("input").value = ""; }
  });
  host.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.matches(".rep-row input")) { e.preventDefault(); addRow("", e.target.closest(".rep-row")); }
  });
  host.addEventListener("paste", e => {
    const t = (e.clipboardData && e.clipboardData.getData("text")) || "";
    if (!/\r?\n/.test(t) || !e.target.matches(".rep-row input")) return;
    e.preventDefault();
    let cur = e.target.closest(".rep-row");
    t.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach((s, i) => {
      if (i === 0 && !e.target.value) { e.target.value = s; } else cur = addRow(s, cur);
    });
  });
  return { get: () => [...rows.querySelectorAll("input")].map(i => i.value.trim()).filter(Boolean) };
}

/* Searchable picker that shows picks as chips.
   options: [{ value, label, sub? }]. allowFree lets the user add text that isn't an option. single keeps one value. */
export function chipPicker(host, { options = [], values = [], allowFree = false, single = false, placeholder = "Type to search…", onChange } = {}) {
  let sel = Array.isArray(values) ? values.map(String).filter(Boolean) : values ? [String(values)] : [];
  if (single) sel = sel.slice(0, 1);
  const label = v => (options.find(o => o.value === v) || {}).label || v;
  host.classList.add("pk");
  host.innerHTML = `<div class="pk-box"><span class="pk-chips"></span><input class="pk-in" autocomplete="off"></div><div class="pk-menu" hidden></div>`;
  const chips = host.querySelector(".pk-chips"), input = host.querySelector(".pk-in"), menu = host.querySelector(".pk-menu");
  let matches = [], hi = 0, free = "";

  const drawChips = () => {
    chips.innerHTML = sel.map((v, i) => `<span class="pk-chip">${esc(label(v))}<button type="button" data-rm="${i}" aria-label="Remove">&times;</button></span>`).join("");
    input.style.display = single && sel.length ? "none" : "";
    input.placeholder = sel.length ? "" : placeholder;
  };
  const drawMenu = () => {
    const q = input.value.trim().toLowerCase();
    matches = options.filter(o => !sel.includes(o.value) && (!q || (o.label + " " + (o.sub || "")).toLowerCase().includes(q))).slice(0, 8);
    hi = Math.min(hi, Math.max(matches.length - 1, 0));
    free = allowFree && q && !sel.some(s => s.toLowerCase() === q) && !options.some(o => o.label.toLowerCase() === q) ? input.value.trim() : "";
    menu.innerHTML = matches.map((o, i) => `<div class="pk-item ${i === hi ? "hi" : ""}" data-i="${i}">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</div>`).join("")
      + (free ? `<div class="pk-item ${matches.length ? "" : "hi"}" data-free>Add “${esc(free)}”</div>` : "");
    menu.hidden = !menu.innerHTML;
  };
  const notify = () => onChange && onChange(single ? (sel[0] || "") : sel.slice());
  const add = v => {
    if (!v || sel.includes(v)) return;
    sel = single ? [v] : [...sel, v]; input.value = ""; drawChips(); menu.hidden = true; notify();
  };
  const remove = i => { sel.splice(i, 1); drawChips(); notify(); if (single) input.focus(); };

  input.addEventListener("input", () => { hi = 0; drawMenu(); });
  input.addEventListener("focus", drawMenu);
  input.addEventListener("blur", () => setTimeout(() => { menu.hidden = true; if (allowFree && input.value.trim()) add(input.value.trim()); }, 120));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hi + 1, matches.length - 1); drawMenu(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); hi = Math.max(hi - 1, 0); drawMenu(); }
    else if (e.key === "Enter" || (e.key === "," && allowFree)) {
      e.preventDefault();
      if (matches[hi] && (e.key === "Enter")) add(matches[hi].value);
      else if (free || input.value.trim()) add(free || input.value.trim());
    } else if (e.key === "Backspace" && !input.value && sel.length) remove(sel.length - 1);
  });
  menu.addEventListener("mousedown", e => {
    e.preventDefault();
    const it = e.target.closest(".pk-item"); if (!it) return;
    if (it.hasAttribute("data-free")) add(free); else add(matches[+it.dataset.i].value);
  });
  chips.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) remove(+b.dataset.rm); });
  host.querySelector(".pk-box").addEventListener("click", () => input.focus());
  drawChips();
  return {
    get: () => single ? (sel[0] || "") : sel.slice(),
    set(v) { sel = Array.isArray(v) ? v.map(String) : v ? [String(v)] : []; drawChips(); }
  };
}

/* ================================================================
   Firestore helpers: cached reads, numbering, amendment bookkeeping
   ================================================================ */
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

/* ================================================================
   Form builder: describe fields, get a form
   ================================================================ */
const plain = f => f.label.replace(/\s*\(.*\)/, "");

/* Load whatever the fields need (lookup collections, legislators) before the form is drawn. */
export async function prepare(fields, rows = []) {
  const env = { rows, look: {}, people: [] };
  const colls = [...new Set(fields.filter(f => f.from).map(f => f.from))];
  await Promise.all(colls.map(async c => { env.look[c] = await load(c); }));
  if (fields.some(f => f.type === "people")) env.people = await legislatorOptions();
  return env;
}

function optionsFor(f, env) {
  if (f.type === "people") return env.people;
  if (!f.from) return f.options ? f.options.map(o => ({ value: o, label: o })) : [];
  const seen = new Set();
  return (env.look[f.from] || []).map(r => f.option(r)).filter(o => o && o.value !== "" && !seen.has(o.value) && seen.add(o.value));
}

function initial(f, item, env, seed) {
  if (item && item[f.key] != null) return item[f.key];
  if (!item && seed && seed[f.key] != null) return seed[f.key];
  if (item) return f.type === "list" || f.type === "refs" ? [] : "";
  if (f.auto === "number") return nextNumber(env.rows);
  if (f.auto === "order") return nextOrder(env.rows);
  if (f.default === "today") return todayISO();
  return typeof f.default === "function" ? f.default(env) : (f.default ?? (f.type === "list" || f.type === "refs" ? [] : ""));
}

export function buildForm(fields, item, env, { lockKey, seed } = {}) {
  const widgets = {};
  const html = fields.map(f => {
    const id = "f_" + f.key, v = initial(f, item, env, seed), locked = item && lockKey === f.key;
    let el;
    switch (f.type) {
      case "textarea": el = `<textarea id="${id}" rows="${f.rows || 4}">${esc(v)}</textarea>`; break;
      case "select": el = `<select id="${id}"><option value="">—</option>${f.options.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`; break;
      case "list": case "refs": case "tags": case "people": el = `<div id="${id}" class="widget"></div>`; break;
      default: el = `<input id="${id}" type="${f.type || "text"}" value="${esc(v)}" ${locked ? "disabled" : ""} ${f.type === "number" ? 'step="any"' : ""}>`;
    }
    const span = f.full ? 6 : f.span || ({ number: 2, date: 2, time: 2, select: 3, text: 3, undefined: 3 }[f.type] ?? 6);
    return `<div class="field" data-field="${f.key}" style="grid-column:span ${span}"><label for="${id}">${esc(f.label)}${f.req ? " *" : ""}</label>${el}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}</div>`;
  }).join("");

  function init(root) {
    for (const f of fields) {
      const host = root.querySelector(`#f_${f.key}`), v = initial(f, item, env, seed);
      if (f.type === "list") widgets[f.key] = repeater(host, { values: asList(v), type: f.itemType === "url" ? "url" : "text", placeholder: f.placeholder || (f.itemType === "url" ? "https://…" : "") });
      else if (f.type === "refs") widgets[f.key] = chipPicker(host, { options: optionsFor(f, env), values: f.single ? String(v ?? "") : asList(v).map(String), single: !!f.single, allowFree: !!f.free, placeholder: f.placeholder || "Type to search…", onChange: f.onPick && (val => f.onPick(val, root, env)) });
      else if (f.type === "tags" || f.type === "people") widgets[f.key] = chipPicker(host, { options: optionsFor(f, env), values: asList(typeof v === "string" ? v.split(",") : v), allowFree: true, placeholder: f.placeholder || (f.type === "people" ? "Type a name…" : "Type and press Enter…") });
    }
    const applyShow = () => {
      for (const f of fields) if (f.showIf) {
        const src = root.querySelector(`#f_${f.showIf.key}`), on = src && f.showIf.in.includes(src.value);
        root.querySelector(`[data-field="${f.key}"]`).style.display = on ? "" : "none";
      }
    };
    root.addEventListener("change", applyShow); applyShow();
  }

  function collect(root) {
    const data = {}, errs = [];
    for (const f of fields) {
      const wrap = root.querySelector(`[data-field="${f.key}"]`), hidden = wrap.style.display === "none";
      let v;
      if (widgets[f.key]) {
        v = widgets[f.key].get();
        if (f.cast === "number") v = Array.isArray(v) ? v.map(Number) : (v === "" ? null : Number(v));
        if (f.type === "list" && f.itemType === "url" && v.some(u => !safeUrl(u))) errs.push(`${plain(f)}: every link must be a valid URL.`);
        if (((f.type === "tags" || f.type === "people") && f.asString !== false) || (f.type === "refs" && f.asString)) v = v.join(", ");
      } else {
        const el = root.querySelector(`#f_${f.key}`); v = el.value.trim();
        if (f.type === "number") { v = v === "" ? null : Number(v); if (v !== null && isNaN(v)) errs.push(`${plain(f)} must be a number.`); }
        else if (f.type === "url" && v && !safeUrl(v)) errs.push(`${plain(f)} must be a valid link.`);
      }
      const empty = v === "" || v === null || (Array.isArray(v) && !v.length);
      if (f.req && empty && !hidden) errs.push(`${plain(f)} is required.`);
      data[f.key] = hidden ? (f.type === "list" || f.type === "refs" ? [] : "") : v;
    }
    return { data, errs };
  }
  return { html, init, collect };
}

/* ================================================================
   Detail-view building blocks
   ================================================================ */
export const fmt = d => d ? longDate(d) : "";

export function headerHtml({ back, publicHref, kind, badge, title, sub = "" }) {
  return `<div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; ${esc(back)}</button><span class="grow"></span>
      ${publicHref ? `<a class="dlink" href="../../${publicHref}" target="_blank" rel="noopener">View public page &nearr;</a>` : ""}</div>
    <div class="hline"><span class="hnum">${esc(kind)}</span>${badge ? `<span class="badge ${badgeClass(badge)}">${esc(badge)}</span>` : ""}</div>
    <h2 class="htitle">${esc(title)}</h2>${sub ? `<div class="dmeta">${sub}</div>` : ""}`;
}
export function factsHtml(pairs) {
  const f = pairs.filter(([, v]) => v);
  return f.length ? `<dl class="facts">${f.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>` : "";
}
export const proseHtml = (r, defs) => defs.filter(([, k]) => r[k]).map(([l, k]) =>
  `<div class="sec"><h3 class="sub">${esc(l)}</h3><div class="prose-box pre">${esc(r[k])}</div></div>`).join("");
export const docsHtml = (r, defs) => {
  const h = defs.map(([l, k]) => docEmbed(l, r[k])).join("");
  return h ? `<div class="sec"><h3 class="sub">Documents</h3>${h}</div>` : "";
};
export const auditHtml = r => {
  const t = tsDate(r.updatedAt);
  return r.updatedBy ? `<span class="audit">Last updated by ${esc(r.updatedBy)}${t ? " on " + esc(t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) : ""}</span>` : "";
};

/* Actions: { label, kind?, confirm?, set?, run?, go?, input?: {type:'select'|'date'|'time', from?, option?, required?, value?, label?} } */
export async function prepActions(acts) {
  for (const a of acts) if (a.input && a.input.from) {
    const rows = await load(a.input.from);
    a._opts = rows.map(a.input.option).filter(Boolean);
  }
  return acts;
}
export function actionBarHtml(acts, lead = "Actions") {
  if (!acts.length) return "";
  return `<div class="actionbar"><b class="nx">${esc(lead)}</b>${acts.map((a, i) => {
    const btn = `<button class="btn btn-${a.kind || "outline"} btn-sm" data-act="runAct" data-i="${i}">${esc(a.label)}</button>`;
    if (!a.input) return btn;
    const id = `ai_${i}`, t = a.input.type || "select";
    const ctl = t === "select"
      ? `<select id="${id}" class="bar-sel"><option value="">${esc(a.input.label || "Choose…")}</option>${(a._opts || []).map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>`
      : `<input id="${id}" type="${t}" value="${esc(a.input.value || "")}" class="bar-in">`;
    return `<span class="act-in">${ctl}${btn}</span>`;
  }).join("")}</div>`;
}
/* Validate/confirm a pressed action; returns { a, val } or null (after flashing why). */
export function pickAction(ctx, acts, btn) {
  const a = acts[+btn.dataset.i]; if (!a) return null;
  const el = document.getElementById(`ai_${btn.dataset.i}`), val = el ? el.value : undefined;
  if (a.input && a.input.required && !val) { ctx.flash("Choose a value first.", "err"); return null; }
  if (a.confirm && !confirm(typeof a.confirm === "function" ? a.confirm(val) : a.confirm)) return null;
  return { a, val };
}

/* ================================================================
   Shell: sign-in, access checks, navigation
   ================================================================ */
export const DASH_VERSION = "5";
const MIGOVT_LOGIN_URL = "https://migovt.org/login/";
const SITE_NAME = "Michigan Legislature Dashboard";
export const BASE = new URL("../dashboard/", import.meta.url).href;   // absolute URL of /dashboard/

/* Every dashboard page. slug = folder under /dashboard/. admin = Speaker / Deputy / Pro Tem / Clerk only.
   coll = the Firestore collection a record-editor page manages. */
export const PAGES = {
  overview:  { slug: "",            label: "Overview",        title: "Dashboard", group: "Dashboard", sub: "Your account and committee assignments." },
  proposals: { slug: "proposals/",  label: "My proposals",    group: "Dashboard", sub: "Submit bills and resolutions as Google Drive links." },
  review:    { slug: "review/",     label: "Review proposals", group: "Dashboard", admin: true, sub: "Introduce or reject proposals from legislators." },

  bills:        { slug: "bills/",        label: "Bills",          group: "Official record", admin: true, coll: "bills", sub: "Move bills through the process; the timeline and links update themselves." },
  resolutions:  { slug: "resolutions/",  label: "Resolutions",    group: "Official record", admin: true, coll: "resolutions", sub: "Move resolutions through the process; the timeline updates itself." },
  publicActs:   { slug: "public-acts/",  label: "Public Acts",    group: "Official record", admin: true, coll: "publicActs", sub: "Create and edit public acts." },
  mcl:          { slug: "mcl/",          label: "Michigan Compiled Laws", group: "Official record", admin: true, sub: "Chapters and sections of the Michigan Compiled Laws." },
  macRules:     { slug: "mac/",          label: "Administrative Code", group: "Official record", admin: true, coll: "macRules", sub: "Rules in the Michigan Administrative Code." },
  executiveOrders: { slug: "executive-orders/", label: "Executive Orders", group: "Official record", admin: true, coll: "executiveOrders", sub: "Create and edit executive orders." },
  execReorgOrders: { slug: "executive-reorganization-orders/", label: "Reorganization Orders", group: "Official record", admin: true, coll: "execReorgOrders", sub: "Create and edit executive reorganization orders." },
  journals:     { slug: "journals/",     label: "Journals",       group: "Official record", admin: true, coll: "journals", sub: "Create and edit journals." },
  calendar:     { slug: "calendar/",     label: "Calendar",       group: "Official record", admin: true, coll: "calendarEvents", sub: "Floor sessions, hearings and committee meetings." }
};

export const isAdminRole = role => ADMIN_ROLES.includes(role);

export async function startDash({ page, render }) {
  const entry = PAGES[page];
  document.body.classList.add("dash-page");
  const cssReady = new Promise(res => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = new URL("dash.css?v=" + DASH_VERSION, import.meta.url).href; l.onload = l.onerror = res; document.head.appendChild(l); });   // always the matching CSS
  mountShell({ eyebrow: "Legislature dashboard", title: entry.title || entry.label, sub: entry.sub || "", filters: false, card: false });
  const root = document.getElementById("content");
  let acct = null, uid = null, signingIn = false;
  const view = html => { root.innerHTML = html; };

  const ctx = {
    page: entry, label: entry.label,
    get acct() { return acct; }, get uid() { return uid; },
    get isAdmin() { return isAdminRole(acct && acct.role); },
    get panel() { return document.getElementById("panel"); },
    flash(msg, type = "ok") {
      const p = ctx.panel, old = p.querySelector(".flash"); if (old) old.remove();
      p.insertAdjacentHTML("afterbegin", `<div class="msg ${type} flash">${esc(msg)}</div>`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    /* Click delegation for the page's own [data-act] buttons. */
    on(handlers) {
      ctx.panel.addEventListener("click", e => {
        const b = e.target.closest("[data-act]");
        if (b && handlers[b.dataset.act]) handlers[b.dataset.act](b);
      });
    }
  };

  const loading = msg => view(`<div class="card signin-card"><div class="skel" style="height:14px;width:60%;margin-bottom:10px"></div><p class="lead" style="margin:0">${esc(msg)}</p></div>`);

  function renderSignIn(error) {
    view(`<div class="card signin-card">
      <h2>Sign in</h2>
      <p class="lead">The dashboard uses your MiGOVT account to confirm who you are. You'll go to MiGOVT to sign in, then come right back here.</p>
      ${error ? `<div class="msg err">${esc(error)}</div>` : ""}
      <button class="btn btn-primary" style="width:100%" data-act="signin">Sign in with MiGOVT</button>
      <p class="lead" style="margin:1rem 0 0;font-size:12.5px">New here? Signing in creates your account automatically.</p>
    </div>`);
  }

  function renderNoAccess() {
    view(`<div class="card signin-card">
      <h2>You can't access the dashboard</h2>
      <p class="lead">Your account (<strong>${esc(acct.name)}</strong>) is a ${esc(acct.role || PUBLIC_ROLE)} account. The dashboard is only for legislature staff.</p>
      <div class="msg info">If you think you should have access, contact the Clerk of the Legislature.</div>
      <button class="btn btn-outline" data-act="signout">Sign out</button>
    </div>`);
  }

  function renderDash() {
    const admin = ctx.isAdmin, groups = {};
    Object.entries(PAGES).filter(([, p]) => !p.admin || admin).forEach(([k, p]) => (groups[p.group] ||= []).push([k, p]));
    view(`<div class="dash">
      <nav class="dnav">
        ${Object.entries(groups).map(([g, items]) => `<div class="grp">${esc(g)}</div>${items.map(([k, p]) =>
          `<a href="${BASE + p.slug}" class="${k === page ? "on" : ""}">${esc(p.label)}</a>`).join("")}`).join("")}
        <a data-act="signout" style="color:#a32d2d">Sign out</a>
      </nav>
      <div id="panel"></div>
    </div>`);
    cssReady.then(() => {
      const probe = document.createElement("span"); probe.className = "pk-chip"; probe.style.cssText = "position:absolute;visibility:hidden";
      document.body.appendChild(probe); const fresh = getComputedStyle(probe).borderTopLeftRadius === "4px"; probe.remove();
      if (!fresh) root.insertAdjacentHTML("afterbegin", '<div class="msg err">The dashboard stylesheet is out of date. Replace <b>shared/dash.css</b> with the latest copy and hard-refresh (Ctrl+F5).</div>');
    });
    if (entry.admin && !admin) {
      ctx.panel.innerHTML = `<div class="card"><h2>No permission</h2><p class="lead" style="margin:0">This page is only for the Speaker, Deputy Speaker, Speaker Pro Tempore and Clerk of the Legislature.</p></div>`;
      return;
    }
    Promise.resolve(render(ctx)).catch(e => { console.error(e); ctx.panel.innerHTML = '<div class="msg err">Something went wrong loading this page.</div>'; });
  }

  const actions = {
    signin() { location.href = MIGOVT_LOGIN_URL + "?redirect_uri=" + encodeURIComponent(location.href.split("?")[0].split("#")[0]) + "&site_name=" + encodeURIComponent(SITE_NAME); },
    async signout() { await signOut(auth); acct = null; uid = null; renderSignIn(); }
  };
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (b && actions[b.dataset.act]) actions[b.dataset.act](b);
  });

  async function migovtSignIn(p) {
    const pin = String(p.pin);
    const authEmail = `${pin}@mipass.legislature.migovt.org`, password = `${pin}-legislature`;
    let cred;
    try { cred = await signInWithEmailAndPassword(auth, authEmail, password); }
    catch (e) {
      if (["auth/invalid-credential", "auth/user-not-found", "auth/invalid-login-credentials"].includes(e.code)) cred = await createUserWithEmailAndPassword(auth, authEmail, password);
      else throw e;
    }
    const ref = doc(db, "accounts", cred.user.uid), snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { name: p.name, email: p.email || "", role: PUBLIC_ROLE, dob: p.dob || null, robloxUser: p.user || null, committees: [], createdAt: serverTimestamp(), lastLogin: serverTimestamp() });
    } else {
      await updateDoc(ref, { lastLogin: serverTimestamp() });
    }
  }

  async function loadAccount(user) {
    uid = user.uid;
    try {
      const snap = await getDoc(doc(db, "accounts", uid));
      if (!snap.exists()) { await signOut(auth); return renderSignIn("We couldn't find your account. Please sign in with MiGOVT again."); }
      acct = snap.data();
    } catch (e) { console.error(e); return renderSignIn("Couldn't load your account. Please try again."); }
    (acct.role && acct.role !== PUBLIC_ROLE && ROLES.includes(acct.role)) ? renderDash() : renderNoAccess();
  }

  const qs = new URLSearchParams(location.search);
  const ret = qs.get("mipass_pin") && qs.get("mipass_name")
    ? { pin: qs.get("mipass_pin"), name: qs.get("mipass_name"), dob: qs.get("mipass_dob"), user: qs.get("mipass_user"), email: qs.get("mipass_email") } : null;
  if (ret) { signingIn = true; history.replaceState({}, "", location.pathname); }   // keep the PIN out of the address bar

  loading(ret ? "Signing you in…" : "Checking your sign-in…");
  onAuthStateChanged(auth, async user => {
    if (signingIn) return;
    user ? await loadAccount(user) : renderSignIn();
  });
  if (ret) {
    try { await migovtSignIn(ret); signingIn = false; await loadAccount(auth.currentUser); }
    catch (e) {
      console.error(e); signingIn = false;
      renderSignIn(e.code === "auth/email-already-in-use" ? "This MiGOVT account is already linked to a different sign-in. Contact the Clerk of the Legislature."
        : e.code === "permission-denied" || (e.message || "").includes("permissions") ? "Your account couldn't be created. Make sure the Firestore rules have been published."
        : "Sign-in failed. Please try again.");
    }
  }
}