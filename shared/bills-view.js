/* Config for the Bills and Resolutions pages (they share one layout). */
import { esc, asList, fmtDate, docEmbed, badgeClass } from "./util.js";

export const BILL_STATUSES = ["Introduced", "In committee", "Floor vote", "Awaiting governor", "Enacted", "Tabled", "Defeated", "Vetoed", "Repealed"];
export const RES_STATUSES = ["Introduced", "In committee", "Floor vote", "Adopted", "Tabled", "Defeated"];

const lc = s => String(s || "").toLowerCase();

export function billsConfig(kind) {
  const res = kind === "resolution";
  const word = res ? "Resolution" : "Bill";
  const steps = res ? ["Introduced", "In committee", "Floor vote", "Adopted"]
                    : ["Introduced", "In committee", "Floor vote", "Awaiting governor", "Enacted"];

  const num = r => {
    let l = `${word} No. ${r.number}`;
    if (!res && ["enacted", "repealed"].includes(lc(r.status)) && r.paNumber) l += ` (Public Act ${r.paNumber})`;
    return l;
  };

  function tracker(r) {
    const st = lc(r.status);
    const end = (cls, mark, label, color) => `<div class="t-step"><div class="t-dot ${cls}">${mark}</div><div class="t-label" style="color:${color};font-weight:600">${label}</div></div>`;
    const first = '<div class="t-step"><div class="t-dot done">1</div><div class="t-label done">Introduced</div></div>';
    if (st === "defeated") return `<div class="tracker"><div class="tracker-steps">${first}${end("fail", "&times;", "Defeated", "#791f1f")}</div></div>`;
    if (st === "vetoed")   return `<div class="tracker"><div class="tracker-steps">${first}${end("fail", "&times;", "Vetoed", "#791f1f")}</div></div>`;
    if (st === "tabled")   return `<div class="tracker"><div class="tracker-steps">${first}${end("warn", "!", "Tabled", "#633806")}</div></div>`;
    if (st === "repealed") return `<div class="tracker"><div class="tracker-steps"><div class="t-step"><div class="t-dot done">1</div><div class="t-label done">Enacted</div></div>${end("fail", "&times;", "Repealed", "#791f1f")}</div></div>`;
    const cur = steps.findIndex(s => lc(s) === st);
    const last = steps.length - 1;
    const pct = cur <= 0 ? 0 : Math.round(cur / last * 100);
    // a finished bill/resolution shows every step as complete
    const finished = cur === last;
    return `<div class="tracker"><div class="tracker-line"></div><div class="tracker-fill" style="width:calc(${pct}% - 32px)"></div><div class="tracker-steps">` +
      steps.map((s, i) => {
        const dc = (i < cur || (finished && i === cur)) ? "done" : i === cur ? "current" : "";
        return `<div class="t-step"><div class="t-dot ${dc}">${dc === "done" ? "&#10003;" : i + 1}</div><div class="t-label ${dc}">${s}</div></div>`;
      }).join("") + "</div></div>";
  }

  function amendments(r, ctx) {
    const items = asList(r.amendatoryBills).map(e => {
      const m = e.match(/^(\d+)\s*([A-Za-z])$/);
      if (!m) return "";
      const n = m[1], sfx = m[2].toUpperCase();
      const other = ctx.byId[n];
      if (sfx === "B") return `<div class="amend-item"><span class="badge b-amber">Pending</span><span>Bill No. ${esc(n)} has been introduced to amend this act. <a href="#${n}">View bill &rarr;</a></span></div>`;
      if (sfx === "A") {
        const pa = other && other.paNumber;
        const link = pa ? `<a href="../public-acts/#${esc(pa)}">View amending act &rarr;</a>` : `<a href="#${n}">View bill &rarr;</a>`;
        return `<div class="amend-item"><span class="badge b-green">Enacted</span><span>This act has been amended by Bill No. ${esc(n)}${pa ? ` (Public Act ${esc(pa)})` : ""}. ${link}</span></div>`;
      }
      if (sfx === "R") return `<div class="amend-item"><span class="badge b-red">Repealed</span><span>This act has been repealed by Bill No. ${esc(n)}. <a href="#${n}">View bill &rarr;</a></span></div>`;
      return "";
    }).join("");
    return items ? `<div class="amend-list">${items}</div>` : "";
  }

  function docs(r, hasAmend) {
    let h = docEmbed(res ? "Introduced text" : "Introduced text", r.driveUrl);
    const subs = asList(r.substituteUrls);
    subs.forEach((u, i) => { h += docEmbed(`Substitute${subs.length > 1 ? ` (${i + 1})` : ""}`, u); });
    if (r.enrolledUrl) {
      h += docEmbed(res ? "Adopted text" : "Enrolled text", r.enrolledUrl);
      if (hasAmend) h += '<div class="outdated-warning">This enrolled text reflects the act as originally passed. It may be outdated due to the amendments listed below.</div>';
    }
    return h || '<span class="docs-empty">No documents available.</span>';
  }

  return {
    collection: res ? "resolutions" : "bills",
    back: res ? "Resolutions" : "Bills",
    noun: res ? "resolution" : "bill",
    placeholder: res ? "Search by resolution number, title, or sponsor…" : "Search by bill number, public act, title, or sponsor…",
    idOf: r => String(r.number ?? r._id),
    sort: (a, b) => Number(b.number) - Number(a.number),
    filters: [
      { label: "All statuses", get: r => r.status, options: res ? RES_STATUSES : BILL_STATUSES },
      { label: "All committees", get: r => r.committee }
    ],
    searchText: r => [r.number, r.paNumber, r.title, r.status, r.committee, r.sponsors, r.description].join(" "),
    row: r => ({ num: num(r), badge: r.status, name: String(r.title || "").toUpperCase(), meta: [r.committee, r.sponsors].filter(Boolean).join(" · ") }),
    detail: (r, ctx) => {
      const am = res ? "" : amendments(r, ctx);
      const hist = asList(r.history);
      return `
        <div class="detail-num">${esc(num(r))}</div>
        <h2 class="detail-title">${esc(r.title)}</h2>
        <div class="detail-sub">
          ${r.sponsors ? `<strong>Sponsors:</strong> ${esc(r.sponsors)}` : ""}
          ${r.introducedDate ? `${r.sponsors ? " · " : ""}Introduced ${esc(fmtDate(r.introducedDate))}` : ""}
          ${!res && r.paNumber ? ` · <a href="../public-acts/#${esc(r.paNumber)}">Public Act ${esc(r.paNumber)}</a>` : ""}
        </div>
        <div class="section-head" style="margin-top:.6rem">Status</div>
        ${tracker(r)}
        ${r.committee ? `<div class="committee-line">Committee: <strong>${esc(r.committee)}</strong></div>` : ""}
        ${r.description ? `<div class="section-head">Description</div><div class="prose-box">${esc(r.description)}</div>` : ""}
        <div class="section-head">Documents</div>
        <div class="docs-list">${docs(r, !!am)}</div>
        ${am ? `<div class="section-head">Amendments to this act</div>${am}` : ""}
        <div class="section-head">Legislative timeline</div>
        <div class="timeline">${hist.length ? hist.map((h, i) => `<div class="tl-item ${i === hist.length - 1 ? "latest" : ""}">${esc(h)}</div>`).join("") : '<div class="tl-item" style="color:#9ca3af">No history available.</div>'}</div>`;
    }
  };
}