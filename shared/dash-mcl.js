/* Dashboard › Michigan Compiled Laws. Chapters and sections in one place: browse chapters, open one to see
   its sections, search across everything, and record a Public Act amendment without hand-writing history. */
import { db, doc, writeBatch, deleteDoc } from "./fb.js";
import { esc, natCompare } from "./util.js";
import { longDate } from "./dash-ui.js";
import { load, invalidate, stamp, appendHistory } from "./dash-data.js";
import { prepare, buildForm } from "./dash-form.js";

const CH_FIELDS = [
  { key: "cite", label: "Chapter number (or article number)", req: true },
  { key: "title", label: "Title", req: true, full: true },
  { key: "kind", label: "Kind", type: "select", options: ["chapter", "constitution"], req: true, default: "chapter" },
  { key: "article", label: "Article numeral (e.g. IV)", showIf: { key: "kind", in: ["constitution"] } }
];

export async function mountMcl(ctx) {
  const who = ctx.acct.name;
  let chapters = [], sections = [], chapter = "", form = null, editing = null, q = "";

  const secNum = c => String(c).split(".").slice(1).join(".");
  const nextSec = ch => {
    const n = sections.filter(s => s.chapter === ch).map(s => parseInt(secNum(s.cite), 10)).filter(Number.isFinite);
    return n.length ? String(Math.max(...n) + 1) : "1";
  };
  const chOf = c => chapters.find(x => x.cite === c);
  const chLabel = c => { const x = chOf(c); return x ? `${x.kind === "constitution" ? "Article " + (x.article || x.cite) : "Chapter " + x.cite} — ${x.title}` : `Chapter ${c}`; };

  async function reload() {
    chapters = (await load("mclChapters", true)).slice().sort((a, b) => natCompare(a.cite, b.cite));
    sections = (await load("mclSections", true)).map(s => ({ ...s, chapter: String(s.chapter || String(s.cite).split(".")[0]) })).sort((a, b) => natCompare(a.cite, b.cite));
  }

  /* ---------------------------------------------------------------- browse */
  function browse() {
    editing = null;
    const ch = chapter && chOf(chapter);
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><h2>Michigan Compiled Laws</h2>
        <input id="q" placeholder="Search chapters and sections…" value="${esc(q)}">
        <button class="btn btn-outline btn-sm" data-act="newChapter">+ Chapter</button>
        <button class="btn btn-gold btn-sm" data-act="newSection">+ Section</button></div>
      <div class="crumbs"><a data-act="goAll">All chapters</a>${ch ? ` &rsaquo; <b>${esc(chLabel(chapter))}</b> <a data-act="editChapter" class="small">Edit chapter</a>` : ""}</div>
      <div id="list"></div></div>`;
    document.getElementById("q").addEventListener("input", e => { q = e.target.value; drawList(); });
    drawList();
  }
  function drawList() {
    const el = document.getElementById("list"), ql = q.trim().toLowerCase();
    if (ql) {
      const cm = chapters.filter(c => (c.cite + " " + c.title).toLowerCase().includes(ql));
      const sm = sections.filter(s => (s.cite + " " + s.title + " " + (s.text || "")).toLowerCase().includes(ql)).slice(0, 100);
      el.innerHTML = (cm.length ? `<div class="section-head">Chapters</div>${chTable(cm)}` : "") + (sm.length ? `<div class="section-head">Sections</div>${secTable(sm)}` : "") || '<div class="empty-state" style="padding:1rem 0">Nothing matched.</div>';
    } else if (chapter) {
      const sm = sections.filter(s => s.chapter === chapter);
      el.innerHTML = sm.length ? secTable(sm) : '<div class="empty-state" style="padding:1rem 0">No sections in this chapter yet. Use “+ Section”.</div>';
    } else {
      el.innerHTML = chapters.length ? chTable(chapters) : '<div class="empty-state" style="padding:1rem 0">No chapters yet. Use “+ Chapter”.</div>';
    }
  }
  const chTable = list => `<table class="tbl click"><thead><tr><th>Chapter</th><th>Title</th><th>Sections</th></tr></thead><tbody>${list.map(c =>
    `<tr data-act="openChapter" data-c="${esc(c.cite)}"><td>${esc(c.kind === "constitution" ? "Art. " + (c.article || c.cite) : c.cite)}</td><td>${esc(c.title)}</td><td>${sections.filter(s => s.chapter === c.cite).length}</td></tr>`).join("")}</tbody></table>`;
  const secTable = list => `<table class="tbl click"><thead><tr><th>Section</th><th>Title</th></tr></thead><tbody>${list.map(s =>
    `<tr data-act="editSection" data-id="${esc(s._id)}"><td class="mono">${esc(s.cite)}</td><td>${esc(s.title)}</td></tr>`).join("")}</tbody></table>`;

  /* ---------------------------------------------------------------- chapter form */
  async function chapterForm(item) {
    editing = { type: "chapter", id: item ? item._id : null };
    form = buildForm(CH_FIELDS, item, await prepare(CH_FIELDS), { lockKey: "cite" });
    const n = item ? sections.filter(s => s.chapter === item.cite).length : 0;
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; Back</button><h2>${item ? "Edit" : "New"} chapter</h2></div>
      <div id="f" class="grid2">${form.html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="saveChapter">Save</button>
        ${item ? `<button class="btn btn-danger" data-act="deleteChapter" style="margin-left:auto" ${n ? "disabled title='Remove its sections first'" : ""}>Delete chapter</button>` : ""}</div></div>`;
    form.init(document.getElementById("f"));
  }

  /* ---------------------------------------------------------------- section form */
  async function sectionForm(item) {
    editing = { type: "section", id: item ? item._id : null, item };
    const fields = [
      ...(item ? [] : [
        { key: "chapter", label: "Chapter", type: "refs", single: true, from: "mclChapters", req: true, option: c => ({ value: c.cite, label: chLabel(c.cite) }), full: true, placeholder: "Pick a chapter…" },
        { key: "num", label: "Section number", req: true, default: () => nextSec(chapter), hint: "Filled in with the next free number in the chapter." }
      ]),
      { key: "title", label: "Title", req: true, full: !!item },
      { key: "text", label: "Text (indent subsections with (a), (i), 1) …)", type: "textarea", rows: 14, full: true },
      { key: "history", label: "History", type: "textarea", rows: 2, full: true, hint: "Added to automatically when you record an amendment below." }
    ];
    form = buildForm(fields, item || null, await prepare(fields), { seed: { chapter } });
    const allActs = item ? await load("publicActs") : [];
    const acts = allActs.filter(a => item && (a.amends || []).includes(item.cite)).sort((a, b) => b.number - a.number);
    ctx.panel.innerHTML = `<div class="card"><div class="bar"><button class="btn btn-outline btn-sm" data-act="back">&larr; Back</button><h2>${item ? "MCL " + esc(item.cite) : "New section"}</h2></div>
      <div id="f" class="grid2">${form.html}</div>
      <div class="form-actions"><button class="btn btn-primary" data-act="saveSection">Save</button>
        ${item ? '<button class="btn btn-danger" data-act="deleteSection" style="margin-left:auto">Delete section</button>' : ""}</div></div>
      ${item ? `<div class="card"><h2>Amended by</h2>
        ${acts.length ? `<ul class="plain">${acts.map(a => `<li><a href="../../public-acts/#${esc(a.number)}" target="_blank" rel="noopener">${esc(a.year)} PA ${esc(a.number)}</a> — ${esc(a.title)}</li>`).join("")}</ul>` : '<p class="lead">No public acts amend this section yet.</p>'}
        <div class="inline-add"><select id="amendPa"><option value="">Record an amendment by public act…</option>${allActs.filter(a => !(a.amends || []).includes(item.cite)).sort((a, b) => b.number - a.number).map(a => `<option value="${esc(a._id)}">${esc(a.year)} PA ${esc(a.number)} — ${esc(a.title)}</option>`).join("")}</select>
          <button class="btn btn-outline btn-sm" data-act="recordAmend">Record</button></div>
        <p class="lead" style="margin:.6rem 0 0;font-size:12.5px">This adds the citation to the section’s history and links the act to this section.</p></div>` : ""}`;
    form.init(document.getElementById("f"));
  }

  const guard = fn => async b => { if (b) b.disabled = true; try { await fn(b); } catch (e) { console.error(e); if (b) b.disabled = false; ctx.flash("Couldn't save: " + (e.code === "permission-denied" ? "you don't have permission." : e.message), "err"); } };

  ctx.on({
    goAll() { chapter = ""; q = ""; browse(); },
    back() { browse(); },
    openChapter(b) { chapter = b.dataset.c; q = ""; browse(); },
    newChapter: () => chapterForm(null),
    editChapter: () => chapterForm(chOf(chapter)),
    newSection: () => sectionForm(null),
    editSection(b) { return sectionForm(sections.find(s => s._id === b.dataset.id)); },

    saveChapter: guard(async b => {
      const { data, errs } = form.collect(document.getElementById("f"));
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      const id = editing.id || String(data.cite).trim().replace(/\//g, "-");
      if (!editing.id && chOf(data.cite)) { b.disabled = false; return ctx.flash("That chapter already exists.", "err"); }
      const batch = writeBatch(db); batch.set(doc(db, "mclChapters", id), { ...data, ...stamp(who) }); await batch.commit();
      invalidate("mclChapters"); await reload(); chapter = data.cite; browse(); ctx.flash("Chapter saved.");
    }),
    deleteChapter: guard(async () => {
      if (!confirm("Delete this chapter?")) return;
      await deleteDoc(doc(db, "mclChapters", editing.id)); invalidate("mclChapters"); await reload(); chapter = ""; browse(); ctx.flash("Chapter deleted.");
    }),
    saveSection: guard(async b => {
      const { data, errs } = form.collect(document.getElementById("f"));
      if (errs.length) { b.disabled = false; return ctx.flash(errs[0], "err"); }
      const cite = editing.item ? editing.item.cite : `${data.chapter}.${String(data.num).trim()}`;
      if (!editing.item && sections.some(s => s.cite === cite)) { b.disabled = false; return ctx.flash(`MCL ${cite} already exists.`, "err"); }
      const rec = { cite, chapter: editing.item ? editing.item.chapter : String(data.chapter), title: data.title, text: data.text, history: data.history };
      const batch = writeBatch(db); batch.set(doc(db, "mclSections", cite.replace(/\//g, "-")), { ...rec, ...stamp(who) }); await batch.commit();
      invalidate("mclSections"); await reload(); chapter = rec.chapter; browse(); ctx.flash(`MCL ${cite} saved.`);
    }),
    deleteSection: guard(async () => {
      if (!confirm(`Delete MCL ${editing.item.cite} permanently?`)) return;
      await deleteDoc(doc(db, "mclSections", editing.id)); invalidate("mclSections"); await reload(); browse(); ctx.flash("Section deleted.");
    }),
    recordAmend: guard(async b => {
      const pid = document.getElementById("amendPa").value;
      if (!pid) { b.disabled = false; return ctx.flash("Pick a public act first.", "err"); }
      const act = (await load("publicActs")).find(a => a._id === pid), s = editing.item, cite = `${act.year} PA ${act.number}`;
      const batch = writeBatch(db);
      batch.update(doc(db, "mclSections", s._id), { history: appendHistory(s.history, `${cite}${act.effectiveDate ? ", Eff. " + longDate(act.effectiveDate) : ""}.`), ...stamp(who) });
      batch.update(doc(db, "publicActs", act._id), { amends: [...(act.amends || []), s.cite], ...stamp(who) });
      await batch.commit(); invalidate("mclSections", "publicActs"); await reload();
      await sectionForm(sections.find(x => x._id === s._id)); ctx.flash(`Recorded ${cite}.`);
    })
  });

  await reload();
  browse();
}