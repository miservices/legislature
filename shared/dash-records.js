/* Dashboard › generic record editor. One config per Firestore collection; everything that can be filled in
   automatically (next numbers, today's date, linked records, citations) is. */
import { db, doc, setDoc, deleteDoc, collection, writeBatch } from "./fb.js";
import { esc, natCompare, COMMITTEES } from "./util.js";
import { todayISO, addDays, longDate } from "./dash-ui.js";
import { load, invalidate, stamp, writePublicAct } from "./dash-data.js";
import { prepare, buildForm } from "./dash-form.js";

const opt = (value, label) => ({ value: String(value), label });

export const COLLECTIONS = {
  publicActs: { idField: "number", cols: ["number", "year", "title", "status"], sort: "number", filterBy: "status",
    fields: [
      { key: "number", label: "Public Act number", type: "number", req: true, auto: "number" },
      { key: "year", label: "Year", type: "number", req: true, default: () => new Date().getFullYear() },
      { key: "billNumber", label: "Source bill", type: "refs", single: true, cast: "number", from: "bills", full: true, placeholder: "Search bills…",
        option: b => opt(b.number, `Bill No. ${b.number} — ${b.title}`), hint: "Picking a bill also fills in the title and marks the bill enacted.",
        onPick: (val, root, env) => { const b = (env.look.bills || []).find(x => String(x.number) === String(val)); if (!b) return;
          const t = root.querySelector("#f_title"), d = root.querySelector("#f_description");
          if (t && !t.value) t.value = b.title || ""; if (d && !d.value) d.value = b.description || ""; } },
      { key: "title", label: "Title", req: true, full: true },
      { key: "status", label: "Status", type: "select", options: ["In effect", "Amended", "Repealed"], default: "In effect" },
      { key: "signedDate", label: "Signed", type: "date", default: "today" },
      { key: "effectiveDate", label: "Effective", type: "date", default: "today" },
      { key: "amends", label: "MCL sections it amends", type: "refs", from: "mclSections", full: true, placeholder: "Search by citation or title…",
        option: s => opt(s.cite, `MCL ${s.cite} — ${s.title}`), hint: "Each section picked gets this act added to its history automatically." },
      { key: "description", label: "Summary", type: "textarea", full: true },
      { key: "text", label: "Act text", type: "textarea", rows: 8, full: true },
      { key: "driveUrl", label: "Enrolled act (Google Drive link)", type: "url", full: true }
    ],
    save: (batch, data, who) => writePublicAct(batch, data, who) },

  macRules: { idField: "cite", cols: ["cite", "agency", "title"], sort: "cite", filterBy: "agency",
    fields: [
      { key: "cite", label: "Rule number (e.g. R 408.10101)", req: true },
      { key: "agency", label: "Agency", type: "refs", single: true, from: "macRules", req: true, placeholder: "Pick or type an agency…", free: true, option: r => r.agency ? opt(r.agency, r.agency) : null },
      { key: "title", label: "Title", req: true, full: true },
      { key: "text", label: "Text", type: "textarea", rows: 10, full: true },
      { key: "history", label: "History", type: "textarea", full: true }
    ] },

  executiveOrders: { idField: "number", cols: ["number", "title", "status"], sort: "number", filterBy: "status",
    fields: [
      { key: "number", label: "Order number", type: "text", req: true, auto: "order" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Rescinded", "Superseded"], default: "Active" },
      { key: "title", label: "Title", req: true, full: true },
      { key: "signedDate", label: "Signed", type: "date", default: "today" },
      { key: "effectiveDate", label: "Effective", type: "date", default: "today" },
      { key: "rescindedBy", label: "Rescinded / superseded by", type: "refs", single: true, from: "executiveOrders", full: true, placeholder: "Search orders…",
        option: r => opt(r.number, `Executive Order No. ${r.number} — ${r.title}`) },
      { key: "description", label: "Summary", type: "textarea", full: true },
      { key: "text", label: "Order text", type: "textarea", rows: 8, full: true },
      { key: "driveUrl", label: "Full order (Google Drive link)", type: "url", full: true }
    ] },

  execReorgOrders: { idField: "number", cols: ["number", "title", "status"], sort: "number", filterBy: "status",
    fields: [
      { key: "number", label: "Order number", type: "text", req: true, auto: "order" },
      { key: "status", label: "Status", type: "select", options: ["Submitted", "In effect", "Disapproved", "Rescinded"], default: "Submitted" },
      { key: "title", label: "Title", req: true, full: true },
      { key: "agencies", label: "Agencies affected", type: "refs", from: "macRules", full: true, free: true, asString: true, placeholder: "Pick or type agencies…", option: r => r.agency ? opt(r.agency, r.agency) : null },
      { key: "signedDate", label: "Signed", type: "date", default: "today" },
      { key: "effectiveDate", label: "Effective", type: "date", default: "today" },
      { key: "description", label: "Summary", type: "textarea", full: true },
      { key: "text", label: "Order text", type: "textarea", rows: 8, full: true },
      { key: "driveUrl", label: "Full order (Google Drive link)", type: "url", full: true }
    ] },

  journals: { idField: "number", cols: ["number", "date", "sessionType"], sort: "number", filterBy: "sessionType",
    fields: [
      { key: "number", label: "Journal number", type: "number", req: true, auto: "number" },
      { key: "date", label: "Session date", type: "date", req: true, default: "today" },
      { key: "sessionType", label: "Session type", type: "select", options: ["Regular", "Special", "Organizational"], default: "Regular" },
      { key: "title", label: "Title (optional)", full: true },
      { key: "summary", label: "Highlights", type: "textarea", full: true },
      { key: "driveUrl", label: "Full journal (Google Drive link)", type: "url", full: true }
    ] },

  calendarEvents: { idField: null, cols: ["date", "time", "type", "title"], sort: "date", filterBy: "type",
    fields: [
      { key: "type", label: "Type", type: "select", options: ["Floor session", "Committee meeting", "Public hearing", "Other"], req: true, default: "Floor session" },
      { key: "committee", label: "Committee", type: "select", options: COMMITTEES, showIf: { key: "type", in: ["Committee meeting", "Public hearing"] } },
      { key: "title", label: "Title (leave blank to name it automatically)", full: true },
      { key: "date", label: "Date", type: "date", req: true, default: "today" },
      { key: "time", label: "Start time", type: "time", default: () => remember("time") },
      { key: "endTime", label: "End time", type: "time" },
      { key: "location", label: "Location", default: () => remember("location") },
      { key: "repeat", label: "Repeat weekly for (extra weeks)", type: "number", default: 0, hint: "0 = just this one. 4 creates this event plus the next four weeks.", newOnly: true },
      { key: "description", label: "Description", type: "textarea", full: true },
      { key: "agendaUrl", label: "Agenda (Google Drive link)", type: "url", full: true }
    ],
    /* One form can create many events and names them itself. */
    expand(data) {
      const base = { ...data }; const weeks = Math.max(0, Math.min(52, Number(data.repeat) || 0)); delete base.repeat;
      if (!base.title) base.title = base.type === "Floor session" ? "Floor session" : base.committee ? `${base.committee} — ${base.type.toLowerCase()}` : base.type;
      try { localStorage.setItem("dash.time", base.time || ""); localStorage.setItem("dash.location", base.location || ""); } catch {}
      return Array.from({ length: weeks + 1 }, (_, i) => ({ ...base, date: addDays(base.date, i * 7) }));
    } }
};
function remember(k) { try { return localStorage.getItem("dash." + k) || ""; } catch { return ""; } }

export async function mountRecords(ctx) {
  const key = ctx.page.coll, cfg = COLLECTIONS[key], title = ctx.label;
  let rows = [], editing = null, form = null;

  async function list() {
    editing = null;
    const filterOpts = cfg.filterBy ? [...new Set((await load(key, true)).map(r => r[cfg.filterBy]).filter(Boolean))].sort(natCompare) : [];
    rows = (await load(key, true)).slice().sort((a, b) => natCompare(b[cfg.sort], a[cfg.sort]));
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>${esc(title)}</h2><input id="recQ" placeholder="Filter…">
      ${filterOpts.length ? `<select id="recF" class="bar-sel"><option value="">All</option>${filterOpts.map(o => `<option>${esc(o)}</option>`).join("")}</select>` : ""}
      <button class="btn btn-gold btn-sm" data-act="newRec">+ New</button></div><div id="recList"></div></div>`;
    document.getElementById("recQ").addEventListener("input", drawList);
    const f = document.getElementById("recF"); if (f) f.addEventListener("change", drawList);
    drawList();
  }

  function drawList() {
    const q = (document.getElementById("recQ").value || "").toLowerCase(), fv = (document.getElementById("recF") || {}).value;
    const shown = rows.filter(r => (!q || JSON.stringify(r).toLowerCase().includes(q)) && (!fv || r[cfg.filterBy] === fv));
    const lab = k => cfg.fields.find(f => f.key === k).label.replace(/\s*\(.*\)/, "");
    document.getElementById("recList").innerHTML = shown.length
      ? `<table class="tbl click"><thead><tr>${cfg.cols.map(c => `<th>${esc(lab(c))}</th>`).join("")}</tr></thead><tbody>${shown.map(r =>
          `<tr data-act="editRec" data-id="${esc(r._id)}">${cfg.cols.map(c => `<td>${esc(r[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : '<div class="empty-state" style="padding:1rem 0">Nothing here yet. Use “+ New” to add one.</div>';
  }

  async function openForm(item) {
    editing = { id: item ? item._id : null };
    const fields = cfg.fields.filter(f => !(f.newOnly && item));
    const env = await prepare(fields, rows);
    form = buildForm(fields, item, env, { lockKey: cfg.idField });
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="cancelRec">&larr; Back</button><h2>${item ? "Edit" : "New"} — ${esc(title)}</h2></div>
      <div id="recForm" class="grid2">${form.html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="saveRec">Save</button>
        <button class="btn btn-outline" data-act="cancelRec">Cancel</button>
        ${item ? '<button class="btn btn-danger" data-act="deleteRec" style="margin-left:auto">Delete</button>' : ""}</div></div>`;
    form.init(document.getElementById("recForm"));
  }

  async function saveRec(btn) {
    const { data, errs } = form.collect(document.getElementById("recForm"));
    if (errs.length) return ctx.flash(errs[0], "err");
    const who = ctx.acct.name, existing = editing.id;
    btn.disabled = true;
    try {
      const batch = writeBatch(db);
      if (cfg.expand) {
        cfg.expand(data).forEach(d => {
          const ref = existing ? doc(db, key, existing) : doc(collection(db, key));
          batch.set(ref, { ...d, ...stamp(who) });
        });
      } else {
        const id = existing || String(data[cfg.idField]).trim().replace(/\//g, "-");
        if (!existing && rows.some(r => r._id === id)) { btn.disabled = false; return ctx.flash(`A record with that ${cfg.idField} already exists. Edit it instead.`, "err"); }
        if (cfg.save) await cfg.save(batch, { ...data }, who); else batch.set(doc(db, key, id), { ...data, ...stamp(who) });
      }
      await batch.commit(); invalidate(key);
      await list(); ctx.flash(cfg.expand && !existing && (Number(data.repeat) > 0) ? `Created ${Number(data.repeat) + 1} events.` : "Saved.");
    } catch (e) { console.error(e); btn.disabled = false; ctx.flash("Couldn't save: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); }
  }

  ctx.on({
    newRec() { return openForm(null); },
    editRec(b) { return openForm(rows.find(r => r._id === b.dataset.id)); },
    saveRec,
    cancelRec() { return list(); },
    async deleteRec() {
      if (!confirm("Delete this record permanently?")) return;
      try { await deleteDoc(doc(db, key, editing.id)); invalidate(key); await list(); ctx.flash("Deleted."); }
      catch (e) { ctx.flash("Couldn't delete: " + e.message, "err"); }
    }
  });
  await list();
}