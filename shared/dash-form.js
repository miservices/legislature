/* Schema-driven form builder. Every record editor in the dashboard is described by a list of fields.
   Field types: text number date time url textarea select | list (repeating rows) | refs (pick records)
   | tags / people (free-text chips) . Options: req, full, rows, default, auto ('number'|'order'), showIf, from, single. */
import { esc, asList, safeUrl } from "./util.js";
import { repeater, chipPicker, todayISO } from "./dash-ui.js";
import { load, nextNumber, nextOrder, legislatorOptions } from "./dash-data.js";

const plain = f => f.label.replace(/\s*\(.*\)/, "");

/* Load whatever the fields need (lookup collections, legislators) before the form is drawn. */
export async function prepare(fields, rows = []) {
  const env = { rows, look: {}, people: [] };
  const colls = [...new Set(fields.filter(f => f.from).map(f => f.from))];
  await Promise.all(colls.map(async c => { env.look[c] = await load(c); }));
  if (fields.some(f => f.type === "people")) env.people = await legislatorOptions();
  return env;
}

function optionsFor(f, env) {
  if (f.type === "people") return env.people;
  if (!f.from) return f.options ? f.options.map(o => ({ value: o, label: o })) : [];
  const seen = new Set();
  return (env.look[f.from] || []).map(r => f.option(r)).filter(o => o && o.value !== "" && !seen.has(o.value) && seen.add(o.value));
}

function initial(f, item, env, seed) {
  if (item && item[f.key] != null) return item[f.key];
  if (!item && seed && seed[f.key] != null) return seed[f.key];
  if (item) return f.type === "list" || f.type === "refs" ? [] : "";
  if (f.auto === "number") return nextNumber(env.rows);
  if (f.auto === "order") return nextOrder(env.rows);
  if (f.default === "today") return todayISO();
  return typeof f.default === "function" ? f.default(env) : (f.default ?? (f.type === "list" || f.type === "refs" ? [] : ""));
}

export function buildForm(fields, item, env, { lockKey, seed } = {}) {
  const widgets = {};
  const html = fields.map(f => {
    const id = "f_" + f.key, v = initial(f, item, env, seed), locked = item && lockKey === f.key;
    let el;
    switch (f.type) {
      case "textarea": el = `<textarea id="${id}" rows="${f.rows || 4}">${esc(v)}</textarea>`; break;
      case "select": el = `<select id="${id}"><option value="">—</option>${f.options.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`; break;
      case "list": case "refs": case "tags": case "people": el = `<div id="${id}" class="widget"></div>`; break;
      default: el = `<input id="${id}" type="${f.type || "text"}" value="${esc(v)}" ${locked ? "disabled" : ""} ${f.type === "number" ? 'step="any"' : ""}>`;
    }
    return `<div class="field" data-field="${f.key}" ${f.full ? 'style="grid-column:1/-1"' : ""}><label for="${id}">${esc(f.label)}${f.req ? " *" : ""}</label>${el}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ""}</div>`;
  }).join("");

  function init(root) {
    for (const f of fields) {
      const host = root.querySelector(`#f_${f.key}`), v = initial(f, item, env, seed);
      if (f.type === "list") widgets[f.key] = repeater(host, { values: asList(v), type: f.itemType === "url" ? "url" : "text", placeholder: f.placeholder || (f.itemType === "url" ? "https://…" : "") });
      else if (f.type === "refs") widgets[f.key] = chipPicker(host, { options: optionsFor(f, env), values: f.single ? String(v ?? "") : asList(v).map(String), single: !!f.single, allowFree: !!f.free, placeholder: f.placeholder || "Type to search…", onChange: f.onPick && (val => f.onPick(val, root, env)) });
      else if (f.type === "tags" || f.type === "people") widgets[f.key] = chipPicker(host, { options: optionsFor(f, env), values: asList(typeof v === "string" ? v.split(",") : v), allowFree: true, placeholder: f.placeholder || (f.type === "people" ? "Type a name…" : "Type and press Enter…") });
    }
    const applyShow = () => {
      for (const f of fields) if (f.showIf) {
        const src = root.querySelector(`#f_${f.showIf.key}`), on = src && f.showIf.in.includes(src.value);
        root.querySelector(`[data-field="${f.key}"]`).style.display = on ? "" : "none";
      }
    };
    root.addEventListener("change", applyShow); applyShow();
  }

  function collect(root) {
    const data = {}, errs = [];
    for (const f of fields) {
      const wrap = root.querySelector(`[data-field="${f.key}"]`), hidden = wrap.style.display === "none";
      let v;
      if (widgets[f.key]) {
        v = widgets[f.key].get();
        if (f.cast === "number") v = Array.isArray(v) ? v.map(Number) : (v === "" ? null : Number(v));
        if (f.type === "list" && f.itemType === "url" && v.some(u => !safeUrl(u))) errs.push(`${plain(f)}: every link must be a valid URL.`);
        if (((f.type === "tags" || f.type === "people") && f.asString !== false) || (f.type === "refs" && f.asString)) v = v.join(", ");
      } else {
        const el = root.querySelector(`#f_${f.key}`); v = el.value.trim();
        if (f.type === "number") { v = v === "" ? null : Number(v); if (v !== null && isNaN(v)) errs.push(`${plain(f)} must be a number.`); }
        else if (f.type === "url" && v && !safeUrl(v)) errs.push(`${plain(f)} must be a valid link.`);
      }
      const empty = v === "" || v === null || (Array.isArray(v) && !v.length);
      if (f.req && empty && !hidden) errs.push(`${plain(f)} is required.`);
      data[f.key] = hidden ? (f.type === "list" || f.type === "refs" ? [] : "") : v;
    }
    return { data, errs };
  }
  return { html, init, collect };
}