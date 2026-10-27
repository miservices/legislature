/* Bill drafter: fill in the form, get a PDF laid out like an official bill (Courier, 49 numbered lines a page,
   BILL NO. / PAGE / PRINTED footer). Used by the "Bill drafter" dashboard page. */
import { esc, COMMITTEES } from "./util.js";
import { todayISO, load, prepare, buildForm } from "./dash-core.js";

/* ---------------------------------------------------------------- text helpers */
const clean = s => String(s ?? "")
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
  .replace(/…/g, "...").replace(/ /g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "").replace(/[ \t]+/g, " ").trim();

const ordinal = n => { const v = n % 100; return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const parts = iso => { const [y, m, d] = String(iso || todayISO()).split("-").map(Number); return { y, m, d }; };
export const introDate = iso => { const { y, m, d } = parts(iso); return `${MONTHS[m - 1]} ${ordinal(d)} of ${y}`; };
const printed = iso => { const { y, m, d } = parts(iso); return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${y}`; };
const joinNames = a => a.length < 2 ? a.join("") : a.length === 2 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const withPeriod = s => /[.;:]$/.test(s) ? s : s + ".";

/* ---------------------------------------------------------------- PDF layout (points, US Letter) */
const L = { left: 79, right: 558, num: 48, size: 12, cw: 7.2, pitch: 13.8, top: 66, bottom: 728, p1Bottom: 718, perPage: 49, indent: 4 };
const COLS = Math.floor((L.right - L.left) / L.cw);

/* Greedy monospace wrap. `words` = [{t, b}] ; returns lines of words. */
function wrap(words, firstIndent) {
  const lines = []; let cur = [], len = 0, room = COLS - firstIndent;
  for (const w of words) {
    const add = (cur.length ? 1 : 0) + w.t.length;
    if (cur.length && len + add > room) { lines.push(cur); cur = []; len = 0; room = COLS; }
    len += (cur.length ? 1 : 0) + w.t.length; cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}
const toWords = (label, text) => [...(label ? [{ t: label, b: true }] : []), ...text.split(" ").filter(Boolean).map(t => ({ t, b: false }))];

/* Draw a line of words, justified to the full width when asked. */
function drawLine(doc, words, x, y, width, justify) {
  let gap = L.cw;
  if (justify && words.length > 1) {
    const chars = words.reduce((n, w) => n + w.t.length, 0);
    gap = (width - chars * L.cw) / (words.length - 1);
  }
  for (const w of words) {
    doc.setFont("courier", w.b ? "bold" : "normal");
    doc.text(w.t, x, y);
    x += w.t.length * L.cw + gap;
  }
}

/* data: {number, date, sponsors[], committee, kind, title, target, purpose, sections:[string]} */
export function buildBillPdf(JsPDF, data) {
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const num = data.number, pd = printed(data.date);
  doc.setProperties({ title: `BILL NO. ${num}` });

  /* ---- first page: title block */
  doc.setFont("helvetica", "bold"); doc.setFontSize(40);
  doc.text(`BILL NO. ${num}`, 306, 80, { align: "center" });
  doc.setFontSize(L.size);

  const PRE = 15.5; let y = 153;
  const para = (text, { indent = 0, justify = true, bold = false } = {}) => {
    const lines = wrap(text.split(" ").filter(Boolean).map(t => ({ t, b: bold })), indent);
    lines.forEach((ln, i) => {
      const ind = i === 0 ? indent : 0, last = i === lines.length - 1;
      drawLine(doc, ln, L.left + ind * L.cw, y, (L.right - L.left) - ind * L.cw, justify && !last);
      y += PRE;
    });
  };
  const sponsors = joinNames((data.sponsors || []).map(clean).filter(Boolean));
  const cm = clean(data.committee).toLowerCase();
  para(`${introDate(data.date)}${sponsors ? ", introduced by " + sponsors : ""}${cm ? " and referred to the " + cm : ""}.`.replace(/^(.*?), introduced/, "$1, introduced"), { indent: 5 });
  y += PRE;

  const title = clean(data.title), target = clean(data.target), purpose = clean(data.purpose).replace(/[.;]+$/, "");
  if (data.kind === "create" || !data.kind) {
    para("A bill to create a new act entitled", { justify: false });
    para(`"${title}";`, { indent: 5, justify: false, bold: true });
    if (purpose) para(withPeriod(purpose.charAt(0).toLowerCase() === purpose.charAt(0) ? purpose : purpose));
  } else {
    const verb = data.kind === "repeal" ? "repeal" : "amend";
    para(withPeriod(`A bill to ${verb} ${target}${purpose ? "; " + purpose : ""}`.replace(/[.;]+$/, "")));
  }
  y += PRE * 1.4;

  doc.setFont("courier", "bold"); doc.setFontSize(13.5);
  doc.text("THE PEOPLE OF THE STATE OF MICHIGAN ENACT:", 306, y, { align: "center" });
  doc.setFontSize(L.size);
  const bodyStart = y + 25;

  /* ---- body: list of numbered lines */
  const items = [];
  data.sections.forEach((txt, si) => {
    if (si) items.push({ blank: true });
    const paras = txt.split("\n").map(clean).filter(Boolean);
    if (!paras.length) paras.push("");
    paras.forEach((p, pi) => {
      const lines = wrap(toWords(pi === 0 ? `Sec. ${si + 1}.` : "", p), L.indent);
      lines.forEach((ln, li) => items.push({ words: ln, first: li === 0, justify: li < lines.length - 1 }));
    });
  });

  const cap1 = Math.min(L.perPage, Math.floor((L.p1Bottom - bodyStart) / L.pitch) + 1);
  const footer = n => {
    doc.setFontSize(9);
    doc.setFont("courier", "normal"); doc.text(`BILL NO. ${num}`, L.num, 745);
    doc.setFont("courier", "bold"); doc.text(`PAGE ${n}`, 306, 745, { align: "center" });
    doc.setFont("courier", "normal"); doc.text(`PRINTED ${pd}`, L.right - 2, 745, { align: "right" });
    doc.setFontSize(L.size);
  };

  let page = 1, ln = 0, cap = cap1, y0 = bodyStart;
  for (const it of items) {
    if (ln === cap) { footer(page); doc.addPage(); page++; ln = 0; cap = L.perPage; y0 = L.top; }
    if (it.blank && ln === 0 && page > 1) continue;
    ln++;
    const yy = y0 + (ln - 1) * L.pitch;
    doc.setFont("helvetica", "bold"); doc.setFontSize(L.size);
    doc.text(String(ln), L.num, yy);
    doc.setFont("courier", "normal");
    if (!it.blank) {
      const ind = it.first ? L.indent * L.cw : 0;
      drawLine(doc, it.words, L.left + ind, yy, (L.right - L.left) - ind, it.justify);
    }
  }
  footer(page);
  return doc;
}

/* ---------------------------------------------------------------- library loader */
let jsPdfPromise;
const loadJsPdf = () => jsPdfPromise ||= new Promise((res, rej) => {
  if (window.jspdf) return res(window.jspdf.jsPDF);
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  s.onload = () => res(window.jspdf.jsPDF); s.onerror = () => { jsPdfPromise = null; rej(new Error("Could not load the PDF library.")); };
  document.head.appendChild(s);
});

/* ---------------------------------------------------------------- the dashboard page */
export async function mountDrafter(ctx) {
  const bills = await load("bills").catch(() => []);
  const fields = [
    { key: "number", label: "Bill number", type: "number", span: 2, req: true, auto: "number" },
    { key: "date", label: "Date introduced", type: "date", span: 2, req: true, default: "today" },
    { key: "committee", label: "Referred to committee", type: "select", span: 2, options: COMMITTEES, default: "Committee on Judiciary" },
    { key: "sponsors", label: "Introduced by", type: "people", asString: false, full: true, default: ctx.acct.name ? [ctx.acct.name] : [], hint: "Pick legislators or type a name; add as many as needed." },
    { key: "kind", label: "Bill type (create, amend or repeal an act)", type: "select", span: 2, options: ["create", "amend", "repeal"].map(String), default: "create" },
    { key: "title", label: "Act title", req: true, span: 4, showIf: { key: "kind", in: ["create"] }, placeholder: "Michigan code of criminal procedure act" },
    { key: "target", label: "Act being amended or repealed", req: true, span: 4, showIf: { key: "kind", in: ["amend", "repeal"] }, hint: 'e.g. 1931 PA 328, entitled "Michigan penal code act," MCL 750.1 to 750.568' },
    { key: "purpose", label: "Purpose clause", type: "textarea", rows: 3, full: true, hint: "Starts after \"A bill to create a new act entitled “Title”;\" e.g. “to govern criminal procedure; to provide for bail; and to repeal inconsistent acts.”" }
  ];
  const env = await prepare(fields, bills);
  const form = buildForm(fields, null, env);
  let secs = [""], pdfUrl = null, doc = null;

  ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>Draft a bill</h2></div>
    <div id="dfForm" class="grid2">${form.html}</div>
    <div class="section-head">Sections</div>
    <div class="hint" style="margin:0 0 .7rem;font-size:13px">Sections are numbered for you. Write one paragraph per line (start lines with (1), (a), etc. as in the final bill). A blank line is added between sections automatically.</div>
    <div id="dfSecs"></div>
    <div class="form-actions"><button class="btn btn-outline btn-sm" data-act="add">+ Section</button>
      <button class="btn btn-outline btn-sm" data-act="paste">Paste full text…</button></div>
    <div id="dfPaste" hidden style="margin-top:.6rem"><textarea id="dfPasteTa" style="width:100%;box-sizing:border-box" rows="8" placeholder="Paste the whole bill body. Text after each “Sec. 1.”, “Sec. 2.” … becomes its own section."></textarea>
      <div class="form-actions"><button class="btn btn-gold btn-sm" data-act="split">Split into sections</button></div></div>
    <div class="form-actions"><button class="btn btn-primary" data-act="gen">Generate PDF</button>
      <button class="btn btn-gold" data-act="dl" disabled>Download PDF</button></div></div>
    <div class="card" id="dfPrev" hidden><div class="bar"><h2>Preview</h2><span class="small" id="dfInfo"></span></div>
      <iframe id="dfFrame" style="width:100%;height:80vh;border:1px solid #dfe3ea;border-radius:6px;background:#fff"></iframe></div>`;
  form.init(ctx.panel.querySelector("#dfForm"));

  const secBox = ctx.panel.querySelector("#dfSecs");
  const syncSecs = () => secBox.querySelectorAll("textarea").forEach((t, i) => secs[i] = t.value);
  function drawSecs() {
    secBox.innerHTML = secs.map((t, i) => `<div class="card" style="padding:.7rem;margin-bottom:.6rem;box-shadow:none;border:1px solid #e3e7ee">
      <div class="bar" style="margin-bottom:.4rem"><b>Sec. ${i + 1}.</b>
        <span style="margin-left:auto;display:flex;gap:.3rem">
          <button class="btn btn-outline btn-sm" data-act="up" data-i="${i}" ${i ? "" : "disabled"}>↑</button>
          <button class="btn btn-outline btn-sm" data-act="down" data-i="${i}" ${i < secs.length - 1 ? "" : "disabled"}>↓</button>
          <button class="btn btn-outline btn-sm" data-act="del" data-i="${i}" ${secs.length > 1 ? "" : "disabled"}>Remove</button></span></div>
      <textarea style="width:100%;box-sizing:border-box" rows="${Math.max(4, Math.min(14, t.split("\n").length + 1))}" placeholder="${i === 0 ? "This act shall be known and may be cited as the “…”." : "(1) …"}">${esc(t)}</textarea></div>`).join("");
  }
  drawSecs();

  function collect() {
    syncSecs();
    const { data, errs } = form.collect(ctx.panel.querySelector("#dfForm"));
    const sections = secs.map(s => s.trim()).filter(Boolean);
    if (!sections.length) errs.push("Add at least one section.");
    return { data: { ...data, sections }, errs };
  }
  async function generate() {
    const { data, errs } = collect();
    if (errs.length) return ctx.flash(errs[0], "err");
    try {
      const JsPDF = await loadJsPdf();
      doc = buildBillPdf(JsPDF, data);
    } catch (e) { return ctx.flash(e.message || "Could not build the PDF.", "err"); }
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(doc.output("blob"));
    ctx.panel.querySelector("#dfFrame").src = pdfUrl;
    ctx.panel.querySelector("#dfPrev").hidden = false;
    ctx.panel.querySelector("#dfInfo").textContent = `${doc.getNumberOfPages()} page${doc.getNumberOfPages() === 1 ? "" : "s"}`;
    ctx.panel.querySelector('[data-act="dl"]').disabled = false;
    ctx.panel.querySelector("#dfPrev").scrollIntoView({ behavior: "smooth" });
  }

  const act = {
    add() { syncSecs(); secs.push(""); drawSecs(); },
    del(b) { syncSecs(); secs.splice(Number(b.dataset.i), 1); drawSecs(); },
    up(b) { const i = Number(b.dataset.i); syncSecs(); [secs[i], secs[i - 1]] = [secs[i - 1], secs[i]]; drawSecs(); },
    down(b) { const i = Number(b.dataset.i); syncSecs(); [secs[i], secs[i + 1]] = [secs[i + 1], secs[i]]; drawSecs(); },
    paste() { const p = ctx.panel.querySelector("#dfPaste"); p.hidden = !p.hidden; },
    split() {
      const txt = ctx.panel.querySelector("#dfPasteTa").value;
      const chunks = txt.split(/(?:^|\n)\s*Sec\.\s*\d+[a-z]?\.\s*/i).map(s => s.trim()).filter(Boolean);
      if (!chunks.length) return ctx.flash("Nothing to split.", "err");
      secs = chunks.map(c => c.replace(/\s*\n\s*(?=\(\w{1,3}\))/g, "\n").replace(/\n(?!\(\w{1,3}\))/g, " "));
      ctx.panel.querySelector("#dfPaste").hidden = true; drawSecs();
    },
    gen: generate,
    dl() { if (doc) doc.save(`Bill No. ${collect().data.number}.pdf`); }
  };
  ctx.on(act);
}