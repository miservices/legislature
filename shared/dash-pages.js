/* Every dashboard page: overview, proposals, review, the record editors, bills/resolutions workflow and the MCL page.
   Each page's index.html just calls start("<page key>"). Built on dash-core.js. */
import {
  db, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch, serverTimestamp
} from "./fb.js";
import { esc, asList, natCompare, badgeClass, tsDate, isDriveUrl, COMMITTEES, docEmbed } from "./util.js";
import { BILL_STATUSES, RES_STATUSES } from "./bills-view.js";
import {
  startDash, BASE, todayISO, longDate, addDays, load, invalidate, stamp, dated, appendHistory, syncAmendments, writePublicAct,
  prepare, buildForm, fmt, headerHtml, factsHtml, proseHtml, docsHtml, auditHtml, prepActions, actionBarHtml, pickAction
} from "./dash-core.js";

/* ================================================================
   Overview
   ================================================================ */
const posBadge = p => p === "Chair" ? "b-gold" : p === "Vice Chair" ? "b-navy" : "b-gray";
const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const safe = async fn => { try { return await fn(); } catch { return null; } };

async function overview(ctx) {
  const acct = ctx.acct, admin = ctx.isAdmin;
  const cms = (acct.committees || []).map(c => typeof c === "string" ? { committee: c, position: "Member" } : { committee: c.committee, position: c.position || "Member" }).filter(c => c.committee);
  const since = tsDate(acct.createdAt);
  ctx.panel.innerHTML = `
    <div class="card hello"><div class="who"><div class="av">${esc(initials(acct.name))}</div>
      <div><b>${esc(acct.name)}</b><span class="badge b-gold">${esc(acct.role)}</span>${since ? `<span class="muted">Member since ${esc(since.toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</span>` : ""}</div></div>
      <div class="cm-box"><label for="cmSel">Your committees</label>
        ${cms.length ? `<select id="cmSel">${cms.map((c, i) => `<option value="${i}">${esc(c.committee)}</option>`).join("")}</select>` : `<select disabled><option>No committee assignments</option></select>`}
        <div class="cm-info" id="cmInfo"></div></div></div>
    <div class="stats" id="stats"></div>
    <div class="two"><div class="card"><h2>Quick actions</h2><div class="qa">
        <a class="btn btn-primary" href="${BASE}proposals/">Submit a proposal</a>
        ${admin ? `<a class="btn btn-outline" href="${BASE}review/">Review proposals</a>
          <a class="btn btn-outline" href="${BASE}bills/?new=1">New bill</a>
          <a class="btn btn-outline" href="${BASE}calendar/?new=1">Add calendar event</a>
          <a class="btn btn-outline" href="${BASE}journals/?new=1">New journal</a>` : ""}</div></div>
      <div class="card"><h2>Coming up</h2><div id="upcoming" class="skel" style="height:14px;width:60%"></div></div></div>`;

  const sel = document.getElementById("cmSel"), info = document.getElementById("cmInfo");
  const show = () => { const c = sel && cms[+sel.value]; info.innerHTML = c ? `<span class="badge ${posBadge(c.position)}">${esc(c.position)}</span>` : ""; };
  if (sel) { sel.addEventListener("change", show); show(); }

  const [events, bills, props] = await Promise.all([
    safe(() => load("calendarEvents")), admin ? safe(() => load("bills")) : null, admin ? safe(() => load("proposals")) : null
  ]);
  const today = todayISO();
  const upcoming = (events || []).filter(e => e.date >= today).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 5);
  document.getElementById("upcoming").outerHTML = upcoming.length
    ? `<ul class="plain up">${upcoming.map(e => `<li><span class="when">${esc(longDate(e.date))}${e.time ? " · " + esc(e.time) : ""}</span> ${esc(e.title)}</li>`).join("")}</ul>`
    : '<p class="lead" style="margin:0">Nothing scheduled.</p>';

  const stat = (n, label, href, hot) => `<a class="stat ${hot ? "hot" : ""}" href="${href}"><b>${n}</b><span>${esc(label)}</span></a>`;
  const out = [];
  if (props) { const n = props.filter(p => p.status === "Pending").length; out.push(stat(n, n === 1 ? "proposal awaiting review" : "proposals awaiting review", BASE + "review/", n > 0)); }
  if (bills) {
    out.push(stat(bills.filter(b => b.status === "In committee").length, "bills in committee", BASE + "bills/"));
    out.push(stat(bills.filter(b => b.status === "Floor vote").length, "bills awaiting a floor vote", BASE + "bills/"));
    out.push(stat(bills.filter(b => b.status === "Awaiting governor").length, "bills awaiting the Governor", BASE + "bills/"));
  }
  document.getElementById("stats").innerHTML = out.join("");
}

/* ================================================================
   My proposals
   ================================================================ */
/* Shared with the review page. */
function propCard(p, mineView) {
  const when = tsDate(p.createdAt);
  return `<div class="prop">
    <div class="prop-top"><span><span class="badge b-navy">${esc(p.type)}</span> <span class="badge ${badgeClass(p.status)}">${esc(p.status)}${p.number ? " · No. " + esc(p.number) : ""}</span></span>
      <span class="meta">${esc(p.sponsorName || "")}${when ? " · " + esc(when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) : ""}</span></div>
    <h3>${esc(p.title)}</h3>
    ${p.description ? `<p>${esc(p.description)}</p>` : ""}
    <div class="meta" style="margin:.4rem 0">${p.committee ? "Suggested committee: " + esc(p.committee) : ""}</div>
    ${p.reviewNote ? `<div class="msg warn" style="margin:.5rem 0">${esc(p.reviewNote)}</div>` : ""}
    ${docEmbed("Open draft", p.driveUrl)}
    ${mineView && p.status === "Pending" ? `<div style="margin-top:.7rem"><button class="btn btn-danger btn-sm" data-act="withdraw" data-id="${esc(p.id)}">Withdraw</button></div>` : ""}
  </div>`;
}

async function proposals(ctx) {
  async function draw() {
    ctx.panel.innerHTML = `<div class="card"><h2>Submit a proposal</h2>
      <p class="lead">Upload your draft to Google Drive, set sharing to “Anyone with the link can view”, then paste the link here.</p>
      <div class="grid2">
        <div class="field"><label for="p_type">Type</label><select id="p_type"><option>Bill</option><option>Resolution</option></select></div>
        <div class="field"><label for="p_com">Suggested committee</label><select id="p_com"><option value="">No preference</option>${COMMITTEES.map(c => `<option>${esc(c)}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="p_title">Title</label><input id="p_title" maxlength="200"></div>
      <div class="field"><label for="p_desc">Short description</label><textarea id="p_desc" rows="3" maxlength="1500"></textarea></div>
      <div class="field"><label for="p_url">Google Drive link</label><input id="p_url" type="url" placeholder="https://drive.google.com/…"></div>
      <button class="btn btn-primary" data-act="submitProposal">Submit proposal</button>
    </div>
    <div class="card"><h2>My proposals</h2><div id="mineList"><div class="skel" style="height:14px;width:50%"></div></div></div>`;
    try {
      const snap = await getDocs(query(collection(db, "proposals"), where("sponsorUid", "==", ctx.uid)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (tsDate(b.createdAt) || 0) - (tsDate(a.createdAt) || 0));
      document.getElementById("mineList").innerHTML = list.length ? list.map(p => propCard(p, true)).join("") : '<div class="empty-state" style="padding:1rem 0">You haven\'t submitted anything yet.</div>';
    } catch (e) { console.error(e); document.getElementById("mineList").innerHTML = '<div class="msg err">Couldn\'t load your proposals.</div>'; }
  }

  ctx.on({
    async submitProposal(btn) {
      const g = id => document.getElementById(id).value.trim();
      const title = g("p_title"), url = g("p_url");
      if (!title) return ctx.flash("Enter a title.", "err");
      if (!isDriveUrl(url)) return ctx.flash("Paste a Google Drive or Google Docs link (drive.google.com or docs.google.com).", "err");
      btn.disabled = true;
      try {
        await addDoc(collection(db, "proposals"), { type: g("p_type"), title, description: g("p_desc"), committee: g("p_com"), driveUrl: url, sponsorUid: ctx.uid, sponsorName: ctx.acct.name, status: "Pending", createdAt: serverTimestamp() });
        await draw(); ctx.flash("Proposal submitted. The Clerk's office will review it.");
      } catch (e) { console.error(e); btn.disabled = false; ctx.flash("Couldn't submit: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); }
    },
    async withdraw(btn) {
      if (!confirm("Withdraw this proposal?")) return;
      try { await deleteDoc(doc(db, "proposals", btn.dataset.id)); await draw(); ctx.flash("Proposal withdrawn."); }
      catch (e) { ctx.flash("Couldn't withdraw: " + e.message, "err"); }
    }
  });
  await draw();
}

/* ================================================================
   Review proposals
   ================================================================ */
async function review(ctx) {
  let byId = {};
  async function draw() {
    ctx.panel.innerHTML = '<div class="card"><h2>Review proposals</h2><div id="rev"><div class="skel" style="height:14px;width:50%"></div></div></div>';
    try {
      const [ps, bs, rs] = await Promise.all([getDocs(collection(db, "proposals")), getDocs(collection(db, "bills")), getDocs(collection(db, "resolutions"))]);
      const next = snap => snap.docs.reduce((m, d) => Math.max(m, Number(d.data().number) || 0), 0) + 1;
      const nextNo = { Bill: next(bs), Resolution: next(rs) };
      const list = ps.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (tsDate(b.createdAt) || 0) - (tsDate(a.createdAt) || 0));
      byId = Object.fromEntries(list.map(p => [p.id, p]));
      const pending = list.filter(p => p.status === "Pending"), done = list.filter(p => p.status !== "Pending");
      document.getElementById("rev").innerHTML =
        `<p class="lead">Introducing a proposal creates the official bill or resolution record with the next number. You can change the number or committee first.</p>` +
        (pending.length ? pending.map(p => `<div class="prop" data-id="${esc(p.id)}">
            ${propCard(p, false).replace(/^<div class="prop">|<\/div>$/g, "")}
            <div class="row">
              <div class="field"><label>Number</label><input type="number" class="r_num" value="${nextNo[p.type] || 1}" style="width:100px"></div>
              <div class="field"><label>Refer to committee</label><select class="r_com"><option value="">None yet</option>${COMMITTEES.map(c => `<option ${c === p.committee ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
              <button class="btn btn-primary btn-sm" data-act="introduce" data-id="${esc(p.id)}">Introduce</button>
              <div class="field"><label>Reason (if rejecting)</label><input class="r_note" placeholder="Optional" style="width:200px"></div>
              <button class="btn btn-danger btn-sm" data-act="reject" data-id="${esc(p.id)}">Reject</button>
            </div></div>`).join("") : '<div class="empty-state" style="padding:1rem 0">No pending proposals.</div>') +
        (done.length ? `<div class="section-head">Decided</div>${done.slice(0, 20).map(p => propCard(p, false)).join("")}` : "");
    } catch (e) { console.error(e); document.getElementById("rev").innerHTML = '<div class="msg err">Couldn\'t load proposals.</div>'; }
  }

  ctx.on({
    async introduce(btn) {
      const card = btn.closest(".prop"), p = byId[btn.dataset.id], coll = p.type === "Resolution" ? "resolutions" : "bills";
      const num = Number(card.querySelector(".r_num").value), com = card.querySelector(".r_com").value;
      if (!num || num < 1) return ctx.flash("Enter a valid number.", "err");
      btn.disabled = true;
      try {
        if ((await getDoc(doc(db, coll, String(num)))).exists()) { btn.disabled = false; return ctx.flash(`${p.type} No. ${num} already exists. Pick a different number.`, "err"); }
        const today = new Date().toISOString().slice(0, 10);
        const batch = writeBatch(db);
        batch.set(doc(db, coll, String(num)), {
          number: num, title: p.title, status: com ? "In committee" : "Introduced", committee: com, sponsors: p.sponsorName || "",
          introducedDate: today, description: p.description || "", driveUrl: p.driveUrl, substituteUrls: [], enrolledUrl: "",
          history: [`Introduced by ${p.sponsorName || "a legislator"}`, ...(com ? [`Referred to the ${com}`] : [])],
          proposalId: p.id, updatedAt: serverTimestamp(), updatedBy: ctx.acct.name
        });
        batch.update(doc(db, "proposals", p.id), { status: "Introduced", number: num, reviewedBy: ctx.acct.name, reviewedAt: serverTimestamp() });
        await batch.commit();
        await draw(); ctx.flash(`${p.type} No. ${num} introduced.`);
      } catch (e) { console.error(e); btn.disabled = false; ctx.flash("Couldn't introduce: " + e.message, "err"); }
    },
    async reject(btn) {
      const note = btn.closest(".prop").querySelector(".r_note").value.trim();
      if (!confirm("Reject this proposal?")) return;
      try { await updateDoc(doc(db, "proposals", btn.dataset.id), { status: "Rejected", reviewNote: note, reviewedBy: ctx.acct.name, reviewedAt: serverTimestamp() }); await draw(); ctx.flash("Proposal rejected."); }
      catch (e) { ctx.flash("Couldn't reject: " + e.message, "err"); }
    }
  });
  await draw();
}

