/* Dashboard › record editor (list / create / edit / delete) for one Firestore collection.
   Used by every "Official record" page; the collection comes from the page's entry in PAGES. */
import { db, doc, getDoc, setDoc, addDoc, deleteDoc, collection, getDocs, serverTimestamp } from "./fb.js";
import { esc, asList, safeUrl, natCompare, COMMITTEES } from "./util.js";
import { BILL_STATUSES, RES_STATUSES } from "./bills-view.js";

const SEL = { bill: BILL_STATUSES, res: RES_STATUSES };
export const COLLECTIONS = {
  bills: { idField: "number", cols: ["number", "title", "status"], sort: "number",
    fields: [
      { key: "number", label: "Bill number", type: "number", req: true },
      { key: "title", label: "Title", req: true },
      { key: "status", label: "Status", type: "select", options: SEL.bill, req: true },
      { key: "committee", label: "Committee", type: "select", options: COMMITTEES },
      { key: "sponsors", label: "Sponsors" },
      { key: "introducedDate", label: "Introduced", type: "date" },
      { key: "description", label: "Description", type: "textarea", full: true },
      { key: "driveUrl", label: "Introduced text (Google Drive link)", type: "url", full: true },
      { key: "substituteUrls", label: "Substitute text links", type: "list", full: true },
      { key: "enrolledUrl", label: "Enrolled text link", type: "url", full: true },
      { key: "paNumber", label: "Public Act number", type: "number" },
      { key: "amendatoryBills", label: "Amendatory bills (e.g. 594B, 973A, 12R)", type: "list" },
      { key: "history", label: "History (one entry per line)", type: "list", full: true }
    ] },
  resolutions: { idField: "number", cols: ["number", "title", "status"], sort: "number",
    fields: [
      { key: "number", label: "Resolution number", type: "number", req: true },
      { key: "title", label: "Title", req: true },
      { key: "status", label: "Status", type: "select", options: SEL.res, req: true },
      { key: "committee", label: "Committee", type: "select", options: COMMITTEES },
      { key: "sponsors", label: "Sponsors" },
      { key: "introducedDate", label: "Introduced", type: "date" },
      { key: "description", label: "Description", type: "textarea", full: true },
      { key: "driveUrl", label: "Introduced text (Google Drive link)", type: "url", full: true },
      { key: "substituteUrls", label: "Substitute text links", type: "list", full: true },
      { key: "enrolledUrl", label: "Adopted text link", type: "url", full: true },
      { key: "history", label: "History (one entry per line)", type: "list", full: true }
    ] },
  publicActs: { idField: "number", cols: ["number", "year", "title"], sort: "number",
    fields: [
      { key: "number", label: "Public Act number", type: "number", req: true },
      { key: "year", label: "Year", type: "number", req: true },
      { key: "title", label: "Title", req: true, full: true },
      { key: "billNumber", label: "Source bill number", type: "number" },
      { key: "status", label: "Status", type: "select", options: ["In effect", "Amended", "Repealed"] },
      { key: "signedDate", label: "Signed", type: "date" },
      { key: "effectiveDate", label: "Effective", type: "date" },
      { key: "amends", label: "MCL sections it amends (one per line, e.g. 750.32)", type: "list", full: true },
      { key: "description", label: "Summary", type: "textarea", full: true },
      { key: "text", label: "Act text", type: "textarea", rows: 8, full: true },
      { key: "driveUrl", label: "Enrolled act (Google Drive link)", type: "url", full: true }
    ] },
  mclChapters: { idField: "cite", cols: ["cite", "title", "kind"], sort: "cite",
    fields: [
      { key: "cite", label: "Chapter number (or constitution article number)", req: true },
      { key: "title", label: "Title", req: true },
      { key: "kind", label: "Kind", type: "select", options: ["chapter", "constitution"], req: true },
      { key: "article", label: "Article numeral (constitution only, e.g. IV)" }
    ] },
  mclSections: { idField: "cite", cols: ["cite", "title"], sort: "cite",
    before: d => { d.chapter = String(d.cite).split(".")[0]; },
    fields: [
      { key: "cite", label: "Citation (e.g. 750.32)", req: true },
      { key: "title", label: "Title", req: true },
      { key: "text", label: "Text (indent subsections with (a), (i), 1) …)", type: "textarea", rows: 12, full: true },
      { key: "history", label: "History", type: "textarea", full: true }
    ] },
  macRules: { idField: "cite", cols: ["cite", "agency", "title"], sort: "cite",
    fields: [
      { key: "cite", label: "Rule number (e.g. R 408.10101)", req: true },
      { key: "agency", label: "Agency", req: true },
      { key: "title", label: "Title", req: true, full: true },
      { key: "text", label: "Text", type: "textarea", rows: 10, full: true },
      { key: "history", label: "History", type: "textarea", full: true }
    ] },
  executiveOrders: { idField: "number", cols: ["number", "title", "status"], sort: "number",
    fields: [
      { key: "number", label: "Order number (e.g. 2026-1)", req: true },
      { key: "title", label: "Title", req: true, full: true },
      { key: "status", label: "Status", type: "select", options: ["Active", "Rescinded", "Superseded"] },
      { key: "signedDate", label: "Signed", type: "date" },
      { key: "effectiveDate", label: "Effective", type: "date" },
      { key: "rescindedBy", label: "Rescinded / superseded by" },
      { key: "description", label: "Summary", type: "textarea", full: true },
      { key: "text", label: "Order text", type: "textarea", rows: 8, full: true },
      { key: "driveUrl", label: "Full order (Google Drive link)", type: "url", full: true }
    ] },
  execReorgOrders: { idField: "number", cols: ["number", "title", "status"], sort: "number",
    fields: [
      { key: "number", label: "Order number (e.g. 2026-1)", req: true },
      { key: "title", label: "Title", req: true, full: true },
      { key: "status", label: "Status", type: "select", options: ["Submitted", "In effect", "Disapproved", "Rescinded"] },
      { key: "agencies", label: "Agencies affected", full: true },
      { key: "signedDate", label: "Signed", type: "date" },
      { key: "effectiveDate", label: "Effective", type: "date" },
      { key: "description", label: "Summary", type: "textarea", full: true },
      { key: "text", label: "Order text", type: "textarea", rows: 8, full: true },
      { key: "driveUrl", label: "Full order (Google Drive link)", type: "url", full: true }
    ] },
  journals: { idField: "number", cols: ["number", "date", "sessionType"], sort: "number",
    fields: [
      { key: "number", label: "Journal number", type: "number", req: true },
      { key: "date", label: "Session date", type: "date", req: true },
      { key: "sessionType", label: "Session type", type: "select", options: ["Regular", "Special", "Organizational"] },
      { key: "title", label: "Title (optional)", full: true },
      { key: "summary", label: "Highlights", type: "textarea", full: true },
      { key: "driveUrl", label: "Full journal (Google Drive link)", type: "url", full: true }
    ] },
  calendarEvents: { idField: null, cols: ["date", "time", "type", "title"], sort: "date",
    fields: [
      { key: "title", label: "Title", req: true, full: true },
      { key: "date", label: "Date", type: "date", req: true },
      { key: "time", label: "Start time", type: "time" },
      { key: "endTime", label: "End time", type: "time" },
      { key: "type", label: "Type", type: "select", options: ["Floor session", "Committee meeting", "Public hearing", "Other"], req: true },
      { key: "committee", label: "Committee", type: "select", options: COMMITTEES },
      { key: "location", label: "Location" },
      { key: "description", label: "Description", type: "textarea", full: true },
      { key: "agendaUrl", label: "Agenda (Google Drive link)", type: "url", full: true }
    ] }
};

