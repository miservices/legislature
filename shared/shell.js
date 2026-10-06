/* Injects the page hero, optional filter bar, content area and footer into <div id="app">. */
export function mountShell({ eyebrow, title, sub, filters = true, card = true }) {
  if (!document.querySelector("link[data-fonts]")) {
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.setAttribute("data-fonts", "");
    l.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap";
    document.head.appendChild(l);
  }
  document.getElementById("app").innerHTML = `
  <section class="page-hero"><div class="wrap">
    <div class="page-hero-eyebrow">${eyebrow}</div>
    <h1>${title}</h1>
    <p>${sub}</p>
  </div></section>
  ${filters ? '<div class="filter-bar"><div class="wrap filter-inner" id="filters"></div></div>' : ""}
  <div class="wrap"><div class="page-main">
    ${card ? '<div class="content-card" id="content"></div>' : '<div id="content"></div>'}
  </div></div>
  <footer class="site-footer"><div class="wrap">
    <p class="footer-copy">This website is a free service of the Legislative Service Bureau in cooperation with the Michigan Legislature and Library of Michigan. This site is intended to provide accurate and timely legislative information to the citizens of the State of Michigan and other interested parties. Pursuant to Public Act 6, the Revised Statutes of 1846, the information codified under the Michigan Compiled Laws (MCL), Michigan Administrative Code (MAC), public acts (PA), executive orders, and executive reorganization orders constitutes the substance of Michigan law and is legally binding and considered the official record of state law, except in rare and narrowly defined circumstances recognized under applicable law. This information is subject to revision. If you believe this information is inaccurate, out-of-date, or incomplete, please contact us. This site is a simulated legislative interface and does not represent any real government body or authority.</p>
  </div></footer>`;
}