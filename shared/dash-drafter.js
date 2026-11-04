/* Bill drafter: a word-processor-style editor that saves as you type and submits a bill or resolution as Markdown.
   Drafts live in the `drafts` collection (private to their author); submitting creates a proposal for the Clerk's office.
   Admins can also open a bill's latest text here to write a substitute (?substitute=<bill number>). */
import { db, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "./fb.js";
import { esc, COMMITTEES } from "./util.js?v=2";
import { blocks, carryMarks, parseInline, serializeRuns, runsText, clean, dirLine, chapterLine, parseAct, cleanMd, fromDraft, billHtml, billPdf, preambleParts, introDate, fitPages, docTitle } from "./docs.js?v=4";
import { todayISO } from "./dash-core.js?v=2";

const SECRE = /^\s*(Sec\.\s*)(\d+[A-Za-z]*)(\.)/;
const NB = / /g;

/* ---------------------------------------------------------------- editor <-> Markdown */
const runHtml = r => {
  let h = esc(r.t).replace(/ {2}/g, " &nbsp;");
  if (r.s) h = `<s>${h}</s>`; if (r.u) h = `<u>${h}</u>`; if (r.i) h = `<i>${h}</i>`; if (r.b) h = `<b>${h}</b>`;
  return h;
};
const dirLabel = (op, act, sec) => `${op === "amend" ? "Amends" : op === "repeal" ? "Repeals" : "Adds"} Public Act ${act}, Sec. ${sec}`;
const dirHtml = (op, act, sec) => `<div class="dir" contenteditable="false" data-op="${op}" data-act="${act}" data-sec="${esc(sec)}">${esc(dirLabel(op, act, sec))}<i title="Remove">&times;</i></div>`;
const chapHtml = (num, title) => `<div class="dir ch" contenteditable="false" data-chapter="${esc(num)}" data-title="${esc(title || "")}">Chapter ${esc(num)}${title ? " — " + esc(title) : ""}<i title="Remove">&times;</i></div>`;
/* Auto-bold "Sec. 12." at the start of a line. */
const withSecBold = runs => {
  const text = runsText(runs), m = text.match(SECRE);
  if (!m) return runs;
  const len = m[0].length, out = []; let used = 0;
  for (const r of runs) {
    if (used >= len) { out.push(r); continue; }
    const take = Math.min(len - used, r.t.length);
    out.push({ ...r, t: r.t.slice(0, take), b: 1 }); if (take < r.t.length) out.push({ ...r, t: r.t.slice(take) });
    used += take;
  }
  return out;
};
const mdToHtml = md => carryMarks(md).split("\n").map(line => {
  const b = blocks(line)[0];
  if (b.k === "dir") return dirHtml(b.op, b.act, b.sec);
  if (b.k === "chapter") return chapHtml(b.num, b.title);
  if (b.k === "blank") return "<div><br></div>";
  return `<div>${withSecBold(b.runs).map(runHtml).join("")}</div>`;
}).join("") || "<div><br></div>";

/* Inline style flags carried down the DOM tree. */
function styleOf(el, st) {
  const s = { ...st }, tag = el.tagName, css = el.style || {};
  const fw = css.fontWeight, td = (css.textDecoration || css.textDecorationLine || "");
  if (tag === "B" || tag === "STRONG") s.b = fw === "normal" || fw === "400" ? 0 : 1;
  if (fw && fw !== "normal" && (fw === "bold" || Number(fw) >= 600)) s.b = 1;
  if (tag === "I" || tag === "EM" || css.fontStyle === "italic") s.i = 1;
  if (tag === "U" || /underline/.test(td)) s.u = 1;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL" || /line-through/.test(td)) s.s = 1;
  return s;
}
function collectRuns(node, st, out) {
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { const t = c.nodeValue.replace(NB, " "); if (t) out.push({ t, ...st }); }
    else if (c.nodeType === 1 && c.tagName !== "BR" && !c.classList.contains("dir")) collectRuns(c, styleOf(c, st), out);
  }
  return out;
}
const BLOCKS = new Set(["DIV", "P", "LI", "H1", "H2", "H3", "H4", "UL", "OL", "TR"]);
/* Each top-level block becomes one Markdown line. */
function domToMd(ed) {
  const lines = []; let inline = [];
  const flush = () => { if (inline.length) { lines.push(serializeRuns(mergeRuns(inline)).trimEnd()); inline = []; } };
  const lineOf = node => lines.push(serializeRuns(mergeRuns(collectRuns(node, { b: 0, i: 0, u: 0, s: 0 }, []))).trimEnd());
  const walk = node => {
    if (node.nodeType === 3) { inline.push({ t: node.nodeValue.replace(NB, " "), b: 0, i: 0, u: 0, s: 0 }); return; }
    if (node.nodeType !== 1) return;
    if (node.classList.contains("dir")) { flush(); lines.push(node.dataset.chapter ? chapterLine(node.dataset.chapter, node.dataset.title) : dirLine(node.dataset.op, node.dataset.act, node.dataset.sec)); return; }
    if (node.tagName === "BR") { flush(); lines.push(""); return; }
    if (BLOCKS.has(node.tagName)) {
      flush();
      if ([...node.children].some(c => BLOCKS.has(c.tagName) || c.classList.contains("dir"))) [...node.childNodes].forEach(walk);
      else lineOf(node);
    } else inline.push(...collectRuns({ childNodes: [node] }, { b: 0, i: 0, u: 0, s: 0 }, []));
  };
  [...ed.childNodes].forEach(walk); flush();
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}
const mergeRuns = runs => runs.reduce((a, r) => { const l = a[a.length - 1]; if (l && ["b", "i", "u", "s"].every(k => !!l[k] === !!r[k])) l.t += r.t; else a.push({ ...r }); return a; }, []);

