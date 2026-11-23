/**
 * Build the CV.
 *
 *   npm run build            the published site: cv.dev.yaml + cv.qa.yaml →
 *                            dist/index.html (tabs), dist/cv.dev.{html,pdf}, dist/cv.qa.{html,pdf},
 *                            and dist/cv.pdf (a copy of the default tab's PDF, so old links keep working)
 *   npm run build:master     cv.yaml (the master) → dist/master.html + dist/master.pdf (not published)
 *   npm run html             site HTML only (no browser needed)
 *   npm run dev              site HTML only, rebuilt on every save of a YAML file or src/
 *
 * Pass a YAML file as the first argument to build just that file:
 * `npx tsx src/build.ts other.yaml` → dist/other.html + dist/other.pdf.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { ZodError } from "zod";
import { cvSchema, type CV } from "./schema.js";
import { escapeHtml, footerText, renderHtml, renderTabbedHtml } from "./render.js";

/** The tabs on the published page, in order. The first is the default. */
const SITE_TABS = [
  { id: "dev", label: "Software Development", file: "cv.dev.yaml" },
  { id: "qa", label: "Quality Engineering", file: "cv.qa.yaml" },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const single = args.find((a) => !a.startsWith("--"));
const outDir = path.join(root, "dist");
const require = createRequire(import.meta.url);

/** Inter, embedded so the HTML is one self-contained file and the PDF never depends on the network. */
async function fontCss(): Promise<string> {
  const faces = await Promise.all(
    [400, 500, 600, 700].map(async (weight) => {
      const file = require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff2`);
      const data = (await readFile(file)).toString("base64");
      return `@font-face{font-family:Inter;font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");}`;
    }),
  );
  return faces.join("\n");
}

async function load(file: string): Promise<CV> {
  const raw = parse(await readFile(file, "utf8"));
  try {
    return cvSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const lines = err.issues.map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`);
      throw new Error(`${path.basename(file)} is invalid:\n${lines.join("\n")}`);
    }
    throw err;
  }
}

/** dist name for a YAML file: cv.yaml is the master, anything else keeps its own name. */
function outName(file: string): string {
  const base = path.basename(file).replace(/\.ya?ml$/i, "");
  return base === "cv" ? "master" : base;
}

async function buildPdf(cv: CV, htmlFile: string, pdfFile: string): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlFile}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: pdfFile,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="width:100%;padding:0 56px 22px;display:flex;justify-content:space-between;
                    font-family:Inter,-apple-system,Helvetica,Arial,sans-serif;font-size:9pt;color:#6b7280;">
          <span>${escapeHtml(footerText(cv))}</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    });
  } finally {
    await browser.close();
  }
}

/** One YAML file → <name>.html (+ <name>.pdf). */
async function buildOne(file: string, assets: { css: string; fontCss: string }): Promise<{ cv: CV; made: string[] }> {
  const cv = await load(file);
  const name = outName(file);
  const htmlFile = path.join(outDir, `${name}.html`);
  const pdfFile = path.join(outDir, `${name}.pdf`);
  await writeFile(htmlFile, renderHtml(cv, { ...assets, pdfHref: `${name}.pdf` }));
  const made = [htmlFile];
  if (!flags.has("--html-only")) {
    await buildPdf(cv, htmlFile, pdfFile);
    made.push(pdfFile);
  }
  return { cv, made };
}

async function run(): Promise<void> {
  const started = Date.now();
  await mkdir(outDir, { recursive: true });
  const assets = { css: await readFile(path.join(root, "src/styles.css"), "utf8"), fontCss: await fontCss() };
  const made: string[] = [];

  if (single) {
    made.push(...(await buildOne(path.resolve(root, single), assets)).made);
  } else {
    const tabs = [];
    for (const t of SITE_TABS) {
      const { cv, made: files } = await buildOne(path.join(root, t.file), assets);
      made.push(...files);
      tabs.push({ id: t.id, label: t.label, cv, pdfHref: `${outName(t.file)}.pdf` });
    }
    const index = path.join(outDir, "index.html");
    await writeFile(index, renderTabbedHtml(tabs, assets));
    made.unshift(index);
    if (!flags.has("--html-only")) {
      const alias = path.join(outDir, "cv.pdf");
      await copyFile(path.join(outDir, tabs[0].pdfHref), alias);
      made.push(alias);
    }
  }
  console.log(`✓ ${made.map((f) => path.relative(root, f)).join(" + ")} (${Date.now() - started} ms)`);
}

async function runSafely(): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    if (!flags.has("--watch")) process.exitCode = 1;
  }
}

await runSafely();

if (flags.has("--watch")) {
  const inputs = single ? [path.resolve(root, single)] : SITE_TABS.map((t) => path.join(root, t.file));
  console.log(`Watching ${inputs.map((f) => path.relative(root, f)).join(", ")} and src/ — open dist/index.html and refresh after saving.`);
  let timer: NodeJS.Timeout | undefined;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(runSafely, 100);
  };
  for (const f of inputs) watch(f, rebuild);
  watch(path.join(root, "src"), rebuild);
}
