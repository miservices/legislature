/* Generic search / filter / list / detail browser for a Firestore collection (hash-routed). */
import { db, collection, getDocs } from "./fb.js";
import { esc, normSearch, natCompare, asList, fmtDate, docEmbed, badgeClass, lines } from "./util.js";

const skeleton = () => Array.from({ length: 7 }, () =>
  '<div class="skel-item"><div class="skel" style="height:11px;width:30%;margin-bottom:8px"></div><div class="skel" style="height:13px;width:75%;margin-bottom:6px"></div><div class="skel" style="height:11px;width:45%"></div></div>').join("");
const emptyState = msg => `<div class="empty-state">${msg}</div>`;

export async function startBrowser(cfg) {
  const content = document.getElementById("content");
  const bar = document.getElementById("filters");
  content.innerHTML = skeleton();

  let rows = [];
  try {
    const snap = await getDocs(collection(db, cfg.collection));
    rows = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  } catch (e) {
    console.error(e);
    content.innerHTML = emptyState("These records couldn't be loaded right now. Please try again shortly.");
    return;
  }

  const idOf = cfg.idOf || (r => r._id);
  const byId = {};
  rows.forEach(r => { byId[String(idOf(r))] = r; });
  const sort = cfg.sort || ((a, b) => natCompare(idOf(b), idOf(a)));

  const defs = (cfg.filters || []).map((f, i) => ({
    ...f, id: "flt" + i,
    options: f.options || [...new Set(rows.map(f.get).filter(Boolean))].sort(natCompare)
  }));
  bar.innerHTML =
    `<input id="q" type="search" placeholder="${esc(cfg.placeholder || "Search…")}" autocomplete="off"/>` +
    defs.map(f => `<select id="${f.id}" aria-label="${esc(f.label)}"><option value="">${esc(f.label)}</option>${f.options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select>`).join("") +
    '<span class="filter-count" id="count"></span>';

  function filtered() {
    const terms = bar.querySelector("#q").value.trim().toLowerCase().split(/\s+/).map(normSearch).filter(Boolean);
    return rows.filter(r => {
      for (const f of defs) {
        const v = bar.querySelector("#" + f.id).value;
        if (v && String(f.get(r) || "").toLowerCase() !== v.toLowerCase()) return false;
      }
      if (!terms.length) return true;
      const hay = normSearch(cfg.searchText(r));
      return terms.every(t => hay.includes(t));
    }).sort(sort);
  }

  function showList() {
    const data = filtered();
    bar.querySelector("#count").textContent = `${data.length} result${data.length === 1 ? "" : "s"}`;
    if (!rows.length) { content.innerHTML = emptyState(cfg.emptyText || "Nothing has been published here yet."); return; }
    if (!data.length) { content.innerHTML = emptyState("Nothing matched your search."); return; }
    content.innerHTML = `<div class="list-count">${data.length} ${esc(cfg.noun)}${data.length === 1 ? "" : "s"}</div><div class="item-list">` +
      data.map(r => {
        const v = cfg.row(r);
        return `<a class="item" href="#${encodeURIComponent(idOf(r))}">
          <div class="item-top"><span class="item-num">${esc(v.num)}</span>${v.badge ? `<span class="badge ${badgeClass(v.badge)}">${esc(v.badge)}</span>` : ""}</div>
          <div class="item-name">${esc(v.name)}</div>${v.meta ? `<div class="item-meta">${esc(v.meta)}</div>` : ""}
        </a>`;
      }).join("") + "</div>";
  }

  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ""));
    const r = byId[h];
    if (r) {
      content.innerHTML = `<a class="back-link" href="#">&larr; Back to ${esc(cfg.back)}</a>` + cfg.detail(r, { byId, rows });
    } else {
      showList();
    }
    window.scrollTo(0, 0);
  }

  bar.addEventListener("input", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    showList();
  });
  window.addEventListener("hashchange", route);
  route();
}

/* Declarative config for simple "record" pages (public acts, orders, journals, MAC rules). */
export function docConfig(s) {
  const bf = s.badge === false ? null : (s.badge || "status");
  return {
    collection: s.collection, back: s.back, noun: s.noun, placeholder: s.placeholder,
    idOf: s.idOf, sort: s.sort, filters: s.filters,
    searchText: r => [s.num(r), s.name(r), r.status, r.description, r.text, ...(s.searchKeys || []).map(k => r[k])].join(" "),
    row: r => ({ num: s.num(r), badge: bf ? r[bf] : "", name: s.name(r), meta: s.meta ? s.meta(r) : "" }),
    detail: (r, ctx) => {
      const kv = (s.fields || []).map(f => {
        const v = r[f.key];
        if (v === undefined || v === null || v === "") return "";
        return `<div><dt>${esc(f.label)}</dt><dd>${f.type === "date" ? esc(fmtDate(v)) : esc(v)}</dd></div>`;
      }).join("");
      const hist = asList(r.history);
      return `
        <div class="detail-num">${esc(s.num(r))}</div>
        <h2 class="detail-title">${esc(s.name(r))}</h2>
        ${bf && r[bf] ? `<span class="badge ${badgeClass(r[bf])}">${esc(r[bf])}</span>` : ""}
        ${kv ? `<dl class="kv">${kv}</dl>` : ""}
        ${s.extra ? s.extra(r, ctx) : ""}
        ${r.description ? `<div class="section-head">Summary</div><div class="prose-box">${esc(r.description)}</div>` : ""}
        ${r.text ? `<div class="section-head">Text</div><div class="law-text">${lines(r.text)}</div>` : ""}
        ${r.driveUrl ? `<div class="section-head">Document</div><div class="docs-list">${docEmbed(s.docLabel || "Open the full document", r.driveUrl)}</div>` : ""}
        ${hist.length ? `<div class="section-head">History</div><div class="timeline">${hist.map((h, i) => `<div class="tl-item ${i === hist.length - 1 ? "latest" : ""}">${esc(h)}</div>`).join("")}</div>` : ""}`;
    }
  };
}