/* Pasted HTML (Google Docs, Word, web) -> lines of runs, keeping bold/italic/underline/strike. */
function linesFromHtml(html) {
  const body = new DOMParser().parseFromString(html, "text/html").body, lines = []; let cur = [];
  const push = () => { if (cur.length) lines.push(cur); else if (lines.length) lines.push([]); cur = []; };
  const walk = (node, st) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { const t = clean(c.nodeValue.replace(/\s+/g, " ")); if (t) cur.push({ t, ...st }); }
      else if (c.nodeType === 1) {
        const tag = c.tagName; if (tag === "STYLE" || tag === "SCRIPT") continue;
        if (tag === "BR") { push(); continue; }
        const s = styleOf(c, st);
        if (BLOCKS.has(tag)) { if (cur.length) push(); walk(c, s); push(); } else walk(c, s);
      }
    }
  };
  walk(body, { b: 0, i: 0, u: 0, s: 0 }); if (cur.length) lines.push(cur);
  return lines.map(l => { const m = mergeRuns(l); if (m.length) { m[0].t = m[0].t.replace(/^\s+/, ""); } return m; });
}

/* Caret helpers: character offsets inside a block. */
function offsetIn(block, node, off) { const r = document.createRange(); r.selectNodeContents(block); r.setEnd(node, off); return r.toString().length; }
function posAt(block, offset) {
  const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT); let n, left = offset, last = null;
  while ((n = w.nextNode())) { last = n; if (left <= n.nodeValue.length) return { node: n, off: left }; left -= n.nodeValue.length; }
  return last ? { node: last, off: last.nodeValue.length } : { node: block, off: 0 };
}
function setSel(block, a, b = a) {
  const s = posAt(block, a), e = posAt(block, b), r = document.createRange(), sel = getSelection();
  r.setStart(s.node, s.off); r.setEnd(e.node, e.off); sel.removeAllRanges(); sel.addRange(r);
}