/* ================================================================
   Record editors (public acts, orders, journals, calendar, admin code)
   ================================================================ */
const opt = (value, label) => ({ value: String(value), label });

const COLLECTIONS = {
  publicActs: {
    detail: {
      kind: "Public Act", num: r => `${r.year} PA ${r.number}`, public: r => `public-acts/#${r.number}`,
      facts: r => [["Signed", fmt(r.signedDate)], ["Effective", fmt(r.effectiveDate)],
        ["Source bill", r.billNumber ? `<a href="../bills/#${esc(r.billNumber)}">Bill No. ${esc(r.billNumber)}</a>` : ""]],
      prose: [["Summary", "description"], ["Act text", "text"]], docs: [["Open the enrolled act", "driveUrl"]],
      related: async r => {
        const secs = await load("mclSections"), list = asList(r.amends).map(c => { const x = secs.find(y => y.cite === c); return `<li><a href="../mcl/#${esc(c)}">MCL ${esc(c)}</a>${x ? " — " + esc(x.title) : ""}</li>`; });
        return list.length ? `<div class="sec"><h3 class="sub">Amends</h3><ul class="plain">${list.join("")}</ul></div>` : "";
      },
      actions: r => [
        ...(r.status === "In effect" ? [{ label: "Mark amended", set: { status: "Amended" } }] : []),
        ...(r.status !== "Repealed" ? [{ label: "Mark repealed", kind: "danger", confirm: "Mark this act as repealed?", set: { status: "Repealed" } }] : [{ label: "Restore to In effect", kind: "primary", set: { status: "In effect" } }]),
        ...(r.status === "Amended" ? [{ label: "Back to In effect", set: { status: "In effect" } }] : [])
      ]
    }, idField: "number", cols: ["number", "year", "title", "status"], sort: "number", filterBy: "status",
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

  macRules: {
    detail: {
      kind: "Administrative rule", num: r => r.cite, public: r => `mac/#${encodeURIComponent(r.cite)}`,
      title: r => r.title, facts: r => [["Agency", esc(r.agency)]],
      prose: [["Text", "text"], ["History", "history"]],
      actions: r => [{ label: "Record amendment today", set: { history: ((r.history || "") + ` Amended ${fmt(todayISO())}.`).trim() } }]
    }, idField: "cite", cols: ["cite", "agency", "title"], sort: "cite", filterBy: "agency",
    fields: [
      { key: "cite", label: "Rule number (e.g. R 408.10101)", req: true },
      { key: "agency", label: "Agency", type: "refs", single: true, from: "macRules", req: true, placeholder: "Pick or type an agency…", free: true, option: r => r.agency ? opt(r.agency, r.agency) : null },
      { key: "title", label: "Title", req: true, full: true },
      { key: "text", label: "Text", type: "textarea", rows: 10, full: true },
      { key: "history", label: "History", type: "textarea", full: true }
    ] },

  executiveOrders: {
    detail: {
      kind: "Executive Order", num: r => `No. ${r.number}`, public: r => `executive-orders/#${encodeURIComponent(r.number)}`,
      facts: r => [["Signed", fmt(r.signedDate)], ["Effective", fmt(r.effectiveDate)],
        ["Replaced by", r.rescindedBy ? `<a href="#${esc(r.rescindedBy)}" data-go="${esc(r.rescindedBy)}">Executive Order No. ${esc(r.rescindedBy)}</a>` : ""]],
      prose: [["Summary", "description"], ["Order text", "text"]], docs: [["Open the full order", "driveUrl"]],
      actions: r => r.status === "Active" ? [
        { label: "Rescind", kind: "danger", confirm: "Rescind this order?", set: v => ({ status: "Rescinded", rescindedBy: v || "" }), input: { type: "select", from: "executiveOrders", label: "by order (optional)", option: o => o.number !== r.number ? { value: o.number, label: `No. ${o.number} — ${o.title}` } : null } },
        { label: "Supersede", set: v => ({ status: "Superseded", rescindedBy: v }), input: { type: "select", from: "executiveOrders", label: "Superseded by…", required: true, option: o => o.number !== r.number ? { value: o.number, label: `No. ${o.number} — ${o.title}` } : null } }
      ] : [{ label: "Reinstate", kind: "primary", set: { status: "Active", rescindedBy: "" } }]
    }, idField: "number", cols: ["number", "title", "status"], sort: "number", filterBy: "status",
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

  execReorgOrders: {
    detail: {
      kind: "Reorganization Order", num: r => `No. ${r.number}`, public: r => `executive-reorganization-orders/#${encodeURIComponent(r.number)}`,
      facts: r => [["Agencies", esc(r.agencies)], ["Signed", fmt(r.signedDate)], ["Effective", fmt(r.effectiveDate)]],
      prose: [["Summary", "description"], ["Order text", "text"]], docs: [["Open the full order", "driveUrl"]],
      actions: r => ({
        "Submitted": [{ label: "Takes effect", kind: "primary", set: () => ({ status: "In effect", effectiveDate: todayISO() }) }, { label: "Disapprove", kind: "danger", confirm: "Mark as disapproved?", set: { status: "Disapproved" } }],
        "In effect": [{ label: "Rescind", kind: "danger", confirm: "Rescind this order?", set: { status: "Rescinded" } }],
      }[r.status] || [{ label: "Resubmit", kind: "primary", set: { status: "Submitted" } }])
    }, idField: "number", cols: ["number", "title", "status"], sort: "number", filterBy: "status",
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

  journals: {
    detail: {
      kind: "Journal", num: r => `No. ${r.number}`, public: r => `journals/#${encodeURIComponent(r.number)}`,
      title: r => r.title || `Journal of ${fmt(r.date)}`, badge: r => r.sessionType,
      facts: r => [["Session date", fmt(r.date)]],
      prose: [["Highlights", "summary"]], docs: [["Open the full journal", "driveUrl"]],
      actions: (r, rows) => {
        const nums = rows.map(x => Number(x.number)).sort((a, b) => a - b), prev = rows.find(x => Number(x.number) === Number(r.number) - 1), next = rows.find(x => Number(x.number) === Number(r.number) + 1);
        return [...(prev ? [{ label: `← Journal ${prev.number}`, go: prev._id }] : []), ...(next ? [{ label: `Journal ${next.number} →`, go: next._id }] : []),
          { label: "Start next journal", kind: "primary", seed: { number: Math.max(...nums) + 1, date: todayISO(), sessionType: r.sessionType } }];
      }
    }, idField: "number", cols: ["number", "date", "sessionType"], sort: "number", filterBy: "sessionType",
    fields: [
      { key: "number", label: "Journal number", type: "number", req: true, auto: "number" },
      { key: "date", label: "Session date", type: "date", req: true, default: "today" },
      { key: "sessionType", label: "Session type", type: "select", options: ["Regular", "Special", "Organizational"], default: "Regular" },
      { key: "title", label: "Title (optional)", full: true },
      { key: "summary", label: "Highlights", type: "textarea", full: true },
      { key: "driveUrl", label: "Full journal (Google Drive link)", type: "url", full: true }
    ] },

  calendarEvents: {
    detail: {
      kind: "Calendar event", num: r => r.type, title: r => r.title, badge: () => "",
      facts: r => [["Date", fmt(r.date)], ["Time", [r.time, r.endTime].filter(Boolean).join(" – ")], ["Committee", esc(r.committee)], ["Location", esc(r.location)]],
      prose: [["Description", "description"]], docs: [["Open the agenda", "agendaUrl"]],
      actions: r => [
        { label: "Reschedule", kind: "primary", set: v => ({ date: v }), input: { type: "date", value: r.date, required: true } },
        { label: "Duplicate to next week", run: async (r2) => ({ copy: { ...strip(r2), date: addDays(r2.date, 7) } }) },
        { label: "Mark cancelled", kind: "danger", confirm: "Mark this event as cancelled?", set: { title: r.title.startsWith("CANCELLED") ? r.title : "CANCELLED: " + r.title } }
      ]
    }, idField: null, cols: ["date", "time", "type", "title"], sort: "date", filterBy: "type",
    chips: [{ label: "Upcoming", test: r => r.date >= todayISO(), asc: true }, { label: "Past", test: r => r.date < todayISO() }, { label: "All", test: () => true }],
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


const strip = r => { const { _id, updatedAt, updatedBy, ...rest } = r; return rest; };

async function mountRecords(ctx) {
  const key = ctx.page.coll, cfg = COLLECTIONS[key], title = ctx.label, d = cfg.detail;
  let rows = [], cur = null, editing = null, form = null, acts = [], chip = 0;
  const hash = id => history.replaceState(null, "", location.pathname + location.search + (id ? "#" + encodeURIComponent(id) : ""));
  const idOf = r => r._id;

  /* ---------------------------------------------------------------- list */
  async function list() {
    cur = null; editing = null; hash("");
    rows = (await load(key, true)).slice();
    const filterOpts = cfg.filterBy ? [...new Set(rows.map(r => r[cfg.filterBy]).filter(Boolean))].sort(natCompare) : [];
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>${esc(title)}</h2><input id="recQ" placeholder="Search…">
      ${filterOpts.length ? `<select id="recF" class="bar-sel"><option value="">All</option>${filterOpts.map(o => `<option>${esc(o)}</option>`).join("")}</select>` : ""}
      <button class="btn btn-gold btn-sm" data-act="newRec">+ New</button></div>
      ${cfg.chips ? `<div class="chips" id="chips"></div>` : ""}<div id="recList"></div></div>`;
    document.getElementById("recQ").addEventListener("input", drawList);
    const f = document.getElementById("recF"); if (f) f.addEventListener("change", drawList);
    drawList();
  }
  function drawList() {
    const q = (document.getElementById("recQ").value || "").toLowerCase(), fv = (document.getElementById("recF") || {}).value;
    const c = cfg.chips && cfg.chips[chip];
    let shown = rows.filter(r => (!q || JSON.stringify(r).toLowerCase().includes(q)) && (!fv || r[cfg.filterBy] === fv));
    if (cfg.chips) {
      document.getElementById("chips").innerHTML = cfg.chips.map((x, i) => `<button class="chip ${i === chip ? "on" : ""}" data-act="chip" data-i="${i}">${esc(x.label)} <i>${shown.filter(x.test).length}</i></button>`).join("");
      shown = shown.filter(c.test);
    }
    shown.sort((a, b) => (c && c.asc ? 1 : -1) * natCompare(a[cfg.sort], b[cfg.sort]));
    const lab = k => cfg.fields.find(f => f.key === k).label.replace(/\s*\(.*\)/, "");
    document.getElementById("recList").innerHTML = shown.length
      ? `<table class="tbl click"><thead><tr>${cfg.cols.map(x => `<th>${esc(lab(x))}</th>`).join("")}</tr></thead><tbody>${shown.map(r =>
          `<tr data-act="viewRec" data-id="${esc(r._id)}">${cfg.cols.map(x => `<td>${esc(r[x] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : '<div class="empty-state" style="padding:1rem 0">Nothing here yet. Use “+ New” to add one.</div>';
  }

  /* ---------------------------------------------------------------- detail */
  async function view(id) {
    rows = (await load(key, true)).slice(); cur = rows.find(r => r._id === id); editing = null;
    if (!cur) return list();
    hash(id);
    const r = cur;
    acts = await prepActions(d.actions ? d.actions(r, rows) : []);
    const related = d.related ? await d.related(r) : "";
    const body = proseHtml(r, d.prose || []) + docsHtml(r, d.docs || []) + related;
    ctx.panel.innerHTML = `<div class="card hdr">${headerHtml({ back: title, publicHref: d.public && d.public(r), kind: `${d.kind}${d.num ? " · " + d.num(r) : ""}`, badge: d.badge ? d.badge(r) : r.status, title: d.title ? d.title(r) : r.title })}
        ${factsHtml(d.facts ? d.facts(r) : [])}${actionBarHtml(acts)}</div>
      ${body ? `<div class="card">${body}</div>` : ""}
      <div class="card foot"><span>${auditHtml(r)}</span><span class="grow"></span>
        <button class="btn btn-outline btn-sm" data-act="editRec">Edit</button><button class="btn btn-danger btn-sm" data-act="deleteRec">Delete</button></div>`;
  }

  /* ---------------------------------------------------------------- form */
  async function openForm(item, seed) {
    editing = { id: item ? item._id : null };
    const fields = cfg.fields.filter(f => !(f.newOnly && item));
    const env = await prepare(fields, rows);
    form = buildForm(fields, item, env, { lockKey: cfg.idField, seed });
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="cancelRec">&larr; Back</button><h2>${item ? "Edit" : "New"} — ${esc(d.kind || title)}</h2></div>
      <div id="recForm" class="grid2">${form.html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="saveRec">Save</button>
        <button class="btn btn-outline" data-act="cancelRec">Cancel</button></div></div>`;
    form.init(document.getElementById("recForm"));
  }

  async function saveRec(btn) {
    const { data, errs } = form.collect(document.getElementById("recForm"));
    if (errs.length) return ctx.flash(errs[0], "err");
    const who = ctx.acct.name, existing = editing.id;
    btn.disabled = true;
    try {
      const batch = writeBatch(db); let newId = existing;
      if (cfg.expand) {
        cfg.expand(data).forEach(x => { batch.set(existing ? doc(db, key, existing) : doc(collection(db, key)), { ...x, ...stamp(who) }); });
      } else {
        const id = existing || String(data[cfg.idField]).trim().replace(/\//g, "-"); newId = id;
        if (!existing && rows.some(r => r._id === id)) { btn.disabled = false; return ctx.flash(`A record with that ${cfg.idField} already exists. Edit it instead.`, "err"); }
        if (cfg.save) await cfg.save(batch, { ...data }, who); else batch.set(doc(db, key, id), { ...data, ...stamp(who) });
      }
      await batch.commit(); invalidate(key);
      if (cfg.expand && !existing) { await list(); ctx.flash(Number(data.repeat) > 0 ? `Created ${Number(data.repeat) + 1} events.` : "Event created."); }
      else { await view(newId); ctx.flash("Saved."); }
    } catch (e) { console.error(e); btn.disabled = false; ctx.flash("Couldn't save: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); }
  }

  ctx.on({
    chip(b) { chip = +b.dataset.i; drawList(); },
    viewRec: b => view(b.dataset.id),
    newRec: () => openForm(null),
    editRec: () => openForm(cur),
    saveRec,
    cancelRec: () => cur ? view(cur._id) : list(),
    back: () => list(),
    async runAct(btn) {
      const p = pickAction(ctx, acts, btn); if (!p) return;
      const { a, val } = p; btn.disabled = true;
      try {
        if (a.go) return view(a.go);
        if (a.seed) return openForm(null, a.seed);
        const batch = writeBatch(db), who = ctx.acct.name;
        if (a.run) { const out = await a.run(cur, val); if (out && out.copy) batch.set(doc(collection(db, key)), { ...out.copy, ...stamp(who) }); }
        if (a.set) batch.update(doc(db, key, cur._id), { ...(typeof a.set === "function" ? a.set(val, cur) : a.set), ...stamp(who) });
        await batch.commit(); invalidate(key);
        if (a.run) { await list(); ctx.flash("Done — copy created for next week."); } else { await view(cur._id); ctx.flash(`${a.label} — done.`); }
      } catch (e) { console.error(e); btn.disabled = false; ctx.flash("Couldn't do that: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); }
    },
    async deleteRec() {
      if (!confirm("Delete this record permanently?")) return;
      try { await deleteDoc(doc(db, key, cur._id)); invalidate(key); await list(); ctx.flash("Deleted."); }
      catch (e) { ctx.flash("Couldn't delete: " + e.message, "err"); }
    }
  });
  ctx.panel.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); const t = rows.find(r => r._id === g.dataset.go); if (t) view(t._id); } });

  const h = decodeURIComponent(location.hash.slice(1));
  await list();
  if (h && rows.some(r => r._id === h)) await view(h);
  else if (new URLSearchParams(location.search).has("new")) openForm(null);
}

/* ================================================================
   Bills and resolutions
   ================================================================ */
async function mountWorkflow(ctx, kind) {
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
  const hash = id => history.replaceState(null, "", location.pathname + location.search + (id ? "#" + encodeURIComponent(id) : ""));

  /* ---------------------------------------------------------------- list */
  async function list() {
    cur = null; pa = null; hash("");
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
    hash(id);
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
        <div class="pane" data-p="docs" ${tab === "docs" ? "" : "hidden"}>${previews(r)}<div id="docs" class="grid2">${form2.html}</div></div>
        <div class="form-actions" id="saveBar" ${tab === "timeline" ? "hidden" : ""}><button class="btn btn-primary" data-act="saveDetail">Save changes</button>
          <button class="btn btn-danger" data-act="deleteItem" style="margin-left:auto">Delete ${word.toLowerCase()}</button></div></div>`;
    form.init(document.getElementById("detail")); form2.init(document.getElementById("docs"));
  }

  const previews = r => {
    const subs = asList(r.substituteUrls);
    const h = docEmbed("Introduced text", r.driveUrl) + subs.map((u, i) => docEmbed(`Substitute${subs.length > 1 ? " " + (i + 1) : ""}`, u)).join("") + docEmbed(res ? "Adopted text" : "Enrolled text", r.enrolledUrl);
    return h ? `<div class="sec"><h3 class="sub">Current documents</h3>${h}</div><h3 class="sub">Edit links</h3>` : "";
  };

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
  const h0 = decodeURIComponent(location.hash.slice(1));
  await list();
  if (h0 && rows.some(r => r._id === h0)) await open(h0);
  else if (new URLSearchParams(location.search).has("new")) newItem();
}

/* ================================================================
   Michigan Compiled Laws
   ================================================================ */
const CH_FIELDS = [
  { key: "cite", label: "Chapter number (or article number)", req: true },
  { key: "title", label: "Title", req: true, full: true },
  { key: "kind", label: "Kind", type: "select", options: ["chapter", "constitution"], req: true, default: "chapter" },
  { key: "article", label: "Article numeral (e.g. IV)", showIf: { key: "kind", in: ["constitution"] } }
];

async function mountMcl(ctx) {
  const who = ctx.acct.name;
  let chapters = [], sections = [], chapter = "", form = null, editing = null, q = "", acts = [];
  const hash = id => history.replaceState(null, "", location.pathname + location.search + (id ? "#" + encodeURIComponent(id) : ""));

  const secNum = c => String(c).split(".").slice(1).join(".");
  const nextSec = ch => {
    const n = sections.filter(s => s.chapter === ch).map(s => parseInt(secNum(s.cite), 10)).filter(Number.isFinite);
    return n.length ? String(Math.max(...n) + 1) : "1";
  };
  const chOf = c => chapters.find(x => x.cite === c);
  const chLabel = c => { const x = chOf(c); return x ? `${x.kind === "constitution" ? "Article " + (x.article || x.cite) : "Chapter " + x.cite} — ${x.title}` : `Chapter ${c}`; };

  async function reload() {
    chapters = (await load("mclChapters", true)).slice().sort((a, b) => natCompare(a.cite, b.cite));
    sections = (await load("mclSections", true)).map(s => ({ ...s, chapter: String(s.chapter || String(s.cite).split(".")[0]) })).sort((a, b) => natCompare(a.cite, b.cite));
  }

  /* ---------------------------------------------------------------- browse */
  function browse() {
    editing = null; hash(chapter);
    const ch = chapter && chOf(chapter);
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>Michigan Compiled Laws</h2>
        <input id="q" placeholder="Search chapters and sections…" value="${esc(q)}">
        <button class="btn btn-outline btn-sm" data-act="newChapter">+ Chapter</button>
        <button class="btn btn-gold btn-sm" data-act="newSection">+ Section</button></div>
      <div class="crumbs"><a data-act="goAll">All chapters</a>${ch ? ` &rsaquo; <b>${esc(chLabel(chapter))}</b> <a data-act="editChapter" class="small">Edit chapter</a>` : ""}</div>
      <div id="list"></div></div>`;
    document.getElementById("q").addEventListener("input", e => { q = e.target.value; drawList(); });
    drawList();
  }
  function drawList() {
    const el = document.getElementById("list"), ql = q.trim().toLowerCase();
    if (ql) {
      const cm = chapters.filter(c => (c.cite + " " + c.title).toLowerCase().includes(ql));
      const sm = sections.filter(s => (s.cite + " " + s.title + " " + (s.text || "")).toLowerCase().includes(ql)).slice(0, 100);
      el.innerHTML = (cm.length ? `<div class="section-head">Chapters</div>${chTable(cm)}` : "") + (sm.length ? `<div class="section-head">Sections</div>${secTable(sm)}` : "") || '<div class="empty-state" style="padding:1rem 0">Nothing matched.</div>';
    } else if (chapter) {
      const sm = sections.filter(s => s.chapter === chapter);
      el.innerHTML = sm.length ? secTable(sm) : '<div class="empty-state" style="padding:1rem 0">No sections in this chapter yet. Use “+ Section”.</div>';
    } else {
      el.innerHTML = chapters.length ? chTable(chapters) : '<div class="empty-state" style="padding:1rem 0">No chapters yet. Use “+ Chapter”.</div>';
    }
  }
  const chTable = list => `<table class="tbl click"><thead><tr><th>Chapter</th><th>Title</th><th>Sections</th></tr></thead><tbody>${list.map(c =>
    `<tr data-act="openChapter" data-c="${esc(c.cite)}"><td>${esc(c.kind === "constitution" ? "Art. " + (c.article || c.cite) : c.cite)}</td><td>${esc(c.title)}</td><td>${sections.filter(s => s.chapter === c.cite).length}</td></tr>`).join("")}</tbody></table>`;
  const secTable = list => `<table class="tbl click"><thead><tr><th>Section</th><th>Title</th></tr></thead><tbody>${list.map(s =>
    `<tr data-act="editSection" data-id="${esc(s._id)}"><td class="mono">${esc(s.cite)}</td><td>${esc(s.title)}</td></tr>`).join("")}</tbody></table>`;

  /* ---------------------------------------------------------------- chapter form */
  async function chapterForm(item) {
    editing = { type: "chapter", id: item ? item._id : null };
    form = buildForm(CH_FIELDS, item, await prepare(CH_FIELDS), { lockKey: "cite" });
    const n = item ? sections.filter(s => s.chapter === item.cite).length : 0;
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; Back</button><h2>${item ? "Edit" : "New"} chapter</h2></div>
      <div id="f" class="grid2">${form.html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="saveChapter">Save</button>
        ${item ? `<button class="btn btn-danger" data-act="deleteChapter" style="margin-left:auto" ${n ? "disabled title='Remove its sections first'" : ""}>Delete chapter</button>` : ""}</div></div>`;
    form.init(document.getElementById("f"));
  }

  /* ---------------------------------------------------------------- section form */
  async function sectionForm(item) {
    editing = { type: "section", id: item ? item._id : null, item };
    const fields = [
      ...(item ? [] : [
        { key: "chapter", label: "Chapter", type: "refs", single: true, from: "mclChapters", req: true, option: c => ({ value: c.cite, label: chLabel(c.cite) }), full: true, placeholder: "Pick a chapter…" },
        { key: "num", label: "Section number", req: true, default: () => nextSec(chapter), hint: "Filled in with the next free number in the chapter." }
      ]),
      { key: "title", label: "Title", req: true, full: !!item },
      { key: "text", label: "Text (indent subsections with (a), (i), 1) …)", type: "textarea", rows: 14, full: true },
      { key: "history", label: "History", type: "textarea", rows: 2, full: true, hint: "Added to automatically when you record an amendment below." }
    ];
    form = buildForm(fields, item || null, await prepare(fields), { seed: { chapter } });
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="${item ? "cancelEdit" : "back"}">&larr; Back</button><h2>${item ? "Edit MCL " + esc(item.cite) : "New section"}</h2></div>
      <div id="f" class="grid2">${form.html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="saveSection">Save</button><button class="btn btn-outline" data-act="${item ? "cancelEdit" : "back"}">Cancel</button></div></div>`;
    form.init(document.getElementById("f"));
  }

  /* ---------------------------------------------------------------- section view */
  async function sectionView(item) {
    editing = { type: "section", id: item._id, item }; chapter = item.chapter; hash(item.cite);
    const allActs = await load("publicActs", true);
    const by = allActs.filter(a => asList(a.amends).includes(item.cite)).sort((a, b) => b.number - a.number);
    acts = await prepActions([
      { label: "Edit", kind: "primary", edit: true },
      { label: "Record amendment", amend: true, input: { type: "select", from: "publicActs", label: "by public act…", required: true, option: a => asList(a.amends).includes(item.cite) ? null : { value: a._id, label: `${a.year} PA ${a.number} — ${a.title}` } } },
      { label: "Delete", kind: "danger", del: true, confirm: `Delete MCL ${item.cite} permanently?` }
    ]);
    ctx.panel.innerHTML = `<div class="card hdr">${headerHtml({ back: chLabel(item.chapter), publicHref: `mcl/#${item.cite}`, kind: `MCL ${item.cite}`, title: item.title, sub: esc(chLabel(item.chapter)) })}${actionBarHtml(acts)}</div>
      <div class="card"><div class="sec"><h3 class="sub">Text</h3><div class="prose-box pre law">${item.text ? esc(item.text) : "<i>No text yet.</i>"}</div></div>
        ${item.history ? `<div class="sec"><h3 class="sub">History</h3><div class="prose-box">${esc(item.history)}</div></div>` : ""}
        <div class="sec"><h3 class="sub">Amended by</h3>${by.length ? `<ul class="plain">${by.map(a => `<li><a href="../public-acts/#${esc(a.number)}">${esc(a.year)} PA ${esc(a.number)}</a> — ${esc(a.title)}</li>`).join("")}</ul>` : '<p class="lead" style="margin:0">No public acts amend this section yet.</p>'}</div></div>
      <div class="card foot">${auditHtml(item)}</div>`;
  }

  const guard = fn => async b => { if (b) b.disabled = true; try { await fn(b); } catch (e) { console.error(e); if (b) b.disabled = false; ctx.flash("Couldn't save: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); } };

  ctx.on({
    goAll() { chapter = ""; q = ""; browse(); },
    back() { browse(); },
    openChapter(b) { chapter = b.dataset.c; q = ""; browse(); },
    newChapter: () => chapterForm(null),
    editChapter: () => chapterForm(chOf(chapter)),
    newSection: () => sectionForm(null),
    editSection(b) { return sectionView(sections.find(s => s._id === b.dataset.id)); },
    cancelEdit() { return sectionView(editing.item); },

    saveChapter: guard(async b => {
      const { data, errs } = form.collect(document.getElementById("f"));
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      const id = editing.id || String(data.cite).trim().replace(/\//g, "-");
      if (!editing.id && chOf(data.cite)) { b.disabled = false; return ctx.flash("That chapter already exists.", "err"); }
      const batch = writeBatch(db); batch.set(doc(db, "mclChapters", id), { ...data, ...stamp(who) }); await batch.commit();
      invalidate("mclChapters"); await reload(); chapter = data.cite; browse(); ctx.flash("Chapter saved.");
    }),
    deleteChapter: guard(async () => {
      if (!confirm("Delete this chapter?")) return;
      await deleteDoc(doc(db, "mclChapters", editing.id)); invalidate("mclChapters"); await reload(); chapter = ""; browse(); ctx.flash("Chapter deleted.");
    }),
    saveSection: guard(async b => {
      const { data, errs } = form.collect(document.getElementById("f"));
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      const cite = editing.item ? editing.item.cite : `${data.chapter}.${String(data.num).trim()}`;
      if (!editing.item && sections.some(s => s.cite === cite)) { b.disabled = false; return ctx.flash(`MCL ${cite} already exists.`, "err"); }
      const rec = { cite, chapter: editing.item ? editing.item.chapter : String(data.chapter), title: data.title, text: data.text, history: data.history };
      const batch = writeBatch(db); batch.set(doc(db, "mclSections", cite.replace(/\//g, "-")), { ...rec, ...stamp(who) }); await batch.commit();
      invalidate("mclSections"); await reload(); await sectionView(sections.find(x => x.cite === cite)); ctx.flash(`MCL ${cite} saved.`);
    }),
    runAct: guard(async btn => {
      const p = pickAction(ctx, acts, btn); if (!p) { btn.disabled = false; return; }
      const { a, val } = p, s = editing.item;
      if (a.edit) return sectionForm(s);
      if (a.del) { await deleteDoc(doc(db, "mclSections", s._id)); invalidate("mclSections"); await reload(); browse(); return ctx.flash("Section deleted."); }
      if (a.amend) {
        const act = (await load("publicActs")).find(x => x._id === val), cite = `${act.year} PA ${act.number}`;
        const batch = writeBatch(db);
        batch.update(doc(db, "mclSections", s._id), { history: appendHistory(s.history, `${cite}${act.effectiveDate ? ", Eff. " + longDate(act.effectiveDate) : ""}.`), ...stamp(who) });
        batch.update(doc(db, "publicActs", act._id), { amends: [...asList(act.amends), s.cite], ...stamp(who) });
        await batch.commit(); invalidate("mclSections", "publicActs"); await reload();
        await sectionView(sections.find(x => x._id === s._id)); ctx.flash(`Recorded ${cite}.`);
      }
    })
  });

  await reload();
  const h = decodeURIComponent(location.hash.slice(1)), hs = sections.find(x => x.cite === h);
  if (hs) await sectionView(hs); else { if (h && chOf(h)) chapter = h; browse(); }
}

/* ================================================================
   Page registry: page key -> renderer
   ================================================================ */
const RENDER = {
  overview, proposals, review,
  bills: ctx => mountWorkflow(ctx, "bill"), resolutions: ctx => mountWorkflow(ctx, "resolution"), mcl: mountMcl,
  publicActs: mountRecords, macRules: mountRecords, executiveOrders: mountRecords, execReorgOrders: mountRecords, journals: mountRecords, calendar: mountRecords
};
export const start = page => startDash({ page, render: RENDER[page] });