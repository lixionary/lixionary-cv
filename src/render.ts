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

export function renderHtml(cv: CV, opts: { css: string; fontCss: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(cv.basics.name)} · CV</title>
${cv.basics.headline ? `<meta name="description" content="${escape(cv.basics.name)}: ${escape(cv.basics.headline)}">` : ""}
<style>
${opts.fontCss}
${opts.css}
:root { --accent: ${cv.meta.accent}; }
</style>
</head>
<body>
<nav class="toolbar"><a href="cv.pdf" download>Download PDF</a></nav>
<main class="sheet">
${join([masthead(cv), summary(cv), highlights(cv), skills(cv), experience(cv), educationAndTalks(cv)])}
</main>
</body>
</html>
`;
}

export function footerText(cv: CV): string {
  return cv.meta.footer ?? `${cv.basics.name} · CV`;
}

export const escapeHtml = escape;