/* ---------------------------------------------------------------- the page */
export async function mountDrafter(ctx) {
  const root = ctx.panel, uid = ctx.uid, me = ctx.acct.name;
  let draft = null, nameTouched = false, dirty = false, timer = null, tab = "edit", saving = Promise.resolve(), acts = null;
  const $ = s => root.querySelector(s);
  const hash = id => history.replaceState(null, "", location.pathname + (id ? "#" + id : ""));
  const stamp = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (!document.querySelector("link[data-doccss]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = new URL("doc.css", import.meta.url).href; l.setAttribute("data-doccss", ""); document.head.appendChild(l); }

  /* ------------------------------------------------------------ drafts list */
  async function showList() {
    await flushSave(); draft = null; hash("");
    root.innerHTML = `<div class="card dr-list"><div class="bar"><h2>My drafts</h2><span class="grow"></span>
        <button class="btn btn-gold btn-sm" data-act="newBill">+ New bill</button><button class="btn btn-outline btn-sm" data-act="newRes">+ New resolution</button></div>
      <p class="lead">Write your bill here instead of in Google Docs. Your work saves automatically. When it's ready, submit it and the Clerk's office will introduce it.</p>
      <div id="dl"><div class="skel" style="height:14px;width:50%"></div></div></div>`;
    try {
      const snap = await getDocs(query(collection(db, "drafts"), where("ownerUid", "==", uid)));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      $("#dl").innerHTML = rows.length ? rows.map(r => `<div class="row"><div class="t"><b>${esc(r.name || "Untitled")}</b><small>${esc(r.substituteFor ? (r.vtype === "amended" ? "Amended version of Bill No. " : "Substitute for Bill No. ") + r.substituteFor : r.type)} · edited ${r.updatedAt?.seconds ? esc(new Date(r.updatedAt.seconds * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })) : "just now"}</small></div>
          <button class="btn btn-primary btn-sm" data-act="openDraft" data-id="${esc(r.id)}">Open</button><button class="btn btn-danger btn-sm" data-act="delDraft" data-id="${esc(r.id)}">Delete</button></div>`).join("")
        : '<div class="empty-state" style="padding:1rem 0">No drafts yet. Start a new bill above.</div>';
    } catch (e) { console.error(e); $("#dl").innerHTML = '<div class="msg err">Couldn\'t load your drafts.</div>'; }
  }
  async function newDraft(type, extra = {}) {
    const base = { ownerUid: uid, ownerName: me, type, name: type === "Resolution" ? "Untitled resolution" : "Untitled bill", action: "create", actTitle: "", target: "", purpose: "", committee: "", md: "", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra };
    const ref = await addDoc(collection(db, "drafts"), base);
    return openDraft(ref.id);
  }
  async function openDraft(id) {
    const snap = await getDoc(doc(db, "drafts", id));
    if (!snap.exists()) return showList();
    draft = { id, ...snap.data() }; nameTouched = !/^Untitled /.test(draft.name || "") ; hash(id); tab = "edit"; drawEditor();
  }

  /* ------------------------------------------------------------ editor */
  function drawEditor() {
    const sub = draft.substituteFor, res = draft.type === "Resolution";
    root.innerHTML = `<div class="dr">
      <div class="dr-top"><button class="btn btn-outline btn-sm" data-act="toList">&larr; Drafts</button>
        <input class="dr-name" id="dName" value="${esc(draft.name || "")}" maxlength="120" aria-label="Draft name"><span class="dr-state" id="dState">Saved</span>
        <button class="btn btn-primary btn-sm" data-act="submit">${sub ? (draft.vtype === "amended" ? "Publish amended version" : "Publish substitute") : "Submit"}</button></div>
      <div class="dr-tabs"><button data-act="tab" data-t="edit" class="${tab === "edit" ? "on" : ""}">Edit</button><button data-act="tab" data-t="preview" class="${tab === "preview" ? "on" : ""}">Preview as ${res ? "resolution" : "bill"}</button></div>
      <div class="dr-tool" id="tool">
        <button data-cmd="undo" title="Undo (Ctrl+Z)">&#8630;</button><button data-cmd="redo" title="Redo (Ctrl+Y)">&#8631;</button><span class="sep"></span>
        <button data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button><button data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
        <button data-cmd="underline" title="Underline (Ctrl+U) — new text in an amended section"><u>U</u></button><button data-cmd="strikeThrough" title="Strikethrough (Ctrl+Shift+X) — deleted text"><s>S</s></button><span class="sep"></span>
        <button class="txt" data-act="addSec" title="Add the next numbered section">+ Section</button><button class="txt" data-act="addChap" title="Insert a chapter heading">+ Chapter</button><button class="txt" data-act="renumber" title="Renumber sections 1, 2, 3…">Renumber</button>
        ${res ? "" : '<span class="sep"></span><button class="txt" data-act="amendDlg" title="Amend, repeal or add a section of an existing public act">Amend an act…</button>'}
      </div>
      <div id="paneEdit" class="dr-body" ${tab === "edit" ? "" : "hidden"}>
        <div class="dr-paper"><div class="dr-head">${res ? "RESOLUTION" : "BILL"} NO. ___</div><div class="dr-sub">The number and date are assigned when it is introduced.</div>
          <div class="dr-pre" id="pre"></div><div class="dr-enact">${res ? "THE LEGISLATURE RESOLVES:" : "THE PEOPLE OF THE STATE OF MICHIGAN ENACT:"}</div>
          <div class="ed" id="ed" contenteditable="true" spellcheck="true"></div></div>
        <aside class="dr-side">
          <div class="card"><h3>${res ? "Resolution" : "Bill"} details</h3>
            ${res ? "" : `<div class="field"><label>This bill will</label><select id="dAction"><option value="create">Create a new act</option><option value="amend">Amend an existing act</option><option value="repeal">Repeal an act</option></select></div>
            <div class="field" id="fTitle"><label>Title of the new act</label><input id="dTitle" placeholder="Michigan code of criminal procedure act"></div>
            <div class="field" id="fTarget"><label>Act being amended or repealed</label><input id="dTarget" placeholder='1931 PA 328, entitled "Michigan penal code act,"'></div>`}
            <div class="field"><label>${res ? "Resolution reads" : "Purpose"}</label><textarea id="dPurpose" rows="5" placeholder="${res ? "to urge… / to commend…" : "to govern criminal procedure; to provide for bail; and to repeal inconsistent acts"}"></textarea></div>
            <div class="field"><label>Suggested committee</label><select id="dCom"><option value="">No preference</option>${COMMITTEES.map(c => `<option>${esc(c)}</option>`).join("")}</select></div></div>
          <div class="card"><h3>Writing tips</h3><div class="hint" style="line-height:1.55">• One paragraph per line; <b>Sec. 1.</b> bolds itself.<br>• <b>+ Section</b> adds the next number. <b>Renumber</b> fixes the order.<br>• To change existing law use <b>Amend an act…</b>: it inserts the current text; <s>strike</s> what goes and <u>underline</u> what's new.<br>• Keep an amended section's lines together; a blank line ends it.</div></div>
        </aside></div>
      <div id="panePrev" class="dr-prev" ${tab === "preview" ? "" : "hidden"}></div></div>`;
    const ed = $("#ed");
    ed.innerHTML = mdToHtml(draft.md); toggleEmpty();
    if (!res) { $("#dAction").value = draft.action || "create"; $("#dTitle").value = draft.actTitle || ""; $("#dTarget").value = draft.target || ""; }
    $("#dPurpose").value = draft.purpose || ""; $("#dCom").value = draft.committee || "";
    syncFields(); drawPre();
    document.execCommand("defaultParagraphSeparator", false, "div");
    if (tab === "preview") drawPreview();
  }
  const syncFields = () => {
    const a = $("#dAction")?.value || "create";
    if ($("#fTitle")) { $("#fTitle").hidden = a !== "create"; $("#fTarget").hidden = a === "create"; }
  };
  const toggleEmpty = () => { const ed = $("#ed"); if (ed) ed.classList.toggle("empty", !ed.textContent.trim() && !ed.querySelector(".dir")); };
  function readMeta() {
    if (draft.type !== "Resolution") { draft.action = $("#dAction").value; draft.actTitle = $("#dTitle").value.trim(); draft.target = $("#dTarget").value.trim(); }
    if (!nameTouched && draft.actTitle && draft.action === "create") $("#dName").value = draft.actTitle;
    draft.name = $("#dName").value.trim() || (draft.type === "Resolution" ? "Untitled resolution" : "Untitled bill");
    draft.purpose = $("#dPurpose").value.trim(); draft.committee = $("#dCom").value;
    if (tab === "edit" && $("#ed")) draft.md = domToMd($("#ed"));
  }
  const asDoc = () => ({ ...fromDraft({ ...draft, sponsors: me }), actTitle: undefined, title: draft.actTitle, kind: draft.type === "Resolution" ? "resolution" : "bill", date: "" });
  function drawPre() {
    const d = asDoc(), pp = preambleParts(d);
    $("#pre").innerHTML = `${esc(introDate(""))}, introduced by <b>${esc(me)}</b>.<br>${pp.lead ? esc(pp.lead) + "<br>&nbsp;&nbsp;<b>" + esc(pp.title) + "</b><br>" : ""}${esc(pp.text)}`;
  }
  function drawPreview() {
    readMeta();
    $("#panePrev").innerHTML = `${billHtml(asDoc())}
      <div class="dr-foot" style="justify-content:center"><button class="btn btn-outline btn-sm" data-act="pdf">Download PDF</button></div>`;
    fitPages($("#panePrev"));
  }

  /* ------------------------------------------------------------ saving */
  const setState = (t, err) => { const s = $("#dState"); if (s) { s.textContent = t; s.classList.toggle("err", !!err); } };
  function queueSave() { dirty = true; setState("Saving…"); clearTimeout(timer); timer = setTimeout(save, 1200); }
  function save() {
    clearTimeout(timer); if (!draft || !dirty) return saving;
    readMeta(); dirty = false;
    const d = { name: draft.name, action: draft.action || "create", actTitle: draft.actTitle || "", target: draft.target || "", purpose: draft.purpose, committee: draft.committee, md: draft.md, updatedAt: serverTimestamp() };
    saving = updateDoc(doc(db, "drafts", draft.id), d).then(() => setState("Saved " + stamp())).catch(e => { console.error(e); dirty = true; setState("Couldn't save", true); });
    return saving;
  }
  const flushSave = async () => { if (draft && dirty) await save(); await saving; };
  window.addEventListener("beforeunload", () => { if (draft && dirty) save(); });

  /* ------------------------------------------------------------ editing behaviour */
  const edBlock = () => { const ed = $("#ed"), sel = getSelection(); if (!ed || !sel.rangeCount) return null; let n = sel.anchorNode; while (n && n.parentNode !== ed) n = n.parentNode; return n && n.nodeType === 1 ? n : null; };
  const isBoldAll = (block, len) => { const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT); let n, seen = 0; while ((n = w.nextNode()) && seen < len) { if (!n.parentElement.closest("b,strong")) return false; seen += n.nodeValue.length; } return true; };
  function autoBold(block) {
    if (!block || block.classList.contains("dir")) return;
    const text = block.textContent.replace(NB, " "), m = text.match(SECRE);
    if (!m) return;
    const len = m[0].length;
    if (isBoldAll(block, len)) return;
    const sel = getSelection(), caret = sel.rangeCount ? offsetIn(block, sel.anchorNode, sel.anchorOffset) : len;
    setSel(block, 0, len); document.execCommand("bold"); setSel(block, caret);
    if (caret <= len && document.queryCommandState("bold")) document.execCommand("bold");
  }
  const secNums = () => { const out = []; let scope = false; for (const b of $("#ed").children) { if (b.classList.contains("dir")) { scope = true; continue; } if (!b.textContent.trim()) { scope = false; continue; } const m = b.textContent.replace(NB, " ").match(SECRE); if (m && !scope) out.push({ b, n: m[2] }); } return out; };
  const nextSec = () => secNums().reduce((m, x) => Math.max(m, parseInt(x.n, 10) || 0), 0) + 1;
  /* Append blocks at the end of the document (replacing the placeholder line when it's empty). */
  function insertBlocks(html) {
    const ed = $("#ed"), t = document.createElement("div"); t.innerHTML = html;
    const nodes = [...t.childNodes];
    if (!ed.textContent.trim() && !ed.querySelector(".dir")) ed.innerHTML = "";
    nodes.forEach(n => ed.appendChild(n)); return nodes;
  }
  function caretToEnd(block) {
    const r = document.createRange(), sel = getSelection();
    r.selectNodeContents(block); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); $("#ed").focus();
  }
  function addSection() {
    const ed = $("#ed"), n = nextSec(), has = ed.textContent.trim() || ed.querySelector(".dir");
    const nodes = insertBlocks(`${has ? "<div><br></div>" : ""}<div><b>Sec. ${n}.</b>&nbsp;</div>`);
    caretToEnd(nodes[nodes.length - 1]); toggleEmpty(); queueSave();
  }
  function renumber() {
    let n = 0;
    for (const { b } of secNums()) {
      n++; const runs = []; collectRuns(b, { b: 0, i: 0, u: 0, s: 0 }, runs);
      let done = false;
      const fixed = runs.map(r => done ? r : { ...r, t: r.t.replace(/^(\s*Sec\.\s*)\d+[A-Za-z]*/, (m, p) => { done = true; return p + n; }) });
      b.innerHTML = withSecBold(mergeRuns(fixed)).map(runHtml).join("");
    }
    queueSave(); ctx.flash(n ? `Renumbered ${n} section${n === 1 ? "" : "s"}.` : "No sections to renumber.", n ? "ok" : "err");
  }

  /* ------------------------------------------------------------ amend an act */
  async function loadActs() {
    if (acts) return acts;
    const snap = await getDocs(collection(db, "publicActs"));
    return (acts = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => Number(a.number) - Number(b.number)));
  }
  function chapterDialog() {
    const have = [...$("#ed").querySelectorAll(".dir.ch")].map(e => parseInt(e.dataset.chapter, 10)).filter(Number.isFinite);
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal"><h3>Add a chapter</h3>
      <div class="field"><label for="cNum">Chapter number</label><input id="cNum" type="number" min="1" value="${have.length ? Math.max(...have) + 1 : 1}"></div>
      <div class="field"><label for="cTitle">Chapter title</label><input id="cTitle" maxlength="90" placeholder="e.g. Computer crimes"></div>
      <div class="hint">Shown centered and underlined in the bill, in capital letters.</div>
      <div class="form-actions"><button class="btn btn-primary" id="cGo">Insert</button><button class="btn btn-outline" id="cX">Cancel</button></div></div>`;
    document.body.appendChild(bg);
    const q = x => bg.querySelector(x); q("#cTitle").focus();
    q("#cX").onclick = () => bg.remove(); bg.addEventListener("mousedown", e => { if (e.target === bg) bg.remove(); });
    q("#cGo").onclick = () => {
      const num = q("#cNum").value.trim(); if (!num) return;
      const ed = $("#ed"), has = ed.textContent.trim() || ed.querySelector(".dir");
      const nodes = insertBlocks((has ? "<div><br></div>" : "") + chapHtml(num, q("#cTitle").value.trim()) + "<div><br></div>");
      bg.remove(); toggleEmpty(); queueSave();
      const last = nodes[nodes.length - 1]; if (last) caretToEnd(last);
    };
    bg.addEventListener("keydown", e => { if (e.key === "Enter") q("#cGo").click(); if (e.key === "Escape") bg.remove(); });
  }
  async function amendDialog() {
    const list = await loadActs();
    const bg = document.createElement("div"); bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal"><h3>Amend an existing act</h3>
      <div class="field"><label>Public act</label><select id="mAct"><option value="">Choose an act…</option>${list.map(a => `<option value="${esc(a.number)}">${esc(a.year)} PA ${esc(a.number)} — ${esc(a.title)}</option>`).join("")}</select></div>
      <div class="field"><label>What to do</label><select id="mOp"><option value="amend">Amend a section (rewrite it)</option><option value="repeal">Repeal a section</option><option value="add">Add a new section</option></select></div>
      <div class="field" id="mSecW"><label>Section</label><select id="mSec"></select></div>
      <div class="field" id="mNewW" hidden><label>New section number</label><input id="mNew" placeholder="e.g. 3a"></div>
      <div id="mNote" class="hint"></div>
      <div class="form-actions"><button class="btn btn-primary" id="mGo" disabled>Insert</button><button class="btn btn-outline" id="mX">Cancel</button></div></div>`;
    document.body.appendChild(bg);
    const q = s => bg.querySelector(s); let secs = [], actDoc = null;
    const refresh = () => {
      const op = q("#mOp").value; q("#mSecW").hidden = op === "add"; q("#mNewW").hidden = op !== "add";
      q("#mSec").innerHTML = secs.filter(s => !s.repealed).map(s => `<option value="${esc(s.n)}">Sec. ${esc(s.n)}</option>`).join("");
      q("#mGo").disabled = !actDoc || (op !== "add" && !q("#mSec").value);
    };
    q("#mAct").onchange = async () => {
      const n = q("#mAct").value; secs = []; actDoc = null; q("#mNote").textContent = ""; refresh(); if (!n) return;
      const s = await getDoc(doc(db, "documents", "act-" + n));
      if (s.exists()) { actDoc = s.data(); secs = parseAct(actDoc.md); } else q("#mNote").textContent = "This act has no digital text on file, so its sections can't be amended from here.";
      refresh();
    };
    q("#mOp").onchange = refresh; q("#mX").onclick = () => bg.remove(); bg.addEventListener("mousedown", e => { if (e.target === bg) bg.remove(); });
    q("#mGo").onclick = () => {
      const n = q("#mAct").value, op = q("#mOp").value, act = list.find(a => String(a.number) === n), name = `${actDoc.title || act.title} (${act.year} PA ${act.number})`;
      const sec = op === "add" ? q("#mNew").value.trim() : q("#mSec").value;
      if (!sec) { q("#mNote").textContent = "Enter the new section number."; return; }
      const num = nextSec(), ed = $("#ed"), has = ed.textContent.trim() || ed.querySelector(".dir");
      let html = has ? "<div><br></div>" : "";
      if (op === "amend") {
        const s = secs.find(x => x.n === sec);
        html += `<div><b>Sec. ${num}.</b>&nbsp;Section ${esc(sec)} of the ${esc(name)} is amended to read as follows:</div>${dirHtml("amend", n, sec)}${mdToHtml(cleanMd(s.lines.join("\n")))}<div><br></div>`;
      } else if (op === "repeal") html += `<div><b>Sec. ${num}.</b>&nbsp;Section ${esc(sec)} of the ${esc(name)} is repealed.</div>${dirHtml("repeal", n, sec)}<div><br></div>`;
      else html += `<div><b>Sec. ${num}.</b>&nbsp;The ${esc(name)} is amended by adding section ${esc(sec)} to read as follows:</div>${dirHtml("add", n, sec)}<div><b>Sec. ${esc(sec)}.</b>&nbsp;</div><div><br></div>`;
      const nodes = insertBlocks(html);
      bg.remove(); toggleEmpty(); queueSave();
      const target = [...nodes].reverse().find(x => x.textContent.trim() && !x.classList.contains("dir")); if (target) caretToEnd(target);
      if (document.querySelector("#dAction") && $("#dAction").value === "create" && !$("#dTitle").value) { $("#dAction").value = "amend"; syncFields(); }
    };
  }

  /* ------------------------------------------------------------ submit */
  async function submit(btn) {
    await flushSave(); readMeta();
    const lines = blocks(draft.md), hasSec = lines.some(b => b.k === "p" && b.sec);
    if (!hasSec) return ctx.flash("Add at least one numbered section (use + Section).", "err");
    if (draft.type !== "Resolution") {
      if (draft.action === "create" && !draft.actTitle) return ctx.flash("Enter the title of the new act in the details panel.", "err");
      if (draft.action !== "create" && !draft.target) return ctx.flash("Enter the act being amended or repealed in the details panel.", "err");
    }
    if (!draft.purpose) return ctx.flash("Add a purpose so the bill has a description.", "err");
    if (!confirm(draft.substituteFor ? `Publish this as ${draft.vtype === "amended" ? "an amended version" : "a substitute"} of Bill No. ${draft.substituteFor}?` : "Submit this for introduction? You won't be able to edit the submitted copy.")) return;
    btn.disabled = true;
    try {
      if (draft.substituteFor) await publishSubstitute();
      else {
        await addDoc(collection(db, "proposals"), {
          type: draft.type, title: draft.name, actTitle: draft.actTitle || "", action: draft.action || "create", target: draft.target || "", purpose: draft.purpose,
          description: draft.purpose, committee: draft.committee || "", md: draft.md, sponsorUid: uid, sponsorName: me, status: "Pending", createdAt: serverTimestamp()
        });
        await deleteDoc(doc(db, "drafts", draft.id));
      }
      const msg = draft.substituteFor ? (draft.vtype === "amended" ? "Amended version published." : "Substitute published.") : "Submitted. The Clerk's office will review it.";
      draft = null; dirty = false; await showList(); ctx.flash(msg);
    } catch (e) { console.error(e); btn.disabled = false; ctx.flash("Couldn't submit: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); }
  }
  async function publishSubstitute() {
    const n = draft.substituteFor, ref = `bill-${n}`, bref = doc(db, "bills", String(n));
    const [bs, ds] = await Promise.all([getDoc(bref), getDocs(query(collection(db, "documents"), where("ref", "==", ref)))]);
    if (!bs.exists()) throw new Error("Bill not found.");
    const am = draft.vtype === "amended", ty = am ? "amended" : "substitute", b = bs.data(), seq = ds.docs.filter(d => ["substitute", "amended"].includes(d.data().type)).length + 1,
      k = ds.docs.filter(d => d.data().type === ty).length + 1, label = am ? `Amended (A-${k})` : `Substitute (S-${k})`, id = `${ref}-${am ? "a" : "s"}${k}`;
    const batch = writeBatch(db);
    batch.set(doc(db, "documents", id), { ref, type: ty, kind: "bill", sub: seq, label, number: Number(n), title: draft.actTitle || "", action: draft.action || "create", target: draft.target || "", purpose: draft.purpose,
      sponsors: b.sponsors || "", committee: b.committee || "", date: todayISO(), md: draft.md, createdBy: me, updatedAt: serverTimestamp() });
    batch.update(bref, { docLinks: [...(b.docLinks || []).filter(l => l.id !== id), { label, id }], history: [...(b.history || []), `${label} ${am ? "adopted" : "offered"} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`], updatedAt: serverTimestamp(), updatedBy: me });
    batch.delete(doc(db, "drafts", draft.id));
    await batch.commit();
  }

  /* ------------------------------------------------------------ events */
  root.addEventListener("input", e => {
    if (!draft) return;
    if (e.target.id === "ed") { if (!(e.inputType || "").startsWith("history")) autoBold(edBlock()); toggleEmpty(); queueSave(); }
    else if (/^(dName|dAction|dTitle|dTarget|dPurpose|dCom)$/.test(e.target.id)) { if (e.target.id === "dName") nameTouched = true; syncFields(); readMeta(); drawPre(); queueSave(); }
  });
  root.addEventListener("change", e => { if (draft && /^(dAction|dCom)$/.test(e.target.id)) { syncFields(); readMeta(); drawPre(); queueSave(); } });
  root.addEventListener("mousedown", e => { if (e.target.closest("#tool button")) e.preventDefault(); });
  root.addEventListener("click", e => {
    const x = e.target.closest(".dir i"); if (x) { x.parentElement.remove(); toggleEmpty(); queueSave(); return; }
    const c = e.target.closest("[data-cmd]"); if (c) { $("#ed").focus(); document.execCommand(c.dataset.cmd); queueSave(); }
  });
  root.addEventListener("keydown", e => {
    if (e.target.id !== "ed") return;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "x") { e.preventDefault(); document.execCommand("strikeThrough"); queueSave(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  });
  root.addEventListener("paste", e => {
    if (e.target.id !== "ed") return; e.preventDefault();
    const html = e.clipboardData.getData("text/html"), text = e.clipboardData.getData("text/plain");
    const isMd = /\*\*|~~|<u>/.test(text);
    const lines = isMd ? carryMarks(text).split("\n").map(l => parseInline(l.replace(/\s+$/, ""))) : html ? linesFromHtml(html) : text.split(/\r?\n/).map(l => [{ t: clean(l), b: 0, i: 0, u: 0, s: 0 }]);
    const out = lines.map(l => `<div>${l.length ? withSecBold(l).map(runHtml).join("") : "<br>"}</div>`);
    document.execCommand("insertHTML", false, out.length === 1 ? out[0].replace(/^<div>|<\/div>$/g, "") : out.join(""));
  });
  document.addEventListener("selectionchange", () => {
    if (!draft || tab !== "edit") return; const t = $("#tool"); if (!t) return;
    for (const b of t.querySelectorAll("[data-cmd]")) { let on = false; try { on = document.queryCommandState(b.dataset.cmd); } catch {} b.classList.toggle("on", on && !/undo|redo/.test(b.dataset.cmd)); }
  });

  ctx.on({
    newBill: () => newDraft("Bill"), newRes: () => newDraft("Resolution"),
    openDraft: b => openDraft(b.dataset.id),
    async delDraft(b) { if (!confirm("Delete this draft permanently?")) return; await deleteDoc(doc(db, "drafts", b.dataset.id)); showList(); },
    toList: () => showList(),
    tab(b) { readMeta(); tab = b.dataset.t; root.querySelectorAll(".dr-tabs button").forEach(x => x.classList.toggle("on", x === b)); $("#paneEdit").hidden = tab !== "edit"; $("#panePrev").hidden = tab !== "preview"; $("#tool").style.visibility = tab === "edit" ? "" : "hidden"; if (tab === "preview") drawPreview(); },
    addSec: addSection, addChap: chapterDialog, renumber, amendDlg: amendDialog, submit,
    async pdf() {
      if (!window.jspdf) { try { await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); } catch { return ctx.flash("Couldn't load the PDF library.", "err"); } }
      billPdf(window.jspdf.jsPDF, asDoc()).save(`${draft.name || "Draft"}.pdf`);
    }
  });

  /* ------------------------------------------------------------ start */
  const q = new URLSearchParams(location.search), subN = q.get("substitute") || q.get("amended"), vtype = q.get("amended") ? "amended" : "substitute", h = decodeURIComponent(location.hash.slice(1));
  if (subN && ctx.isAdmin) {
    try {
      const ds = await getDocs(query(collection(db, "documents"), where("ref", "==", `bill-${subN}`)));
      const vs = ds.docs.map(d => d.data()).filter(d => d.type === "introduced" || d.type === "substitute" || d.type === "amended").sort((a, b) => (a.sub || 0) - (b.sub || 0));
      const base = vs[vs.length - 1];
      if (base) { history.replaceState(null, "", location.pathname); return newDraft("Bill", { name: `${vtype === "amended" ? "Amended version of" : "Substitute for"} Bill No. ${subN}`, substituteFor: Number(subN), vtype, action: base.action || "create", actTitle: base.title || "", target: base.target || "", purpose: base.purpose || "", committee: base.committee || "", md: base.md || "" }); }
      ctx.flash(`Bill No. ${subN} has no digital text to build a new version from.`, "err");
    } catch (e) { console.error(e); ctx.flash("Couldn't start the substitute.", "err"); }
  }
  if (h) return openDraft(h);
  await showList();
}
