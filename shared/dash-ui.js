/* Small reusable inputs for the dashboard: a repeater (add/remove rows) and a searchable chip picker.
   They replace "one per line" textareas and typed-in cross references. */
import { esc } from "./util.js";

export const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const longDate = iso => { const d = new Date(String(iso).slice(0, 10) + "T12:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/* Rows of text/url inputs. Enter adds a row, pasting several lines splits them into rows. */
export function repeater(host, { values = [], placeholder = "", type = "text" } = {}) {
  host.classList.add("rep");
  const row = v => `<div class="rep-row"><input type="${type}" value="${esc(v)}" placeholder="${esc(placeholder)}"><button type="button" class="rep-x" data-rm aria-label="Remove">&times;</button></div>`;
  host.innerHTML = `<div class="rep-rows">${(values.length ? values : [""]).map(row).join("")}</div><button type="button" class="btn btn-outline btn-sm" data-add>+ Add</button>`;
  const rows = host.querySelector(".rep-rows");
  const addRow = (v = "", after) => {
    const t = document.createElement("div"); t.innerHTML = row(v);
    const el = t.firstChild; after ? after.after(el) : rows.append(el); el.querySelector("input").focus(); return el;
  };
  host.addEventListener("click", e => {
    if (e.target.closest("[data-add]")) addRow();
    const rm = e.target.closest("[data-rm]");
    if (rm) { const r = rm.closest(".rep-row"); if (rows.children.length > 1) r.remove(); else r.querySelector("input").value = ""; }
  });
  host.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.matches(".rep-row input")) { e.preventDefault(); addRow("", e.target.closest(".rep-row")); }
  });
  host.addEventListener("paste", e => {
    const t = (e.clipboardData && e.clipboardData.getData("text")) || "";
    if (!/\r?\n/.test(t) || !e.target.matches(".rep-row input")) return;
    e.preventDefault();
    let cur = e.target.closest(".rep-row");
    t.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach((s, i) => {
      if (i === 0 && !e.target.value) { e.target.value = s; } else cur = addRow(s, cur);
    });
  });
  return { get: () => [...rows.querySelectorAll("input")].map(i => i.value.trim()).filter(Boolean) };
}

/* Searchable picker that shows picks as chips.
   options: [{ value, label, sub? }]. allowFree lets the user add text that isn't an option. single keeps one value. */
export function chipPicker(host, { options = [], values = [], allowFree = false, single = false, placeholder = "Type to search…", onChange } = {}) {
  let sel = Array.isArray(values) ? values.map(String).filter(Boolean) : values ? [String(values)] : [];
  if (single) sel = sel.slice(0, 1);
  const label = v => (options.find(o => o.value === v) || {}).label || v;
  host.classList.add("pk");
  host.innerHTML = `<div class="pk-box"><span class="pk-chips"></span><input class="pk-in" autocomplete="off"></div><div class="pk-menu" hidden></div>`;
  const chips = host.querySelector(".pk-chips"), input = host.querySelector(".pk-in"), menu = host.querySelector(".pk-menu");
  let matches = [], hi = 0, free = "";

  const drawChips = () => {
    chips.innerHTML = sel.map((v, i) => `<span class="pk-chip">${esc(label(v))}<button type="button" data-rm="${i}" aria-label="Remove">&times;</button></span>`).join("");
    input.style.display = single && sel.length ? "none" : "";
    input.placeholder = sel.length ? "" : placeholder;
  };
  const drawMenu = () => {
    const q = input.value.trim().toLowerCase();
    matches = options.filter(o => !sel.includes(o.value) && (!q || (o.label + " " + (o.sub || "")).toLowerCase().includes(q))).slice(0, 8);
    hi = Math.min(hi, Math.max(matches.length - 1, 0));
    free = allowFree && q && !sel.some(s => s.toLowerCase() === q) && !options.some(o => o.label.toLowerCase() === q) ? input.value.trim() : "";
    menu.innerHTML = matches.map((o, i) => `<div class="pk-item ${i === hi ? "hi" : ""}" data-i="${i}">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</div>`).join("")
      + (free ? `<div class="pk-item ${matches.length ? "" : "hi"}" data-free>Add “${esc(free)}”</div>` : "");
    menu.hidden = !menu.innerHTML;
  };
  const notify = () => onChange && onChange(single ? (sel[0] || "") : sel.slice());
  const add = v => {
    if (!v || sel.includes(v)) return;
    sel = single ? [v] : [...sel, v]; input.value = ""; drawChips(); menu.hidden = true; notify();
  };
  const remove = i => { sel.splice(i, 1); drawChips(); notify(); if (single) input.focus(); };

  input.addEventListener("input", () => { hi = 0; drawMenu(); });
  input.addEventListener("focus", drawMenu);
  input.addEventListener("blur", () => setTimeout(() => { menu.hidden = true; if (allowFree && input.value.trim()) add(input.value.trim()); }, 120));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hi + 1, matches.length - 1); drawMenu(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); hi = Math.max(hi - 1, 0); drawMenu(); }
    else if (e.key === "Enter" || (e.key === "," && allowFree)) {
      e.preventDefault();
      if (matches[hi] && (e.key === "Enter")) add(matches[hi].value);
      else if (free || input.value.trim()) add(free || input.value.trim());
    } else if (e.key === "Backspace" && !input.value && sel.length) remove(sel.length - 1);
  });
  menu.addEventListener("mousedown", e => {
    e.preventDefault();
    const it = e.target.closest(".pk-item"); if (!it) return;
    if (it.hasAttribute("data-free")) add(free); else add(matches[+it.dataset.i].value);
  });
  chips.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) remove(+b.dataset.rm); });
  host.querySelector(".pk-box").addEventListener("click", () => input.focus());
  drawChips();
  return {
    get: () => single ? (sel[0] || "") : sel.slice(),
    set(v) { sel = Array.isArray(v) ? v.map(String) : v ? [String(v)] : []; drawChips(); }
  };
}