/* Dashboard › My proposals */
import { db, collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "./fb.js";
import { esc, isDriveUrl, badgeClass, tsDate, COMMITTEES, docLink } from "./util.js";

/* Shared with the review page. */
export function propCard(p, mineView) {
  const when = tsDate(p.createdAt);
  return `<div class="prop">
    <div class="prop-top"><span><span class="badge b-navy">${esc(p.type)}</span> <span class="badge ${badgeClass(p.status)}">${esc(p.status)}${p.number ? " · No. " + esc(p.number) : ""}</span></span>
      <span class="meta">${esc(p.sponsorName || "")}${when ? " · " + esc(when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) : ""}</span></div>
    <h3>${esc(p.title)}</h3>
    ${p.description ? `<p>${esc(p.description)}</p>` : ""}
    <div class="meta" style="margin:.4rem 0">${p.committee ? "Suggested committee: " + esc(p.committee) : ""}</div>
    ${p.reviewNote ? `<div class="msg warn" style="margin:.5rem 0">${esc(p.reviewNote)}</div>` : ""}
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">${docLink("Open draft", p.driveUrl)}
      ${mineView && p.status === "Pending" ? `<button class="btn btn-danger btn-sm" data-act="withdraw" data-id="${esc(p.id)}">Withdraw</button>` : ""}</div>
  </div>`;
}

export async function proposals(ctx) {
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