export async function mountRecords(ctx) {
  const key = ctx.page.coll, cfg = COLLECTIONS[key];
  let rows = [], editing = null;   // editing = { id } while the form is open

  async function list() {
    editing = null;
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>${esc(ctx.label)}</h2><input id="recQ" placeholder="Filter…"><button class="btn btn-gold btn-sm" data-act="newRec">+ New</button></div><div id="recList"><div class="skel" style="height:14px;width:50%"></div></div></div>`;
    try {
      const snap = await getDocs(collection(db, key));
      rows = snap.docs.map(d => ({ _id: d.id, ...d.data() })).sort((a, b) => natCompare(b[cfg.sort], a[cfg.sort]));
      drawList();
      document.getElementById("recQ").addEventListener("input", drawList);
    } catch (e) { console.error(e); document.getElementById("recList").innerHTML = '<div class="msg err">Couldn\'t load records.</div>'; }
  }

  function drawList() {
    const q = (document.getElementById("recQ").value || "").toLowerCase();
    const shown = rows.filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    const lab = k => cfg.fields.find(f => f.key === k).label.replace(/\s*\(.*\)/, "");
    document.getElementById("recList").innerHTML = shown.length
      ? `<table class="tbl"><thead><tr>${cfg.cols.map(c => `<th>${esc(lab(c))}</th>`).join("")}<th></th></tr></thead><tbody>${shown.map(r =>
          `<tr>${cfg.cols.map(c => `<td>${esc(r[c] ?? "")}</td>`).join("")}<td style="text-align:right"><button class="btn btn-outline btn-sm" data-act="editRec" data-id="${esc(r._id)}">Edit</button></td></tr>`).join("")}</tbody></table>`
      : '<div class="empty-state" style="padding:1rem 0">No records yet.</div>';
  }

  function fieldHtml(f, v, locked) {
    const id = "f_" + f.key, val = v ?? "";
    let el;
    if (f.type === "textarea") el = `<textarea id="${id}" rows="${f.rows || 4}">${esc(val)}</textarea>`;
    else if (f.type === "list") el = `<textarea id="${id}" rows="4" placeholder="One per line">${esc(asList(val).join("\n"))}</textarea>`;
    else if (f.type === "select") el = `<select id="${id}"><option value="">—</option>${f.options.map(o => `<option ${o === val ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else el = `<input id="${id}" type="${f.type || "text"}" value="${esc(val)}" ${locked ? "disabled" : ""}>`;
    return `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ""}><label for="${id}">${esc(f.label)}${f.req ? " *" : ""}</label>${el}</div>`;
  }

  function openForm(item) {
    editing = { id: item ? item._id : null };
    ctx.panel.innerHTML = `<div class="card"><h2>${item ? "Edit" : "New"} — ${esc(ctx.label)}</h2><p class="lead">Fields marked * are required.</p>
      <div class="grid2">${cfg.fields.map(f => fieldHtml(f, item && item[f.key], item && f.key === cfg.idField)).join("")}</div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.5rem">
        <button class="btn btn-primary" data-act="saveRec">Save</button>
        <button class="btn btn-outline" data-act="cancelRec">Cancel</button>
        ${item ? '<button class="btn btn-danger" data-act="deleteRec" style="margin-left:auto">Delete</button>' : ""}
      </div></div>`;
  }

  async function saveRec() {
    const existing = editing.id, data = {}, errs = [];
    for (const f of cfg.fields) {
      const el = document.getElementById("f_" + f.key);
      let v = el.value.trim();
      if (f.req && !v) errs.push(`${f.label.replace(/\s*\(.*\)/, "")} is required.`);
      if (f.type === "number") { v = v === "" ? null : Number(v); if (v !== null && isNaN(v)) errs.push(`${f.label} must be a number.`); }
      else if (f.type === "list") v = asList(el.value).map(x => (f.key.endsWith("Urls") && !safeUrl(x)) ? (errs.push("Each substitute link must be a valid URL."), x) : x);
      else if (f.type === "url" && v && !safeUrl(v)) errs.push(`${f.label} must be a valid link.`);
      data[f.key] = v;
    }
    if (errs.length) return ctx.flash(errs[0], "err");
    if (cfg.before) cfg.before(data);
    data.updatedAt = serverTimestamp(); data.updatedBy = ctx.acct.name;
    try {
      if (cfg.idField) {
        const id = existing || String(data[cfg.idField]).trim().replace(/\//g, "-");
        if (!existing && (await getDoc(doc(db, key, id))).exists()) return ctx.flash(`A record with that ${cfg.idField} already exists. Edit it instead.`, "err");
        await setDoc(doc(db, key, id), data);
      } else if (existing) await setDoc(doc(db, key, existing), data);
      else await addDoc(collection(db, key), data);
      await list(); ctx.flash("Saved.");
    } catch (e) { console.error(e); ctx.flash("Couldn't save: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); }
  }

  ctx.on({
    newRec() { openForm(null); },
    editRec(b) { openForm(rows.find(r => r._id === b.dataset.id)); },
    saveRec,
    cancelRec() { list(); },
    async deleteRec() {
      if (!confirm("Delete this record permanently?")) return;
      try { await deleteDoc(doc(db, key, editing.id)); await list(); ctx.flash("Deleted."); }
      catch (e) { ctx.flash("Couldn't delete: " + e.message, "err"); }
    }
  });
  await list();
}