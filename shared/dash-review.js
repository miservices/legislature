/* Dashboard › Review proposals (admins) */
import { db, collection, doc, getDoc, getDocs, updateDoc, writeBatch, serverTimestamp } from "./fb.js";
import { esc, tsDate, COMMITTEES } from "./util.js";
import { propCard } from "./dash-proposals.js";

export async function review(ctx) {
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