/* Dashboard shell: sign-in, access checks, navigation and layout shared by every dashboard page.
   Each page calls startDash({ page, render }) and only has to draw its own panel. */
import {
  auth, db, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  doc, getDoc, setDoc, updateDoc, serverTimestamp, PUBLIC_ROLE, ROLES, ADMIN_ROLES
} from "./fb.js";
import { mountShell } from "./shell.js";
import { esc } from "./util.js";

const MIGOVT_LOGIN_URL = "https://migovt.org/login/";
const SITE_NAME = "Michigan Legislature Dashboard";
const BASE = new URL("../dashboard/", import.meta.url).href;   // absolute URL of /dashboard/

/* Every dashboard page. slug = folder under /dashboard/. admin = Speaker / Deputy / Pro Tem / Clerk only.
   coll = the Firestore collection a record-editor page manages. */
export const PAGES = {
  overview:  { slug: "",            label: "Overview",        title: "Dashboard", group: "Dashboard", sub: "Your account and committee assignments." },
  proposals: { slug: "proposals/",  label: "My proposals",    group: "Dashboard", sub: "Submit bills and resolutions as Google Drive links." },
  review:    { slug: "review/",     label: "Review proposals", group: "Dashboard", admin: true, sub: "Introduce or reject proposals from legislators." },

  bills:        { slug: "bills/",        label: "Bills",          group: "Official record", admin: true, coll: "bills", sub: "Create and edit bills." },
  resolutions:  { slug: "resolutions/",  label: "Resolutions",    group: "Official record", admin: true, coll: "resolutions", sub: "Create and edit resolutions." },
  publicActs:   { slug: "public-acts/",  label: "Public Acts",    group: "Official record", admin: true, coll: "publicActs", sub: "Create and edit public acts." },
  mclChapters:  { slug: "mcl-chapters/", label: "MCL chapters",   group: "Official record", admin: true, coll: "mclChapters", sub: "Chapters and constitution articles of the Michigan Compiled Laws." },
  mclSections:  { slug: "mcl-sections/", label: "MCL sections",   group: "Official record", admin: true, coll: "mclSections", sub: "Individual sections of the Michigan Compiled Laws." },
  macRules:     { slug: "mac/",          label: "Administrative Code", group: "Official record", admin: true, coll: "macRules", sub: "Rules in the Michigan Administrative Code." },
  executiveOrders: { slug: "executive-orders/", label: "Executive Orders", group: "Official record", admin: true, coll: "executiveOrders", sub: "Create and edit executive orders." },
  execReorgOrders: { slug: "executive-reorganization-orders/", label: "Reorganization Orders", group: "Official record", admin: true, coll: "execReorgOrders", sub: "Create and edit executive reorganization orders." },
  journals:     { slug: "journals/",     label: "Journals",       group: "Official record", admin: true, coll: "journals", sub: "Create and edit journals." },
  calendar:     { slug: "calendar/",     label: "Calendar",       group: "Official record", admin: true, coll: "calendarEvents", sub: "Floor sessions, hearings and committee meetings." }
};

export const isAdminRole = role => ADMIN_ROLES.includes(role);

