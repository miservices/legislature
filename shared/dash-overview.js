/* Dashboard › Overview */
import { esc, tsDate } from "./util.js";

const posBadge = p => p === "Chair" ? "b-gold" : p === "Vice Chair" ? "b-navy" : "b-gray";
const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

export function overview(ctx) {
  const acct = ctx.acct;
  const cms = (acct.committees || []).map(c => typeof c === "string" ? { committee: c, position: "Member" } : { committee: c.committee, position: c.position || "Member" }).filter(c => c.committee);
  const since = tsDate(acct.createdAt);
  ctx.panel.innerHTML = `<div class="card">
    <div class="who"><div class="av">${esc(initials(acct.name))}</div>
      <div><b>${esc(acct.name)}</b><span class="badge b-gold">${esc(acct.role)}</span>${since ? `<span style="font-size:12px;color:#9ca3af;margin-left:.6rem">Account created ${esc(since.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</span>` : ""}</div></div>
    <div class="field" style="max-width:420px"><label for="cmSel">Your committees</label>
      ${cms.length ? `<select id="cmSel">${cms.map((c, i) => `<option value="${i}">${esc(c.committee)}</option>`).join("")}</select>` : `<select disabled><option>No committee assignments</option></select>`}
    </div>
    <div class="cm-info" id="cmInfo"></div>
  </div>
  <div class="card"><h2>What you can do</h2>
    <p class="lead" style="margin:0">${ctx.isAdmin
      ? "Submit your own proposals, review proposals from legislators and introduce them as bills or resolutions, and edit the official record (statutes, acts, orders, journals, and the calendar)."
      : "Submit proposed bills and resolutions by sharing a Google Drive link. The Clerk's office reviews each proposal and introduces it."}</p>
  </div>`;

  const sel = document.getElementById("cmSel"), info = document.getElementById("cmInfo");
  const show = () => {
    const c = sel && cms[+sel.value];
    info.innerHTML = c ? `Position: <span class="badge ${posBadge(c.position)}">${esc(c.position)}</span> &nbsp;You are ${c.position === "Member" ? "a member" : "the " + esc(c.position)} of the ${esc(c.committee)}.` : "";
  };
  if (sel) { sel.addEventListener("change", show); show(); }
}