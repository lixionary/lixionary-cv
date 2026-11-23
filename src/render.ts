import type { CV } from "./schema.js";

const escape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Escape, then turn **bold** into <strong>. */
const inline = (s: string): string =>
  escape(s.trim()).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const join = (parts: Array<string | false | undefined | null>): string =>
  parts.filter(Boolean).join("\n");

const dash = (start: string, end: string) => `${escape(start)} – ${escape(end)}`;

function masthead(cv: CV): string {
  const b = cv.basics;
  const contact = join([
    b.location && `<span>${escape(b.location)}</span>`,
    b.phone && `<a href="tel:${escape(b.phone.replace(/[^+\d]/g, ""))}">${escape(b.phone)}</a>`,
    b.email && `<a href="mailto:${escape(b.email)}">${escape(b.email)}</a>`,
    ...b.links.map((l) => `<a href="${escape(l.url)}">${escape(l.label)}</a>`),
  ]);
  return `
<header class="masthead">
  <div>
    <h1>${escape(b.name)}</h1>
    ${b.headline ? `<p class="headline">${escape(b.headline)}</p>` : ""}
  </div>
  <address class="contact">${contact}</address>
</header>`;
}

function summary(cv: CV): string {
  if (!cv.summary) return "";
  return `
<section class="summary">
  <h2 class="label">Summary</h2>
  <p>${inline(cv.summary)}</p>
</section>`;
}

function highlights(cv: CV): string {
  if (!cv.highlights.length) return "";
  const items = cv.highlights
    .map(
      (h) => `
  <div class="highlight">
    <span class="value">${escape(h.value)}</span>
    <span class="caption">${inline(h.label)}</span>
  </div>`,
    )
    .join("");
  return `<div class="highlights" style="--cols: ${cv.highlights.length}">${items}\n</div>`;
}

function skills(cv: CV): string {
  if (!cv.skills.length) return "";
  const rows = cv.skills
    .map((s) => `  <dt>${escape(s.name)}</dt>\n  <dd>${inline(s.items)}</dd>`)
    .join("\n");
  return `
<section>
  <h2 class="label">Core skills</h2>
  <dl class="skills">
${rows}
  </dl>
</section>`;
}

function experience(cv: CV): string {
  if (!cv.experience.length) return "";
  const companies = cv.experience
    .map((c) => {
      const path = c.showPath
        ? `<p class="path">${[...c.roles]
            .reverse()
            .map((r) => escape(r.title.split(",")[0]))
            .join(" → ")}</p>`
        : "";
      const roles = c.roles
        .map(
          (r) => `
    <article class="role">
      <div class="row role-head">
        <h4>${escape(r.title)}${r.tag ? ` <span class="quiet">· ${escape(r.tag)}</span>` : ""}</h4>
        <span class="dates">${dash(r.start, r.end)}</span>
      </div>
      ${
        r.bullets.length
          ? `<ul class="bullets">\n${r.bullets.map((b) => `        <li>${inline(b)}</li>`).join("\n")}\n      </ul>`
          : ""
      }
    </article>`,
        )
        .join("");
      return `
  <div class="company">
    <div class="company-head">
      <div class="row">
        <h3>${escape(c.name)}${c.location ? ` <span class="quiet">· ${escape(c.location)}</span>` : ""}</h3>
        ${c.period ? `<span class="period">${escape(c.period)}</span>` : ""}
      </div>
      ${path}
    </div>${roles}
  </div>`;
    })
    .join("");
  return `
<section class="experience">
  <h2 class="label">Professional experience</h2>${companies}
</section>`;
}

