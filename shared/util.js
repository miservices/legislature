export const COMMITTEES = [
  "Committee on Judiciary",
  "Committee on Government Operations",
  "Committee on Oversight and Ethics",
  "Committee on Public Safety and State Security",
  "Special Committee on Appropriations",
  "Special Committee on Administrative Rules"
];

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const normSearch = t => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const natCompare = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
export const asList = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean)
  : String(v || "").split(/\r?\n|\|/).map(s => s.trim()).filter(Boolean);

export function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  return isNaN(d) ? null : d;
}
export function fmtDate(iso) {
  const d = parseDate(iso);
  return d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : (iso || "");
}
export function fmtTime(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  if (isNaN(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export const tsDate = ts => (ts && ts.toDate) ? ts.toDate() : null;

export function safeUrl(u) {
  try { const x = new URL(String(u || "").trim()); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; }
}
export const isDriveUrl = u => /^https:\/\/(drive|docs)\.google\.com\//.test(safeUrl(u));

/* Turn a Google Drive/Docs share link into an embeddable preview link (or "" if not recognised). */
export function previewUrl(u) {
  const url = safeUrl(u);
  const m = url.match(/^https:\/\/(drive|docs)\.google\.com\/(?:file|document|presentation|spreadsheets)\/d\/([^/?#]+)/);
  if (!m) return "";
  if (m[1] === "drive") return `https://drive.google.com/file/d/${m[2]}/preview`;
  const kind = url.match(/\/(document|presentation|spreadsheets)\//)[1];
  return `https://docs.google.com/${kind}/d/${m[2]}/preview`;
}

export function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (["enacted", "in effect", "active", "adopted", "effective", "approved", "introduced"].includes(s) && s !== "introduced") return "b-green";
  if (["awaiting governor", "tabled", "amended", "pending"].includes(s)) return "b-amber";
  if (["defeated", "vetoed", "disapproved", "rejected"].includes(s)) return "b-red";
  if (["repealed", "rescinded", "superseded"].includes(s)) return "b-gray";
  return "b-navy";
}

const DOC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
export function docLink(label, url) {
  const u = safeUrl(url);
  return u ? `<a class="doc-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${DOC_ICON}${esc(label)}</a>` : "";
}
export function docEmbed(label, url) {
  const link = docLink(label, url);
  if (!link) return "";
  const pv = previewUrl(url);
  return `<div class="doc-block">${link}${pv ? `<details class="embed"><summary>Read it here</summary><iframe src="${esc(pv)}" loading="lazy" title="${esc(label)}"></iframe></details>` : ""}</div>`;
}
export const lines = text => String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  .map(l => `<div class="line">${esc(l)}</div>`).join("");