/*
 * Shared site header for the Michigan Legislature site.
 * Injects: top disclaimer bar, masthead (State of Michigan / Legislature wordmark),
 * primary nav bar, and the adjournment/session notice bar.
 *
 * Usage:
 *   1. Link shared/header.css in <head>.
 *   2. Place <div id="site-header"></div> as the first thing in <body>.
 *   3. Optionally set window.ACTIVE_NAV = "home" | "legislature" | "laws" |
 *      "bills" | "resolutions" | "resources" before loading this script,
 *      to highlight the current section.
 *   4. Load this script right after the placeholder div:
 *        <script src="/shared/header.js"></script>
 */
(function () {
  var BASE = "https://miservices.github.io/legislature/";
  var active = window.ACTIVE_NAV || "";

  function navClass(name) {
    return active === name ? "active" : "";
  }

  var html = ""
    + '<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">'
    + '  <defs>'
    + '    <symbol id="i-chevron-down" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></symbol>'
    + '    <symbol id="i-info-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="11"/><line x1="12" y1="8" x2="12" y2="8"/></symbol>'
    + '  </defs>'
    + '</svg>'
    + '<div class="disclaimer" role="note">'
    + '  This is not an official government website. This site is a simulated legislative interface and does not represent any real government body or authority.'
    + '</div>'
    + '<div class="masthead">'
    + '  <div class="masthead-inner wrap">'
    + '    <div class="brand">'
    + '      <div class="brand-wordmark">'
    + '        <div class="line1">State of Michigan</div>'
    + '        <div class="line2">Legislature</div>'
    + '      </div>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<nav class="primary" aria-label="Primary navigation">'
    + '  <div class="wrap">'
    + '  <ul>'
    + '    <li><a href="' + BASE + '" class="' + navClass("home") + '">Home</a></li>'
    + '    <li class="has-dropdown">'
    + '      <a href="' + BASE + 'legislators/" class="' + navClass("legislature") + '">Legislature <svg class="icon" aria-hidden="true"><use href="#i-chevron-down"/></svg></a>'
    + '      <ul class="dropdown-menu">'
    + '        <li><a href="' + BASE + 'legislators/">Legislators</a></li>'
    + '        <li><a href="' + BASE + 'committees/">Committees</a></li>'
    + '        <li><a href="' + BASE + 'calendar/">Calendar</a></li>'
    + '        <li><a href="' + BASE + 'journals/">Journals</a></li>'
    + '      </ul>'
    + '    </li>'
    + '    <li class="has-dropdown">'
    + '      <a href="' + BASE + 'mcl/" class="' + navClass("laws") + '">Laws <svg class="icon" aria-hidden="true"><use href="#i-chevron-down"/></svg></a>'
    + '      <ul class="dropdown-menu">'
    + '        <li><a href="' + BASE + 'mcl/">Michigan Compiled Laws</a></li>'
    + '        <li><a href="' + BASE + 'mac/">Michigan Administrative Code</a></li>'
    + '        <li><a href="' + BASE + 'public-acts/">Public Acts (passed bills)</a></li>'
    + '        <li><a href="' + BASE + 'sos/executive-reorganization-orders/">Executive Orders</a></li>'
    + '        <li><a href="' + BASE + 'sos/executive-reorganization-orders/">Executive Reorganization Orders</a></li>'
    + '      </ul>'
    + '    </li>'
    + '    <li><a href="' + BASE + 'bills/" class="' + navClass("bills") + '">Bills</a></li>'
    + '    <li><a href="' + BASE + 'resolutions/" class="' + navClass("resolutions") + '">Resolutions</a></li>'
    + '    <li><a href="' + BASE + 'resources/" class="' + navClass("resources") + '">Other Resources</a></li>'
    + '  </ul>'
    + '  </div>'
    + '</nav>'
    + '<div class="notice" role="status">'
    + '  <div class="notice-inner wrap">'
    + '    <svg class="icon" aria-hidden="true"><use href="#i-info-circle"/></svg>'
    + '    <span>The Legislature is adjourned &nbsp;&mdash;&nbsp; Resumes <strong>Tue Jun 17 &middot; 10:00 AM</strong></span>'
    + '  </div>'
    + '</div>';

  var mount = document.getElementById("site-header");
  if (mount) {
    mount.innerHTML = html;
  } else {
    document.body.insertAdjacentHTML("afterbegin", html);
  }
})();