export async function startDash({ page, render }) {
  const entry = PAGES[page];
  mountShell({ eyebrow: "Legislature dashboard", title: entry.title || entry.label, sub: entry.sub || "", filters: false, card: false });
  const root = document.getElementById("content");
  let acct = null, uid = null, signingIn = false;
  const view = html => { root.innerHTML = html; };

  const ctx = {
    page: entry, label: entry.label,
    get acct() { return acct; }, get uid() { return uid; },
    get isAdmin() { return isAdminRole(acct && acct.role); },
    get panel() { return document.getElementById("panel"); },
    flash(msg, type = "ok") {
      const p = ctx.panel, old = p.querySelector(".flash"); if (old) old.remove();
      p.insertAdjacentHTML("afterbegin", `<div class="msg ${type} flash">${esc(msg)}</div>`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    /* Click delegation for the page's own [data-act] buttons. */
    on(handlers) {
      ctx.panel.addEventListener("click", e => {
        const b = e.target.closest("[data-act]");
        if (b && handlers[b.dataset.act]) handlers[b.dataset.act](b);
      });
    }
  };

  const loading = msg => view(`<div class="card signin-card"><div class="skel" style="height:14px;width:60%;margin-bottom:10px"></div><p class="lead" style="margin:0">${esc(msg)}</p></div>`);

  function renderSignIn(error) {
    view(`<div class="card signin-card">
      <h2>Sign in</h2>
      <p class="lead">The dashboard uses your MiGOVT account to confirm who you are. You'll go to MiGOVT to sign in, then come right back here.</p>
      ${error ? `<div class="msg err">${esc(error)}</div>` : ""}
      <button class="btn btn-primary" style="width:100%" data-act="signin">Sign in with MiGOVT</button>
      <p class="lead" style="margin:1rem 0 0;font-size:12.5px">New here? Signing in creates your account automatically.</p>
    </div>`);
  }

  function renderNoAccess() {
    view(`<div class="card signin-card">
      <h2>You can't access the dashboard</h2>
      <p class="lead">Your account (<strong>${esc(acct.name)}</strong>) is a ${esc(acct.role || PUBLIC_ROLE)} account. The dashboard is only for legislature staff.</p>
      <div class="msg info">If you think you should have access, contact the Clerk of the Legislature.</div>
      <button class="btn btn-outline" data-act="signout">Sign out</button>
    </div>`);
  }

  function renderDash() {
    const admin = ctx.isAdmin, groups = {};
    Object.entries(PAGES).filter(([, p]) => !p.admin || admin).forEach(([k, p]) => (groups[p.group] ||= []).push([k, p]));
    view(`<div class="dash">
      <nav class="dnav">
        ${Object.entries(groups).map(([g, items]) => `<div class="grp">${esc(g)}</div>${items.map(([k, p]) =>
          `<a href="${BASE + p.slug}" class="${k === page ? "on" : ""}">${esc(p.label)}</a>`).join("")}`).join("")}
        <a data-act="signout" style="color:#a32d2d">Sign out</a>
      </nav>
      <div id="panel"></div>
    </div>`);
    if (entry.admin && !admin) {
      ctx.panel.innerHTML = `<div class="card"><h2>No permission</h2><p class="lead" style="margin:0">This page is only for the Speaker, Deputy Speaker, Speaker Pro Tempore and Clerk of the Legislature.</p></div>`;
      return;
    }
    Promise.resolve(render(ctx)).catch(e => { console.error(e); ctx.panel.innerHTML = '<div class="msg err">Something went wrong loading this page.</div>'; });
  }

  const actions = {
    signin() { location.href = MIGOVT_LOGIN_URL + "?redirect_uri=" + encodeURIComponent(location.href.split("?")[0].split("#")[0]) + "&site_name=" + encodeURIComponent(SITE_NAME); },
    async signout() { await signOut(auth); acct = null; uid = null; renderSignIn(); }
  };
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (b && actions[b.dataset.act]) actions[b.dataset.act](b);
  });

  async function migovtSignIn(p) {
    const pin = String(p.pin);
    const authEmail = `${pin}@mipass.legislature.migovt.org`, password = `${pin}-legislature`;
    let cred;
    try { cred = await signInWithEmailAndPassword(auth, authEmail, password); }
    catch (e) {
      if (["auth/invalid-credential", "auth/user-not-found", "auth/invalid-login-credentials"].includes(e.code)) cred = await createUserWithEmailAndPassword(auth, authEmail, password);
      else throw e;
    }
    const ref = doc(db, "accounts", cred.user.uid), snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { name: p.name, email: p.email || "", role: PUBLIC_ROLE, dob: p.dob || null, robloxUser: p.user || null, committees: [], createdAt: serverTimestamp(), lastLogin: serverTimestamp() });
    } else {
      await updateDoc(ref, { lastLogin: serverTimestamp() });
    }
  }

  async function loadAccount(user) {
    uid = user.uid;
    try {
      const snap = await getDoc(doc(db, "accounts", uid));
      if (!snap.exists()) { await signOut(auth); return renderSignIn("We couldn't find your account. Please sign in with MiGOVT again."); }
      acct = snap.data();
    } catch (e) { console.error(e); return renderSignIn("Couldn't load your account. Please try again."); }
    (acct.role && acct.role !== PUBLIC_ROLE && ROLES.includes(acct.role)) ? renderDash() : renderNoAccess();
  }

  const qs = new URLSearchParams(location.search);
  const ret = qs.get("mipass_pin") && qs.get("mipass_name")
    ? { pin: qs.get("mipass_pin"), name: qs.get("mipass_name"), dob: qs.get("mipass_dob"), user: qs.get("mipass_user"), email: qs.get("mipass_email") } : null;
  if (ret) { signingIn = true; history.replaceState({}, "", location.pathname); }   // keep the PIN out of the address bar

  loading(ret ? "Signing you in…" : "Checking your sign-in…");
  onAuthStateChanged(auth, async user => {
    if (signingIn) return;
    user ? await loadAccount(user) : renderSignIn();
  });
  if (ret) {
    try { await migovtSignIn(ret); signingIn = false; await loadAccount(auth.currentUser); }
    catch (e) {
      console.error(e); signingIn = false;
      renderSignIn(e.code === "auth/email-already-in-use" ? "This MiGOVT account is already linked to a different sign-in. Contact the Clerk of the Legislature."
        : e.code === "permission-denied" || (e.message || "").includes("permissions") ? "Your account couldn't be created. Make sure the Firestore rules have been published."
        : "Sign-in failed. Please try again.");
    }
  }
}