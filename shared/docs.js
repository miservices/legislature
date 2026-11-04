/* Document engine for bills, enrolled acts and public acts.
   Everything is stored as Markdown (a small subset: **bold**, *italic*, <u>underline</u>, ~~strike~~, one paragraph per line)
   and rendered three ways: bill (numbered Courier pages, also exported as PDF), enrolled act, and public act (current text).
   Amending bills carry hidden directives (<!--amend act=5 sec=3-->) that update public acts when the bill is enacted. */
import { esc } from "./util.js";

/* ---------------------------------------------------------------- dates */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ymd = iso => { const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number); return { y, m, d }; };
const ord = n => { const v = n % 100; return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th"); };
export const fullDate = iso => { const { y, m, d } = ymd(iso); return y ? `${MONTHS[m - 1]} ${d}, ${y}` : ""; };
export const introDate = iso => { const { y, m, d } = ymd(iso); return y ? `${MONTHS[m - 1]} ${ord(d)} of ${y}` : "(date of introduction)"; };
const printed = iso => { const { y, m, d } = ymd(iso); return y ? `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}-${y}` : "DRAFT"; };
const joinNames = a => a.length < 2 ? a.join("") : a.length === 2 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

/* ---------------------------------------------------------------- inline markdown */
const FLAGS = ["b", "i", "u", "s"];
const sameStyle = (a, b) => FLAGS.every(k => !!a[k] === !!b[k]);
export const clean = s => String(s ?? "")
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...")
  .replace(/ /g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export function parseInline(src) {
  const runs = []; const cur = { b: 0, i: 0, u: 0, s: 0 }; let buf = "";
  const flush = () => {
    if (!buf) return;
    const last = runs[runs.length - 1];
    if (last && sameStyle(last, cur)) last.t += buf; else runs.push({ t: buf, ...cur });
    buf = "";
  };
  const toggle = k => { flush(); cur[k] = cur[k] ? 0 : 1; };
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (c === "\\" && k + 1 < src.length) { buf += src[++k]; continue; }
    if (c === "*" && src[k + 1] === "*") { toggle("b"); k++; continue; }
    if (c === "~" && src[k + 1] === "~") { toggle("s"); k++; continue; }
    if (c === "*") { toggle("i"); continue; }
    if (src.startsWith("<u>", k)) { flush(); cur.u = 1; k += 2; continue; }
    if (src.startsWith("</u>", k)) { flush(); cur.u = 0; k += 3; continue; }
    buf += c;
  }
  flush(); return runs;
}
const escMd = t => t.replace(/[\\*~<]/g, "\\$&");
export function serializeRuns(runs) {
  let out = ""; const st = { b: 0, i: 0, u: 0, s: 0 };
  const mark = (k, on) => { st[k] = on; out += k === "b" ? "**" : k === "i" ? "*" : k === "s" ? "~~" : on ? "<u>" : "</u>"; };
  for (const r of runs) {
    if (!r.t) continue;
    for (const k of FLAGS) if (st[k] && !r[k]) mark(k, 0);
    for (const k of FLAGS) if (!st[k] && r[k]) mark(k, 1);
    out += escMd(r.t);
  }
  for (const k of FLAGS) if (st[k]) mark(k, 0);
  return out;
}
export const runsText = runs => runs.map(r => r.t).join("");
/* Final-text version of a line: deleted (struck) text goes, underline marks (new text) go. */
export const cleanRuns = runs => {
  const out = [];
  for (const r of runs) {
    if (r.s) continue;
    let t = r.t.replace(/ {2,}/g, " ");
    const prev = out[out.length - 1];
    if (prev && /\s$/.test(prev.t) && /^\s/.test(t)) t = t.replace(/^\s+/, "");
    if (t) out.push({ ...r, t, u: 0 });
  }
  return out;
};

const DIR = /^<!--\s*(amend|repeal|add)\s+act=(\d+)\s+sec=(\S+?)\s*-->$/;
const SECSTART = /^\s*Sec\.\s*(\d+[A-Za-z]*)\./;
export const dirLine = (op, act, sec) => `<!--${op} act=${act} sec=${sec}-->`;

/* Markdown body -> blocks: {k:"dir",op,act,sec} | {k:"blank"} | {k:"p",runs,sec} */
/* Marks left open at the end of a line (e.g. **bold across several lines**) carry on to the following lines until a blank line or directive. */
export function carryMarks(md) {
  let st = { b: 0, i: 0, u: 0, s: 0 };
  return String(md || "").replace(/\r/g, "").split("\n").map(line => {
    const t = line.trim();
    if (!t || DIR.test(t)) { st = { b: 0, i: 0, u: 0, s: 0 }; return line; }
    const open = (st.b ? "**" : "") + (st.i ? "*" : "") + (st.s ? "~~" : "") + (st.u ? "<u>" : "");
    for (let k = 0; k < line.length; k++) {
      const c = line[k];
      if (c === "\\") { k++; continue; }
      if (c === "*" && line[k + 1] === "*") { st.b ^= 1; k++; continue; }
      if (c === "~" && line[k + 1] === "~") { st.s ^= 1; k++; continue; }
      if (c === "*") { st.i ^= 1; continue; }
      if (line.startsWith("<u>", k)) { st.u = 1; k += 2; continue; }
      if (line.startsWith("</u>", k)) { st.u = 0; k += 3; continue; }
    }
    const close = (st.u ? "</u>" : "") + (st.s ? "~~" : "") + (st.i ? "*" : "") + (st.b ? "**" : "");
    return open + line.replace(/\s+$/, "") + close;
  }).join("\n");
}
export function blocks(md) {
  return carryMarks(md).split("\n").map(line => {
    const t = line.trim(), m = t.match(DIR);
    if (m) return { k: "dir", op: m[1], act: Number(m[2]), sec: m[3] };
    if (!t) return { k: "blank" };
    const runs = parseInline(line), sm = runsText(runs).match(SECSTART);
    return { k: "p", runs, sec: sm ? sm[1] : null };
  });
}
export const cleanMd = md => carryMarks(md).split("\n").map(line => {
  if (DIR.test(line.trim()) || !line.trim()) return line.trim();
  return serializeRuns(cleanRuns(parseInline(line)));
}).join("\n");

/* Hidden amendment directives and the restated text that follows each one (until a blank line, the next directive or the end). */
export function extractDirectives(md) {
  const bs = blocks(md), out = [];
  for (let i = 0; i < bs.length; i++) {
    if (bs[i].k !== "dir") continue;
    const d = { op: bs[i].op, act: bs[i].act, sec: bs[i].sec, lines: [] };
    for (let j = i + 1; j < bs.length && bs[j].k === "p"; j++) d.lines.push(serializeRuns(cleanRuns(bs[j].runs)));
    out.push(d);
  }
  return out;
}

/* ---------------------------------------------------------------- words and wrapping */
function toWords(runs) {
  const words = []; let w = null;
  for (const r of runs) for (const ch of r.t) {
    if (ch === " ") { w = null; continue; }
    if (!w) { w = { segs: [], len: 0 }; words.push(w); }
    const last = w.segs[w.segs.length - 1];
    if (last && sameStyle(last, r)) last.t += ch; else w.segs.push({ t: ch, b: r.b, i: r.i, u: r.u, s: r.s });
    w.len++;
  }
  return words;
}
const plainWords = (text, bold = false) => toWords([{ t: text, b: bold ? 1 : 0, i: 0, u: 0, s: 0 }]);

/* Greedy monospace wrap. The first line is `indent` characters narrower. */
function wrapWords(words, indent, cols) {
  const lines = []; let cur = [], len = 0, room = cols - indent;
  for (const w of words) {
    const add = (cur.length ? 1 : 0) + w.len;
    if (cur.length && len + add > room) { lines.push(cur); cur = []; len = 0; room = cols; }
    len += (cur.length ? 1 : 0) + w.len; cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}
const first = w => w.segs[0], last = w => w.segs[w.segs.length - 1];
const gapStyle = (a, b) => ({ u: last(a).u && first(b).u ? 1 : 0, s: last(a).s && first(b).s ? 1 : 0 });

/* ---------------------------------------------------------------- bill layout (US Letter, points) */
const L = { left: 79, right: 558, num: 48, size: 12, cw: 7.2, pitch: 13.8, top: 66, perPage: 49, p1Bottom: 718, indent: 4, pre: 15.5 };
const COLS = Math.floor((L.right - L.left) / L.cw);
const kindWord = d => d.kind === "resolution" ? "RESOLUTION" : "BILL";

export function preambleParts(d) {
  const title = clean(d.title).trim(), target = clean(d.target).trim(), purpose = clean(d.purpose).trim().replace(/[.;]+$/, "");
  if (d.kind === "resolution") return { lead: "", title: "", text: `A resolution${purpose ? " " + purpose : ""}.` };
  if (!d.action || d.action === "create") return { lead: "A bill to create a new act entitled", title: `"${title || "(title of the act)"}";`, text: purpose ? purpose + "." : "" };
  return { lead: "", title: "", text: `A bill to ${d.action === "repeal" ? "repeal" : "amend"} ${target || "(act to be amended)"}${purpose ? "; " + purpose : ""}.` };
}
const introLine = d => {
  const sp = joinNames((d.sponsors ? (Array.isArray(d.sponsors) ? d.sponsors : String(d.sponsors).split(/,\s*/)) : []).map(s => clean(s).trim()).filter(Boolean));
  const cm = clean(d.committee).trim().toLowerCase();
  if (d.type === "substitute" || d.type === "amended") return `${d.label || "Substitute"} offered${sp ? " by " + sp : ""}, ${introDate(d.date)}.`;
  return `${introDate(d.date)}${sp ? ", introduced by " + sp : ", introduced"}${cm ? " and referred to the " + cm : ""}.`;
};

/* -> { pages:[{items:[...]}], footer:{num, printed} }. item kinds: title, center, text, num */
export function layoutBill(d) {
  const pages = [{ items: [] }]; let y = 153;
  const p1 = pages[0].items;
  const numLabel = d.number ? `${kindWord(d)} NO. ${d.number}` : `${kindWord(d)} NO. ___`;
  if (d.type === "substitute") p1.push({ t: "title", text: `SUBSTITUTE ${(d.label || "").replace(/^Substitute\s*/i, "")} FOR`.replace(/\s+/g, " "), size: 16, y: 40 });
  else if (d.type === "amended") p1.push({ t: "title", text: `AS AMENDED ${(d.label || "").replace(/^Amended\s*/i, "")}`.replace(/\s+/g, " ").trim().toUpperCase(), size: 16, y: 40 });
  p1.push({ t: "title", text: numLabel, size: 40, y: 80 });
  const para = (text, { indent = 0, justify = true, bold = false } = {}) => {
    const lines = wrapWords(plainWords(text, bold), indent, COLS);
    lines.forEach((ln, i) => {
      const ind = i === 0 ? indent : 0;
      p1.push({ t: "text", x: L.left + ind * L.cw, y, w: (L.right - L.left) - ind * L.cw, words: ln, just: justify && i < lines.length - 1 });
      y += L.pre;
    });
  };
  para(introLine(d), { indent: 5 }); y += L.pre;
  const pp = preambleParts(d);
  if (pp.lead) para(pp.lead, { justify: false });
  if (pp.title) para(pp.title, { indent: 5, justify: false, bold: true });
  if (pp.text) para(pp.text);
  y += L.pre * 1.4;
  p1.push({ t: "center", text: d.kind === "resolution" ? "THE LEGISLATURE RESOLVES:" : "THE PEOPLE OF THE STATE OF MICHIGAN ENACT:", y, size: 13.5, bold: true });
  const bodyStart = y + 25;

  /* numbered body lines */
  const body = [];
  for (const b of blocks(d.md)) {
    if (b.k === "dir") continue;
    if (b.k === "blank") { body.push({ blank: true }); continue; }
    wrapWords(toWords(b.runs), L.indent, COLS).forEach((ln, i, all) => body.push({ words: ln, first: i === 0, just: i < all.length - 1 }));
  }
  while (body.length && body[body.length - 1].blank) body.pop();

  const cap1 = Math.min(L.perPage, Math.floor((L.p1Bottom - bodyStart) / L.pitch) + 1);
  let ln = 0, cap = cap1, y0 = bodyStart, page = pages[0];
  for (const it of body) {
    if (ln === cap) { page = { items: [] }; pages.push(page); ln = 0; cap = L.perPage; y0 = L.top; }
    if (it.blank && ln === 0 && pages.length > 1) continue;
    ln++;
    const yy = y0 + (ln - 1) * L.pitch;
    page.items.push({ t: "num", n: ln, y: yy });
    if (!it.blank) {
      const ind = it.first ? L.indent * L.cw : 0;
      page.items.push({ t: "text", x: L.left + ind, y: yy, w: (L.right - L.left) - ind, words: it.words, just: it.just });
    }
  }
  return { pages, footer: { label: numLabel, printed: printed(d.date) } };
}

/* ---- bill as HTML pages (same layout as the PDF) */
const cls = s => ["b", "i", "u", "s"].filter(k => s[k]).join(" ");
const segHtml = s => `<span class="${cls(s)}">${esc(s.t)}</span>`;
const wordHtml = w => w.segs.map(segHtml).join("");
function lineHtml(words) {
  let h = "";
  words.forEach((w, i) => {
    if (i) { const g = gapStyle(words[i - 1], w); h += g.u || g.s ? `<span class="${cls(g)}"> </span>` : " "; }
    h += wordHtml(w);
  });
  return h;
}
export function billHtml(d) {
  const lay = layoutBill(d);
  return `<div class="bill-pages">${lay.pages.map((pg, pi) => `<div class="bp-fit"><div class="bp">${pg.items.map(it => {
    if (it.t === "title") return `<div class="bp-title" style="top:${it.y - it.size * 0.78}px;font-size:${it.size}px">${esc(it.text)}</div>`;
    if (it.t === "center") return `<div class="bp-center" style="top:${it.y - 11}px;font-size:${it.size}px">${esc(it.text)}</div>`;
    if (it.t === "num") return `<div class="bp-num" style="top:${it.y - 11}px">${it.n}</div>`;
    return `<div class="bp-ln${it.just ? " just" : ""}" style="left:${it.x}px;top:${it.y - 11}px;width:${it.w}px">${lineHtml(it.words)}</div>`;
  }).join("")}<div class="bp-foot"><span>${esc(lay.footer.label)}</span><b>PAGE ${pi + 1}</b><span>PRINTED ${esc(lay.footer.printed)}</span></div></div></div>`).join("")}</div>`;
}

/* ---- bill as PDF (needs the jsPDF constructor) */
export function billPdf(JsPDF, d) {
  const lay = layoutBill(d), doc = new JsPDF({ unit: "pt", format: "letter" });
  doc.setProperties({ title: lay.footer.label });
  const font = s => s.b && s.i ? "bolditalic" : s.b ? "bold" : s.i ? "italic" : "normal";
  lay.pages.forEach((pg, pi) => {
    if (pi) doc.addPage();
    for (const it of pg.items) {
      if (it.t === "title") { doc.setFont("helvetica", "bold"); doc.setFontSize(it.size); doc.text(it.text, 306, it.y, { align: "center" }); }
      else if (it.t === "center") { doc.setFont("courier", "bold"); doc.setFontSize(it.size); doc.text(it.text, 306, it.y, { align: "center" }); }
      else if (it.t === "num") { doc.setFont("helvetica", "bold"); doc.setFontSize(L.size); doc.text(String(it.n), L.num, it.y); }
      else {
        doc.setFontSize(L.size);
        const chars = it.words.reduce((n, w) => n + w.len, 0);
        const gap = it.just && it.words.length > 1 ? (it.w - chars * L.cw) / (it.words.length - 1) : L.cw;
        let x = it.x;
        it.words.forEach((w, wi) => {
          if (wi) { const g = gapStyle(it.words[wi - 1], w); if (g.u) doc.line(x, it.y + 1.5, x + gap, it.y + 1.5); if (g.s) doc.line(x, it.y - 3.5, x + gap, it.y - 3.5); x += gap; }
          for (const s of w.segs) {
            doc.setFont("courier", font(s)); doc.text(s.t, x, it.y);
            const wd = s.t.length * L.cw;
            if (s.u) doc.line(x, it.y + 1.5, x + wd, it.y + 1.5);
            if (s.s) doc.line(x, it.y - 3.5, x + wd, it.y - 3.5);
            x += wd;
          }
        });
      }
    }
    doc.setFontSize(9);
    doc.setFont("courier", "normal"); doc.text(lay.footer.label, L.num, 745);
    doc.setFont("courier", "bold"); doc.text(`PAGE ${pi + 1}`, 306, 745, { align: "center" });
    doc.setFont("courier", "normal"); doc.text(`PRINTED ${lay.footer.printed}`, L.right - 2, 745, { align: "right" });
  });
  return doc;
}

/* ---------------------------------------------------------------- shared flowing-text helpers */
const runHtml = r => { let h = esc(r.t); if (r.b) h = `<b>${h}</b>`; if (r.i) h = `<i>${h}</i>`; if (r.u) h = `<u>${h}</u>`; if (r.s) h = `<s>${h}</s>`; return h; };
const paraHtml = (line, cls = "") => `<p class="${cls}">${cleanRuns(parseInline(line)).map(runHtml).join("")}</p>`;
const actSentence = (d, word = "AN ACT") => {
  const pp = preambleParts({ ...d, kind: "bill" });
  const t = pp.lead ? `to create a new act entitled ${pp.title} ${pp.text}` : pp.text.replace(/^A bill /, "");
  return `${word} ${t}`.replace(/\s+/g, " ").trim();
};

/* ---------------------------------------------------------------- enrolled act */
export function enrolledHtml(d) {
  const body = blocks(d.md).filter(b => b.k === "p").map(b => `<p class="enr-p">${cleanRuns(b.runs).map(runHtml).join("")}</p>`).join("");
  return `<article class="doc enr">
    <div class="enr-top"><div>Act No. ${esc(d.actNumber || "")}</div><div>Public Acts of ${esc(d.year || "")}</div>
      <div>Approved by the Governor<br>${esc(fullDate(d.signedDate))}</div><div>Filed with the Secretary of State<br>${esc(fullDate(d.filedDate || d.signedDate))}</div>
      <div class="enr-eff">EFFECTIVE DATE: ${esc(fullDate(d.effectiveDate || d.signedDate))}</div></div>
    <div class="enr-state">STATE OF MICHIGAN</div><div class="enr-leg">LEGISLATURE</div>
    <h1 class="enr-h">ENROLLED ${esc(kindWord(d))} No. ${esc(d.number || "")}</h1>
    <p class="enr-title">${esc(actSentence(d))}</p>
    <p class="enr-enact"><i>The People of the State of Michigan enact:</i></p>
    ${body}
    <div class="enr-sign"><div><span></span>Clerk of the Legislature</div><div><span></span>Speaker of the Legislature</div><div><span></span>Governor</div></div>
  </article>`;
}

/* ---------------------------------------------------------------- public act (current text) */
const SECMARK = /^<!--\s*sec\s+(\S+?)((?:\s+(?:repealed|hist="[^"]*"))*)\s*-->$/;
export function parseAct(md) {
  const secs = []; let cur = null;
  for (const line of String(md || "").replace(/\r/g, "").split("\n")) {
    const m = line.trim().match(SECMARK);
    if (m) { cur = { n: m[1], hist: (m[2].match(/hist="([^"]*)"/) || [])[1] || "", repealed: /\srepealed/.test(m[2]), lines: [] }; secs.push(cur); }
    else if (cur && line.trim()) cur.lines.push(line.trim());
  }
  for (const s of secs) if (s.lines.length) s.lines = carryMarks(s.lines.join("\n")).split("\n");
  return secs;
}
export const serializeAct = secs => secs.map(s => `<!--sec ${s.n}${s.repealed ? " repealed" : ""}${s.hist ? ` hist="${s.hist.replace(/"/g, "'")}"` : ""}-->\n${s.lines.join("\n")}`).join("\n\n") + "\n";
const secKey = n => { const m = String(n).match(/^(\d+)(.*)$/); return m ? [Number(m[1]), m[2]] : [1e9, String(n)]; };
const secCmp = (a, b) => { const [x, xs] = secKey(a), [y, ys] = secKey(b); return x - y || xs.localeCompare(ys); };

/* Bill body -> public act sections (final text only). Everything before the first "Sec." and directive lines are dropped. */
export function billToActMd(md, { year, number, date }) {
  const secs = []; let cur = null;
  for (const b of blocks(md)) {
    if (b.k === "dir") continue;
    if (b.k === "p" && b.sec) { cur = { n: b.sec, hist: `${year} PA ${number}, Eff. ${fullDate(date)}`, repealed: false, lines: [] }; secs.push(cur); }
    if (b.k === "p" && cur) cur.lines.push(serializeRuns(cleanRuns(b.runs)));
  }
  return serializeAct(secs);
}

/* Apply one directive from an amending act to a public act's markdown. Returns { md, ok }. */
export function applyDirective(actMd, d, { year, number, date }) {
  const secs = parseAct(actMd), i = secs.findIndex(s => s.n === d.sec), eff = fullDate(date);
  const body = lines => {
    const ls = lines.filter(Boolean).slice();
    if (!ls.length) ls.push(`**Sec. ${d.sec}.**`);
    else if (SECSTART.test(runsText(parseInline(ls[0])))) { const r = parseInline(ls[0]); let done = false; ls[0] = serializeRuns(r.map(x => { if (done) return x; const m = x.t.match(/^(\s*)Sec\.\s*\d+[A-Za-z]*\./); if (!m) return x; done = true; return { ...x, t: x.t.replace(/Sec\.\s*\d+[A-Za-z]*\./, `Sec. ${d.sec}.`) }; })); }
    else ls[0] = `**Sec. ${d.sec}.** ` + ls[0];
    return ls;
  };
  if (d.op === "repeal") {
    if (i < 0) return { md: actMd, ok: false };
    secs[i] = { ...secs[i], repealed: true, lines: [], hist: [secs[i].hist, `Rep. ${year} PA ${number}, Eff. ${eff}`].filter(Boolean).join("; ") };
  } else if (d.op === "amend") {
    if (i < 0) return { md: actMd, ok: false };
    secs[i] = { ...secs[i], repealed: false, lines: body(d.lines), hist: [secs[i].hist, `Am. ${year} PA ${number}, Eff. ${eff}`].filter(Boolean).join("; ") };
  } else {
    if (i >= 0) return { md: actMd, ok: false };
    secs.push({ n: d.sec, repealed: false, lines: body(d.lines), hist: `Add. ${year} PA ${number}, Eff. ${eff}` });
    secs.sort((a, b) => secCmp(a.n, b.n));
  }
  return { md: serializeAct(secs), ok: true };
}

export function actHtml(d) {
  const secs = parseAct(d.md), amended = (d.amendedBy || []);
  const bodyOf = s => s.repealed ? `<p class="act-p"><b>Sec. ${esc(s.n)}.</b> Repealed.</p>` : s.lines.map(l => paraHtml(l, "act-p")).join("");
  return `<article class="doc act">
    <div class="act-banner"><b>Current version</b>${amended.length ? ` · includes ${amended.length} amendment${amended.length === 1 ? "" : "s"}` : " · no amendments"}${d.updatedThrough ? ` · through ${esc(fullDate(d.updatedThrough))}` : ""}</div>
    <div class="act-grid">
      <nav class="act-toc"><b>Sections</b>${secs.map(s => `<a href="#sec-${esc(s.n)}" class="${s.repealed ? "rep" : ""}">${esc(s.n)}</a>`).join("")}</nav>
      <div class="act-main">
        <div class="act-no">Act ${esc(d.actNumber || "")} of ${esc(d.year || "")}</div>
        <h1 class="act-name">${esc((d.title || "").toUpperCase())}</h1>
        <p class="act-an">${esc(actSentence(d))}</p>
        <p class="act-enact"><i>The People of the State of Michigan enact:</i></p>
        ${secs.map(s => `<section id="sec-${esc(s.n)}" class="act-sec">${bodyOf(s)}${s.hist ? `<div class="act-hist"><b>History:</b> ${esc(s.hist)}.</div>` : ""}</section>`).join("")}
        ${amended.length ? `<div class="act-amends"><h3>Amendment history</h3><ul>${amended.map(a => `<li><a href="#act-${esc(a.act)}">${esc(a.year || "")} PA ${esc(a.act)}</a> (Bill No. ${esc(a.bill || "")}) — ${esc(a.summary || "")}${a.date ? ", effective " + esc(fullDate(a.date)) : ""}</li>`).join("")}</ul></div>` : ""}
      </div>
    </div></article>`;
}

/* A proposal or draft (private) shaped like a bill document so it can be previewed. */
export const fromDraft = x => ({
  type: "bill", kind: /resolution/i.test(x.type || x.kind || "") ? "resolution" : "bill", number: x.number || "", date: x.date || "",
  sponsors: x.sponsors || x.sponsorName || x.ownerName || "", committee: x.committee || "", action: x.action || "create",
  title: x.actTitle ?? x.title ?? "", target: x.target || "", purpose: x.purpose || x.description || "", md: x.md || ""
});

export const renderDoc = d => d.type === "enrolled" ? enrolledHtml(d) : d.type === "act" ? actHtml(d) : billHtml(d);
export const docTitle = d => {
  const w = d.kind === "resolution" ? "Resolution" : "Bill";
  return d.type === "enrolled" ? `Enrolled ${w} No. ${d.number}` : d.type === "act" ? `Public Act ${d.actNumber} of ${d.year}` : `${d.type === "substitute" || d.type === "amended" ? d.label + " — " : ""}${w} No. ${d.number || "(draft)"}`;
};

/* Scale a rendered .bp page to fit its container (pages are laid out at 612x792). */
export function fitPages(root) {
  const apply = () => root.querySelectorAll(".bp-fit").forEach(f => {
    const k = Math.min(1, f.parentElement.clientWidth / 612 || 1);
    f.style.height = 792 * k + "px"; f.style.width = 612 * k + "px"; f.firstElementChild.style.transform = `scale(${k})`;
  });
  apply(); window.addEventListener("resize", apply); return apply;
}
