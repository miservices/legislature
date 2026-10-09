/* Dashboard › Bills and Resolutions. Instead of editing a status field and typing history lines,
   an admin opens a bill and presses the next step; the timeline, status and links are written for them. */
import { db, doc, setDoc, updateDoc, deleteDoc, writeBatch } from "./fb.js";
import { esc, asList, natCompare, badgeClass, COMMITTEES, docLink } from "./util.js";
import { BILL_STATUSES, RES_STATUSES } from "./bills-view.js";
import { todayISO, longDate } from "./dash-ui.js";
import { load, invalidate, stamp, dated, syncAmendments, writePublicAct } from "./dash-data.js";
import { prepare, buildForm } from "./dash-form.js";
import { COLLECTIONS } from "./dash-records.js";

export async function mountWorkflow(ctx, kind) {
  const res = kind === "resolution", coll = res ? "resolutions" : "bills", word = res ? "Resolution" : "Bill", plural = res ? "resolutions" : "bills";
  const STATUSES = res ? RES_STATUSES : BILL_STATUSES, FINAL = res ? "Adopted" : "Awaiting governor";
  const who = ctx.acct.name;
  let rows = [], cur = null, form = null, pa = null;

  const byNum = n => rows.find(r => String(r.number) === String(n));
  const title = r => `${word} No. ${r.number}`;

  const detailFields = () => [
    { key: "title", label: "Title", req: true, full: true },
    { key: "sponsors", label: "Sponsors", type: "people", full: true, placeholder: "Pick a legislator or type a name…" },
    { key: "committee", label: "Committee", type: "select", options: COMMITTEES },
    { key: "introducedDate", label: "Introduced", type: "date", default: "today" },
    { key: "description", label: "Description", type: "textarea", full: true },
    { key: "driveUrl", label: "Introduced text (Google Drive link)", type: "url", full: true },
    { key: "substituteUrls", label: "Substitute texts", type: "list", itemType: "url", full: true },
    { key: "enrolledUrl", label: res ? "Adopted text (Google Drive link)" : "Enrolled text (Google Drive link)", type: "url", full: true },
    ...(res ? [] : [
      { key: "amendsActs", label: "Amends these public acts", type: "refs", cast: "number", from: "publicActs", full: true, placeholder: "Search public acts…", option: a => ({ value: String(a.number), label: `Public Act ${a.number} of ${a.year} — ${a.title}` }), hint: "Linked automatically on the amended act’s page." },
      { key: "repealsActs", label: "Repeals these public acts", type: "refs", cast: "number", from: "publicActs", full: true, placeholder: "Search public acts…", option: a => ({ value: String(a.number), label: `Public Act ${a.number} of ${a.year} — ${a.title}` }) }
    ])
  ];

  /* ---------------------------------------------------------------- list */
  async function list() {
    cur = null; pa = null;
    rows = (await load(coll, true)).slice().sort((a, b) => Number(b.number) - Number(a.number));
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>${word}s</h2><input id="q" placeholder="Search number, title, sponsor…">
      <select id="fs" class="bar-sel"><option value="">All statuses</option>${STATUSES.map(s => `<option>${esc(s)}</option>`).join("")}</select>
      <select id="fc" class="bar-sel"><option value="">All committees</option>${COMMITTEES.map(s => `<option>${esc(s)}</option>`).join("")}</select>
      <button class="btn btn-gold btn-sm" data-act="newItem">+ New</button></div><div id="rows"></div></div>`;
    ["q", "fs", "fc"].forEach(id => document.getElementById(id).addEventListener(id === "q" ? "input" : "change", draw));
    draw();
  }
  function draw() {
    const q = document.getElementById("q").value.toLowerCase(), s = document.getElementById("fs").value, c = document.getElementById("fc").value;
    const shown = rows.filter(r => (!q || [r.number, r.title, r.sponsors].join(" ").toLowerCase().includes(q)) && (!s || r.status === s) && (!c || r.committee === c));
    document.getElementById("rows").innerHTML = shown.length ? `<table class="tbl click"><thead><tr><th>No.</th><th>Title</th><th>Status</th><th>Committee</th></tr></thead><tbody>${shown.map(r =>
      `<tr data-act="open" data-id="${esc(r._id)}"><td>${esc(r.number)}</td><td>${esc(r.title)}</td><td><span class="badge ${badgeClass(r.status)}">${esc(r.status)}</span></td><td>${esc(r.committee || "")}</td></tr>`).join("")}</tbody></table>`
      : `<div class="empty-state" style="padding:1rem 0">No ${plural} match. Proposals from legislators arrive through <b>Review proposals</b>.</div>`;
  }

  /* ---------------------------------------------------------------- detail */
  async function open(id) {
    rows = (await load(coll, true)).slice(); cur = rows.find(r => r._id === id); pa = null;
    if (!cur) return list();
    const r = cur, hist = asList(r.history);
    const env = await prepare(detailFields(), rows);
    form = buildForm(detailFields(), r, env);
    ctx.panel.innerHTML = `
      <div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; All ${plural}</button><h2>${esc(title(r))}</h2>
        <span class="badge ${badgeClass(r.status)}">${esc(r.status)}</span></div>
        <h3 class="dtitle">${esc(r.title)}</h3>
        <div class="dmeta">${[r.sponsors && "Sponsors: " + esc(r.sponsors), r.committee && esc(r.committee), r.introducedDate && "Introduced " + esc(longDate(r.introducedDate))].filter(Boolean).join(" · ")}
          ${!res && r.paNumber ? ` · <a href="../../public-acts/#${esc(r.paNumber)}">Public Act ${esc(r.paNumber)}</a>` : ""}
          · <a href="../../${plural}/#${esc(r.number)}" target="_blank" rel="noopener">View public page</a></div></div>
      <div class="card" id="steps">${stepsHtml(r)}</div>
      <div class="card"><h2>Timeline</h2>
        <div class="tl-edit">${hist.length ? hist.map((h, i) => `<div class="tl-row"><span>${esc(h)}</span><button class="rep-x" data-act="delHist" data-i="${i}" title="Remove">&times;</button></div>`).join("") : '<div class="empty-state" style="padding:.5rem 0">No history yet.</div>'}</div>
        <div class="inline-add"><input id="note" placeholder="Add a note to the timeline (e.g. Amendment offered by Rep. Nowak)"><button class="btn btn-outline btn-sm" data-act="addNote">Add</button></div></div>
      <div class="card"><h2>Details</h2><div id="detail" class="grid2">${form.html}</div>
        <div class="form-actions"><button class="btn btn-primary" data-act="saveDetail">Save details</button>
        <button class="btn btn-danger" data-act="deleteItem" style="margin-left:auto">Delete ${word.toLowerCase()}</button></div></div>`;
    form.init(document.getElementById("detail"));
  }

  /* The "what happens next" card: only the buttons that make sense for the current status. */
  function stepsHtml(r) {
    const s = r.status, committee = r.committee;
    const cm = `<select id="refer" class="bar-sel">${COMMITTEES.map(c => `<option ${c === committee ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`;
    let body = "";
    if (s === "Introduced") body = `<p class="lead">Refer to a committee.</p><div class="step-row">${cm}<button class="btn btn-primary btn-sm" data-act="refer">Refer to committee</button></div>`;
    else if (s === "In committee") body = `<p class="lead">In ${esc(committee || "committee")}.</p><div class="step-row"><button class="btn btn-primary btn-sm" data-act="report">Report out to the floor</button><span class="or">or re-refer:</span>${cm}<button class="btn btn-outline btn-sm" data-act="refer">Re-refer</button></div>`;
    else if (s === "Floor vote") body = `<p class="lead">Record the floor vote.</p><div class="step-row"><label class="tally">Yeas <input id="yeas" type="number" min="0"></label><label class="tally">Nays <input id="nays" type="number" min="0"></label>
        <button class="btn btn-primary btn-sm" data-act="pass">${res ? "Adopted" : "Passed"}</button><button class="btn btn-danger btn-sm" data-act="defeat">Defeated</button></div>`;
    else if (s === "Awaiting governor") body = `<p class="lead">Awaiting the Governor.</p><div class="step-row"><button class="btn btn-primary btn-sm" data-act="startEnact">Signed — enact as Public Act</button><button class="btn btn-danger btn-sm" data-act="veto">Vetoed</button></div>`;
    else if (s === "Tabled") body = `<div class="step-row"><button class="btn btn-primary btn-sm" data-act="untable">Take from the table</button></div>`;
    else body = `<p class="lead" style="margin:0">${s === "Enacted" ? `Enacted as <a href="../../public-acts/#${esc(r.paNumber)}">Public Act ${esc(r.paNumber || "")}</a>.` : `Status: ${esc(s)}.`} Nothing further to do.</p>`;
    const canTable = !["Tabled", "Defeated", "Vetoed", "Enacted", "Adopted", "Repealed"].includes(s);
    return `<h2>Next step</h2><div id="stepBody">${body}</div>${canTable ? `<div class="step-row" style="margin-top:.8rem"><button class="btn btn-outline btn-sm" data-act="table">Table it</button></div>` : ""}`;
  }

  /* Apply a transition: status + automatic timeline line, then keep amendment links in step. */
  async function transition(status, text, extra = {}) {
    const r = { ...cur, status, ...extra };
    const history = [...asList(cur.history), dated(text)];
    const batch = writeBatch(db);
    batch.update(doc(db, coll, cur._id), { status, history, ...extra, ...stamp(who) });
    if (!res) await syncAmendments(batch, { ...r, history }, who);
    await batch.commit(); invalidate(coll);
    await open(cur._id);
  }
  const tally = () => { const y = document.getElementById("yeas")?.value, n = document.getElementById("nays")?.value; return y !== "" && y != null && n !== "" && n != null ? `, ${y} yeas, ${n} nays` : ""; };
  const guard = fn => async b => { b.disabled = true; try { await fn(b); } catch (e) { console.error(e); b.disabled = false; ctx.flash("Couldn't save: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); } };

  /* ---------------------------------------------------------------- new */
  async function newItem() {
    const fields = [{ key: "number", label: `${word} number`, type: "number", req: true, auto: "number" }, ...detailFields()];
    const env = await prepare(fields, rows);
    form = buildForm(fields, null, env);
    cur = null;
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; Back</button><h2>New ${word.toLowerCase()}</h2></div>
      <p class="lead">Legislators’ own proposals come through <b>Review proposals</b>. Use this to enter one directly.</p>
      <div id="detail" class="grid2">${form.html}</div><div class="form-actions"><button class="btn btn-primary" data-act="saveNew">Introduce</button></div></div>`;
    form.init(document.getElementById("detail"));
  }

  ctx.on({
    back: () => list(),
    open: b => open(b.dataset.id),
    newItem,
    refer: guard(async () => { const c = document.getElementById("refer").value; await transition("In committee", `Referred to the ${c}`, { committee: c }); }),
    report: guard(() => transition("Floor vote", `Reported from the ${cur.committee || "committee"}`)),
    pass: guard(() => transition(FINAL, res ? `Adopted by the Legislature${tally()}` : `Passed by the Legislature${tally()}`)),
    defeat: guard(() => transition("Defeated", `Failed on the floor${tally()}`)),
    veto: guard(() => transition("Vetoed", "Vetoed by the Governor")),
    table: guard(() => transition("Tabled", "Tabled")),
    untable: guard(() => transition(cur.committee ? "In committee" : "Introduced", "Taken from the table")),

    startEnact: () => enactForm(),
    saveNew: guard(async b => {
      const { data, errs } = form.collect(document.getElementById("detail"));
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      if (byNum(data.number)) { b.disabled = false; return ctx.flash(`${word} No. ${data.number} already exists.`, "err"); }
      const history = [dated(`Introduced${data.sponsors ? " by " + data.sponsors : ""}`), ...(data.committee ? [dated(`Referred to the ${data.committee}`)] : [])];
      const rec = { ...data, status: data.committee ? "In committee" : "Introduced", substituteUrls: data.substituteUrls || [], enrolledUrl: data.enrolledUrl || "", history };
      const batch = writeBatch(db); batch.set(doc(db, coll, String(rec.number)), { ...rec, ...stamp(who) });
      if (!res) await syncAmendments(batch, rec, who);
      await batch.commit(); invalidate(coll); await list(); ctx.flash(`${title(rec)} introduced.`);
    }),
    saveDetail: guard(async b => {
      const { data, errs } = form.collect(document.getElementById("detail"));
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      const rec = { ...cur, ...data }, batch = writeBatch(db);
      batch.update(doc(db, coll, cur._id), { ...data, ...stamp(who) });
      if (!res) await syncAmendments(batch, rec, who);
      await batch.commit(); invalidate(coll); await open(cur._id); ctx.flash("Saved.");
    }),
    addNote: guard(async b => {
      const t = document.getElementById("note").value.trim(); if (!t) { b.disabled = false; return; }
      await updateDoc(doc(db, coll, cur._id), { history: [...asList(cur.history), dated(t)], ...stamp(who) }); invalidate(coll); await open(cur._id);
    }),
    delHist: guard(async b => {
      const h = asList(cur.history); h.splice(+b.dataset.i, 1);
      await updateDoc(doc(db, coll, cur._id), { history: h, ...stamp(who) }); invalidate(coll); await open(cur._id);
    }),
    deleteItem: guard(async b => {
      if (!confirm(`Delete ${title(cur)} permanently?`)) { b.disabled = false; return; }
      const batch = writeBatch(db); batch.delete(doc(db, coll, cur._id));
      if (!res) await syncAmendments(batch, { ...cur, status: "Defeated" }, who);   // clears its links on other bills
      await batch.commit(); invalidate(coll); await list(); ctx.flash("Deleted.");
    }),
    cancelEnact: () => open(cur._id),
    confirmEnact: guard(async b => {
      const { data, errs } = pa.collect(document.getElementById("enact"));
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      const acts = await load("publicActs", true);
      if (acts.some(a => Number(a.number) === Number(data.number))) { b.disabled = false; return ctx.flash(`Public Act ${data.number} already exists.`, "err"); }
      const history = [...asList(cur.history), dated(`Signed by the Governor — Public Act ${data.number} of ${data.year}`)];
      const batch = writeBatch(db);
      await writePublicAct(batch, { ...data, billNumber: Number(cur.number), status: "In effect", text: "", driveUrl: cur.enrolledUrl || "" }, who);
      batch.update(doc(db, coll, cur._id), { status: "Enacted", paNumber: Number(data.number), history, ...stamp(who) });
      await syncAmendments(batch, { ...cur, status: "Enacted", paNumber: Number(data.number), history }, who);
      await batch.commit(); invalidate(coll, "publicActs", "mclSections");
      await open(cur._id); ctx.flash(`Public Act ${data.number} created.`);
    })
  });

  async function enactForm() {
    const fields = COLLECTIONS.publicActs.fields.filter(f => ["number", "year", "title", "signedDate", "effectiveDate", "amends", "description"].includes(f.key));
    const env = await prepare(fields, await load("publicActs", true));
    pa = buildForm(fields, null, env);
    const html = pa.html;
    document.getElementById("stepBody").innerHTML = `<p class="lead">Fill in the act. The number, year and dates are already set; pick any MCL sections it changes and they’ll be updated for you.</p>
      <div id="enact" class="grid2">${html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="confirmEnact">Create Public Act &amp; mark enacted</button><button class="btn btn-outline" data-act="cancelEnact">Cancel</button></div>`;
    const root = document.getElementById("enact");
    pa.init(root);
    root.querySelector("#f_title").value = cur.title || "";
    root.querySelector("#f_description").value = cur.description || "";
  }
  await list();
}