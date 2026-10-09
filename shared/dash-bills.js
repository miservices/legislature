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
    { key: "committee", label: "Committee", type: "select", options: COMMITTEES, span: 4 },
    { key: "introducedDate", label: "Introduced", type: "date", default: "today", span: 2 },
    { key: "description", label: "Description", type: "textarea", rows: 3, full: true }
  ];
  const docFields = () => [
    { key: "driveUrl", label: "Introduced text (Google Drive link)", type: "url" },
    { key: "enrolledUrl", label: res ? "Adopted text (Google Drive link)" : "Enrolled text (Google Drive link)", type: "url" },
    { key: "substituteUrls", label: "Substitute texts", type: "list", itemType: "url", full: true },
    ...(res ? [] : [
      { key: "amendsActs", label: "Amends these public acts", type: "refs", cast: "number", from: "publicActs", placeholder: "Search public acts…", option: a => ({ value: String(a.number), label: `Public Act ${a.number} of ${a.year} — ${a.title}` }), hint: "Linked automatically on the amended act’s page." },
      { key: "repealsActs", label: "Repeals these public acts", type: "refs", cast: "number", from: "publicActs", placeholder: "Search public acts…", option: a => ({ value: String(a.number), label: `Public Act ${a.number} of ${a.year} — ${a.title}` }) }
    ])
  ];
  const newFields = () => [{ key: "number", label: `${word} number`, type: "number", req: true, auto: "number", span: 2 }, ...detailFields(), ...docFields()];
  let fs = "", tab = "timeline", form2 = null;

  /* ---------------------------------------------------------------- list */
  async function list() {
    cur = null; pa = null;
    rows = (await load(coll, true)).slice().sort((a, b) => Number(b.number) - Number(a.number));
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>${word}s</h2><input id="q" placeholder="Search number, title, sponsor…">
      <select id="fc" class="bar-sel"><option value="">All committees</option>${COMMITTEES.map(s => `<option>${esc(s)}</option>`).join("")}</select>
      <button class="btn btn-gold btn-sm" data-act="newItem">+ New</button></div>
      <div class="chips" id="chips"></div><div id="rows"></div></div>`;
    ["q", "fc"].forEach(id => document.getElementById(id).addEventListener(id === "q" ? "input" : "change", draw));
    draw();
  }
  function draw() {
    const q = document.getElementById("q").value.toLowerCase(), c = document.getElementById("fc").value;
    const base = rows.filter(r => (!q || [r.number, r.title, r.sponsors].join(" ").toLowerCase().includes(q)) && (!c || r.committee === c));
    const shown = base.filter(r => !fs || r.status === fs);
    const count = s => base.filter(r => r.status === s).length;
    document.getElementById("chips").innerHTML = [["", "All", base.length], ...STATUSES.map(s => [s, s, count(s)]).filter(x => x[2] || x[0] === fs)]
      .map(([v, l, n]) => `<button class="chip ${fs === v ? "on" : ""}" data-act="chip" data-s="${esc(v)}">${esc(l)} <i>${n}</i></button>`).join("");
    document.getElementById("rows").innerHTML = shown.length ? `<table class="tbl click"><thead><tr><th style="width:70px">No.</th><th>Title</th><th>Status</th><th>Sponsors</th><th>Committee</th></tr></thead><tbody>${shown.map(r =>
      `<tr data-act="open" data-id="${esc(r._id)}"><td><b>${esc(r.number)}</b></td><td>${esc(r.title)}</td><td><span class="badge ${badgeClass(r.status)}">${esc(r.status)}</span></td><td class="dim">${esc(r.sponsors || "—")}</td><td class="dim">${esc((r.committee || "—").replace(/^(Special )?Committee on /, ""))}</td></tr>`).join("")}</tbody></table>`
      : `<div class="empty-state" style="padding:1rem 0">No ${plural} match. Proposals from legislators arrive through <b>Review proposals</b>.</div>`;
  }

  /* ---------------------------------------------------------------- detail */
  const stepper = r => {
    const steps = res ? ["Introduced", "In committee", "Floor vote", "Adopted"] : ["Introduced", "In committee", "Floor vote", "Awaiting governor", "Enacted"];
    const ended = ["Tabled", "Defeated", "Vetoed", "Repealed"].includes(r.status), idx = steps.indexOf(r.status), last = steps.length - 1;
    return `<ol class="stepper">${steps.map((st, i) => {
      const done = ended ? i === 0 : (idx === last || i < idx), now = !ended && i === idx && idx !== last;
      return `<li class="${done ? "done" : now ? "now" : ""}"><span class="dot">${done ? "&#10003;" : i + 1}</span><span class="lbl">${esc(st)}</span></li>`;
    }).join("")}${ended ? `<li class="end"><span class="dot">!</span><span class="lbl">${esc(r.status)}</span></li>` : ""}</ol>`;
  };

  async function open(id, keepTab) {
    rows = (await load(coll, true)).slice(); cur = rows.find(r => r._id === id); pa = null;
    if (!cur) return list();
    if (!keepTab) tab = "timeline";
    const r = cur, hist = asList(r.history);
    const env = await prepare([...detailFields(), ...docFields()], rows);
    form = buildForm(detailFields(), r, env); form2 = buildForm(docFields(), r, env);
    ctx.panel.innerHTML = `
      <div class="card hdr"><div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; All ${plural}</button>
        <span class="grow"></span><a class="dlink" href="../../${plural}/#${esc(r.number)}" target="_blank" rel="noopener">View public page &nearr;</a></div>
        <div class="hline"><span class="hnum">${esc(title(r))}</span><span class="badge ${badgeClass(r.status)}">${esc(r.status)}</span></div>
        <h2 class="htitle">${esc(r.title)}</h2>
        <div class="dmeta">${[r.sponsors && esc(r.sponsors), r.committee && esc(r.committee), r.introducedDate && "Introduced " + esc(longDate(r.introducedDate))].filter(Boolean).join(" &nbsp;·&nbsp; ")}
          ${!res && r.paNumber ? ` &nbsp;·&nbsp; <a href="../../public-acts/#${esc(r.paNumber)}">Public Act ${esc(r.paNumber)}</a>` : ""}</div>
        ${stepper(r)}
        <div id="steps">${stepsHtml(r)}</div></div>
      <div class="card"><div class="tabs">
          <button data-act="tab" data-t="timeline" class="${tab === "timeline" ? "on" : ""}">Timeline <i>${hist.length}</i></button>
          <button data-act="tab" data-t="details" class="${tab === "details" ? "on" : ""}">Details</button>
          <button data-act="tab" data-t="docs" class="${tab === "docs" ? "on" : ""}">Documents${res ? "" : " &amp; amendments"}</button></div>
        <div class="pane" data-p="timeline" ${tab === "timeline" ? "" : "hidden"}>
          <div class="tl-edit">${hist.length ? hist.map((h, i) => `<div class="tl-row"><span class="dot"></span><span class="tl-t">${esc(h)}</span><button class="rep-x" data-act="delHist" data-i="${i}" title="Remove">&times;</button></div>`).join("") : '<div class="empty-state" style="padding:.5rem 0">No history yet.</div>'}</div>
          <div class="inline-add"><input id="note" placeholder="Add a note (e.g. Amendment offered by Rep. Nowak)"><button class="btn btn-outline btn-sm" data-act="addNote">Add note</button></div></div>
        <div class="pane" data-p="details" ${tab === "details" ? "" : "hidden"}><div id="detail" class="grid2">${form.html}</div></div>
        <div class="pane" data-p="docs" ${tab === "docs" ? "" : "hidden"}><div id="docs" class="grid2">${form2.html}</div></div>
        <div class="form-actions" id="saveBar" ${tab === "timeline" ? "hidden" : ""}><button class="btn btn-primary" data-act="saveDetail">Save changes</button>
          <button class="btn btn-danger" data-act="deleteItem" style="margin-left:auto">Delete ${word.toLowerCase()}</button></div></div>`;
    form.init(document.getElementById("detail")); form2.init(document.getElementById("docs"));
  }

  /* The "what happens next" bar: only the buttons that make sense for the current status. */
  function stepsHtml(r) {
    const s = r.status, committee = r.committee;
    const cm = `<select id="refer" class="bar-sel">${COMMITTEES.map(c => `<option ${c === committee ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`;
    const tableLink = !["Tabled", "Defeated", "Vetoed", "Enacted", "Adopted", "Repealed"].includes(s) ? `<span class="grow"></span><button class="linkbtn" data-act="table">Table it</button>` : "";
    let body;
    if (s === "Introduced") body = `<b class="nx">Next</b>${cm}<button class="btn btn-primary btn-sm" data-act="refer">Refer to committee</button>`;
    else if (s === "In committee") body = `<b class="nx">Next</b><button class="btn btn-primary btn-sm" data-act="report">Report out to the floor</button><span class="or">or re-refer</span>${cm}<button class="btn btn-outline btn-sm" data-act="refer">Re-refer</button>`;
    else if (s === "Floor vote") body = `<b class="nx">Floor vote</b><label class="tally">Yeas <input id="yeas" type="number" min="0"></label><label class="tally">Nays <input id="nays" type="number" min="0"></label>
        <button class="btn btn-primary btn-sm" data-act="pass">${res ? "Adopted" : "Passed"}</button><button class="btn btn-danger btn-sm" data-act="defeat">Defeated</button>`;
    else if (s === "Awaiting governor") body = `<b class="nx">Governor</b><button class="btn btn-primary btn-sm" data-act="startEnact">Signed — enact as Public Act</button><button class="btn btn-danger btn-sm" data-act="veto">Vetoed</button>`;
    else if (s === "Tabled") body = `<b class="nx">Tabled</b><button class="btn btn-primary btn-sm" data-act="untable">Take from the table</button>`;
    else body = `<span class="done-note">${s === "Enacted" ? `Enacted as <a href="../../public-acts/#${esc(r.paNumber)}">Public Act ${esc(r.paNumber || "")}</a>.` : `${esc(s)}.`} Nothing further to do.</span>`;
    return `<div class="actionbar">${body}${tableLink}</div>`;
  }

  /* Apply a transition: status + automatic timeline line, then keep amendment links in step. */
  async function transition(status, text, extra = {}) {
    const r = { ...cur, status, ...extra };
    const history = [...asList(cur.history), dated(text)];
    const batch = writeBatch(db);
    batch.update(doc(db, coll, cur._id), { status, history, ...extra, ...stamp(who) });
    if (!res) await syncAmendments(batch, { ...r, history }, who);
    await batch.commit(); invalidate(coll);
    await open(cur._id, true);
  }
  const tally = () => { const y = document.getElementById("yeas")?.value, n = document.getElementById("nays")?.value; return y !== "" && y != null && n !== "" && n != null ? `, ${y} yeas, ${n} nays` : ""; };
  const guard = fn => async b => { b.disabled = true; try { await fn(b); } catch (e) { console.error(e); b.disabled = false; ctx.flash("Couldn't save: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); } };

  /* ---------------------------------------------------------------- new */
  async function newItem() {
    const fields = newFields();
    const env = await prepare(fields, rows);
    form = buildForm(fields, null, env);
    cur = null;
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; Back</button><h2>New ${word.toLowerCase()}</h2></div>
      <p class="lead">Legislators’ own proposals come through <b>Review proposals</b>. Use this to enter one directly.</p>
      <div id="detail" class="grid2">${form.html}</div><div class="form-actions"><button class="btn btn-primary" data-act="saveNew">Introduce</button><button class="btn btn-outline" data-act="back">Cancel</button></div></div>`;
    form.init(document.getElementById("detail"));
  }

  ctx.on({
    back: () => list(),
    chip(b) { fs = b.dataset.s; draw(); },
    tab(b) {
      tab = b.dataset.t;
      ctx.panel.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
      ctx.panel.querySelectorAll(".pane").forEach(p => { p.hidden = p.dataset.p !== tab; });
      document.getElementById("saveBar").hidden = tab === "timeline";
    },
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
      const c1 = form.collect(document.getElementById("detail")), c2 = form2.collect(document.getElementById("docs"));
      const errs = [...c1.errs, ...c2.errs], data = { ...c1.data, ...c2.data };
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      const rec = { ...cur, ...data }, batch = writeBatch(db);
      batch.update(doc(db, coll, cur._id), { ...data, ...stamp(who) });
      if (!res) await syncAmendments(batch, rec, who);
      await batch.commit(); invalidate(coll); await open(cur._id, true); ctx.flash("Saved.");
    }),
    addNote: guard(async b => {
      const t = document.getElementById("note").value.trim(); if (!t) { b.disabled = false; return; }
      await updateDoc(doc(db, coll, cur._id), { history: [...asList(cur.history), dated(t)], ...stamp(who) }); invalidate(coll); await open(cur._id, true);
    }),
    delHist: guard(async b => {
      const h = asList(cur.history); h.splice(+b.dataset.i, 1);
      await updateDoc(doc(db, coll, cur._id), { history: h, ...stamp(who) }); invalidate(coll); await open(cur._id, true);
    }),
    deleteItem: guard(async b => {
      if (!confirm(`Delete ${title(cur)} permanently?`)) { b.disabled = false; return; }
      const batch = writeBatch(db); batch.delete(doc(db, coll, cur._id));
      if (!res) await syncAmendments(batch, { ...cur, status: "Defeated" }, who);   // clears its links on other bills
      await batch.commit(); invalidate(coll); await list(); ctx.flash("Deleted.");
    }),
    cancelEnact: () => open(cur._id, true),
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
      await open(cur._id, true); ctx.flash(`Public Act ${data.number} created.`);
    })
  });

  async function enactForm() {
    const fields = COLLECTIONS.publicActs.fields.filter(f => ["number", "year", "title", "signedDate", "effectiveDate", "amends", "description"].includes(f.key));
    const env = await prepare(fields, await load("publicActs", true));
    pa = buildForm(fields, null, env, { seed: { title: cur.title || "", description: cur.description || "" } });
    document.getElementById("steps").innerHTML = `<div class="enact"><h3>Enact as a Public Act</h3>
      <p class="lead">Number, year and dates are already set. Pick any MCL sections the act changes and each gets its history updated for you.</p>
      <div id="enact" class="grid2">${pa.html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="confirmEnact">Create Public Act &amp; mark enacted</button><button class="btn btn-outline" data-act="cancelEnact">Cancel</button></div></div>`;
    pa.init(document.getElementById("enact"));
  }
  await list();
  if (new URLSearchParams(location.search).has("new")) newItem();
}