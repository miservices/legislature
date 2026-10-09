/* Dashboard › Overview: who you are, what needs attention, what's coming up. */
import { esc, tsDate, badgeClass } from "./util.js";
import { load } from "./dash-data.js";
import { longDate, todayISO } from "./dash-ui.js";
import { BASE } from "./dash-shell.js";

const posBadge = p => p === "Chair" ? "b-gold" : p === "Vice Chair" ? "b-navy" : "b-gray";
const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const safe = async fn => { try { return await fn(); } catch { return null; } };

export async function overview(ctx) {
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