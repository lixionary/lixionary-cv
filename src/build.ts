/**
 * Build the CV.
 *
 *   npm run build            cv.yaml → dist/index.html + dist/cv.pdf
 *   npm run html             HTML only (no browser needed)
 *   npm run dev              HTML only, rebuilt on every save of cv.yaml or src/
 *
 * Pass another YAML file as the first argument: `npx tsx src/build.ts other.yaml`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { ZodError } from "zod";
import { cvSchema, type CV } from "./schema.js";
import { escapeHtml, footerText, renderHtml } from "./render.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const input = path.resolve(root, args.find((a) => !a.startsWith("--")) ?? "cv.yaml");
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

async function load(): Promise<CV> {
  const raw = parse(await readFile(input, "utf8"));
  try {
    return cvSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const lines = err.issues.map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`);
      throw new Error(`${path.basename(input)} is invalid:\n${lines.join("\n")}`);
    }
    throw err;
  }
}

async function buildHtml(): Promise<{ cv: CV; html: string; file: string }> {
  const cv = await load();
  const css = await readFile(path.join(root, "src/styles.css"), "utf8");
  const html = renderHtml(cv, { css, fontCss: await fontCss() });
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, "index.html");
  await writeFile(file, html);
  return { cv, html, file };
}

async function buildPdf(cv: CV, htmlFile: string): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlFile}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(outDir, "cv.pdf");
    await page.pdf({
      path: file,
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
    return file;
  } finally {
    await browser.close();
  }
}

async function run(): Promise<void> {
  const started = Date.now();
  const { cv, file } = await buildHtml();
  const made = [path.relative(root, file)];
  if (!flags.has("--html-only")) made.push(path.relative(root, await buildPdf(cv, file)));
  console.log(`✓ ${made.join(" + ")} (${Date.now() - started} ms)`);
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
  console.log(`Watching ${path.relative(root, input)} and src/ — open dist/index.html and refresh after saving.`);
  let timer: NodeJS.Timeout | undefined;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(runSafely, 100);
  };
  watch(input, rebuild);
  watch(path.join(root, "src"), rebuild);
}