function educationAndTalks(cv: CV): string {
  const edu = cv.education.length
    ? `
  <section>
    <h2 class="label">Education</h2>
    ${cv.education
      .map(
        (e) => `<div class="entries">
      <div class="row"><strong>${escape(e.school)}</strong><span class="year">${dash(e.start, e.end)}</span></div>
      <span>${escape(e.degree)}${e.detail ? ` <span class="quiet">· ${escape(e.detail)}</span>` : ""}</span>
    </div>`,
      )
      .join("\n    ")}
  </section>`
    : "";
  const talks = cv.talks.length
    ? `
  <section>
    <h2 class="label">Public talks</h2>
    <div class="entries">
      ${cv.talks
        .map(
          (t) =>
            `<div class="row"><span><strong>${escape(t.title)}</strong> <span class="quiet">· ${escape(t.venue)}</span></span><span class="year">${escape(t.year)}</span></div>`,
        )
        .join("\n      ")}
    </div>
  </section>`
    : "";
  if (!edu && !talks) return "";
  return `<div class="edu-talks">${edu}${talks}\n</div>`;
}

/** The white A4 sheet for one CV. */
export function renderSheet(cv: CV, attrs = ""): string {
  return `<main class="sheet"${attrs}>
${join([masthead(cv), summary(cv), highlights(cv), skills(cv), experience(cv), educationAndTalks(cv)])}
</main>`;
}

function head(title: string, description: string | undefined, accent: string, opts: { css: string; fontCss: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
${description ? `<meta name="description" content="${escape(description)}">` : ""}
<style>
${opts.fontCss}
${opts.css}
:root { --accent: ${accent}; }
</style>
</head>`;
}

/** One CV on its own page; this is also what the PDF is printed from. */
export function renderHtml(cv: CV, opts: { css: string; fontCss: string; pdfHref: string }): string {
  const b = cv.basics;
  return `${head(`${b.name} · CV`, b.headline && `${b.name}: ${b.headline}`, cv.meta.accent, opts)}
<body>
<nav class="toolbar"><a href="${escape(opts.pdfHref)}" download>Download PDF</a></nav>
${renderSheet(cv)}
</body>
</html>
`;
}

export interface Tab {
  id: string;
  label: string;
  cv: CV;
  pdfHref: string;
}

/** Several CVs on one page, one tab each. The URL hash (#dev, #qa) picks the tab, so each is linkable. */
export function renderTabbedHtml(tabs: Tab[], opts: { css: string; fontCss: string }): string {
  const first = tabs[0];
  const b = first.cv.basics;
  const buttons = tabs
    .map(
      (t, i) =>
        `<button type="button" role="tab" id="tab-${escape(t.id)}" aria-controls="cv-${escape(t.id)}" aria-selected="${i === 0}" data-tab="${escape(t.id)}" data-pdf="${escape(t.pdfHref)}">${escape(t.label)}</button>`,
    )
    .join("\n    ");
  const sheets = tabs
    .map((t, i) =>
      renderSheet(t.cv, ` id="cv-${escape(t.id)}" role="tabpanel" aria-labelledby="tab-${escape(t.id)}"${i === 0 ? "" : " hidden"}`),
    )
    .join("\n");
  return `${head(`${b.name} · CV`, `${b.name}: CV`, first.cv.meta.accent, opts)}
<body>
<nav class="toolbar tabbed">
  <div class="tabs" role="tablist" aria-label="CV version">
    ${buttons}
  </div>
  <a id="pdf-link" href="${escape(first.pdfHref)}" download>Download PDF</a>
</nav>
${sheets}
<script>
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const pdf = document.getElementById("pdf-link");
  const show = (id, push) => {
    const tab = tabs.find((t) => t.dataset.tab === id) ?? tabs[0];
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    }
    pdf.href = tab.dataset.pdf;
    if (push) history.replaceState(null, "", "#" + tab.dataset.tab);
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => show(t.dataset.tab, true));
    t.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      show(next.dataset.tab, true);
      next.focus();
    });
  });
  addEventListener("hashchange", () => show(location.hash.slice(1), false));
  show(location.hash.slice(1), false);
})();
</script>
</body>
</html>
`;
}

export function footerText(cv: CV): string {
  return cv.meta.footer ?? `${cv.basics.name} · CV`;
}

export const escapeHtml = escape;
