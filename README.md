# lixionary-cv

My CV as data. Edit `cv.yaml`, run one command, get a styled A4 PDF and a self-contained HTML page.

```
cv.yaml ──▶ src/schema.ts (validate) ──▶ src/render.ts + src/styles.css ──▶ dist/index.html ──▶ Playwright ──▶ dist/cv.pdf
```

## Setup

Node 20+.

```sh
npm install
npm run setup     # one-time: downloads Chromium for PDF export
```

## Commands

| Command          | What it does                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `npm run build`  | `cv.yaml` → `dist/index.html` + `dist/cv.pdf`                       |
| `npm run html`   | HTML only (no browser needed)                                       |
| `npm run dev`    | HTML only, rebuilt on every save; open `dist/index.html` and refresh |
| `npm run check`  | Type-check the TypeScript                                           |

Use another content file with `npx tsx src/build.ts path/to/other.yaml`, e.g. a version tailored to one job.

## Editing `cv.yaml`

- Lists are newest first: companies, roles within a company, talks.
- `**bold**` works in summary, highlight labels, skills and bullets. Use it for numbers, not phrases.
- A role's `tag` prints grey after the title (`Senior Software Engineer · Backend`).
- `showPath: true` on a company prints the role progression (oldest → newest) under it.
- `meta.accent` sets the accent colour. `meta.footer` overrides the PDF footer text.
- A typo in a field name or a missing required field fails the build with the exact path, e.g. `experience.0.roles.2.start: Required`.

## Layout notes

- Page size and printed margins live in `@page` in `src/styles.css`. The PDF footer (name, page x / y) is drawn by `src/build.ts`.
- Page breaks are automatic. Bullets never split across pages, and a role or company heading never ends a page on its own.
- Keep it to 2 pages: after a content change, check the PDF's page count. If it spills onto a third page, cut words before shrinking type.
- Inter is embedded from `@fontsource/inter`, so the PDF and HTML look the same on any machine and need no network.

## Privacy

`cv.yaml` is public, so it carries no phone number, only email. `basics.phone` is still supported (optional) if you want it on a copy you send privately: add it in a separate file that you don't commit, then build that file with `npx tsx src/build.ts path/to/private.yaml`.
