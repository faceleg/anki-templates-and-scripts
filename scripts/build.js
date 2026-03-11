#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const { PurgeCSS } = require("purgecss");

const repoRoot = path.resolve(__dirname, "..");
const cardTemplatesDir = path.join(repoRoot, "Card Templates");
const distDir = path.join(repoRoot, "dist");

/**
 * Resolve a single inject comment in CSS:
 *   /* @inject: some/path.css *\/
 * Returns the file contents to substitute in.
 */
async function resolveInjectCSS(match, injectPath) {
  const fullPath = path.join(repoRoot, injectPath);
  const contents = await fs.readFile(fullPath, "utf8");
  return contents;
}

/**
 * Resolve a single inject comment in HTML/JS:
 *   <!-- @inject: shared/js/foo.js -->
 * Returns a <script> block containing the file contents.
 */
async function resolveInjectHTML(match, injectPath) {
  const fullPath = path.join(repoRoot, injectPath);
  const contents = await fs.readFile(fullPath, "utf8");
  return `<script>\n${contents}\n</script>`;
}

/**
 * Process a CSS file: replace all /* @inject: ... *\/ comments with file contents.
 */
async function processCSSFile(content) {
  const injectPattern = /\/\* @inject: (.+?) \*\//g;
  const matches = [...content.matchAll(injectPattern)];

  let result = content;
  for (const match of matches) {
    const [fullMatch, injectPath] = match;
    const injected = await resolveInjectCSS(fullMatch, injectPath.trim());
    result = result.replace(fullMatch, injected);
  }
  return result;
}

/**
 * Process an HTML file: replace all <!-- @inject: ... --> comments with <script> blocks.
 */
async function processHTMLFile(content) {
  const injectPattern = /<!-- @inject: (.+?) -->/g;
  const matches = [...content.matchAll(injectPattern)];

  let result = content;
  for (const match of matches) {
    const [fullMatch, injectPath] = match;
    const injected = await resolveInjectHTML(fullMatch, injectPath.trim());
    result = result.replace(fullMatch, injected);
  }
  return result;
}

/**
 * Recursively find all .html files under a directory.
 */
async function findHTMLFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findHTMLFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Find all CSS files at the top level of a model directory.
 * (style.css, quiz.css, etc. — but not files in subdirectories,
 *  as those are only injected, not standalone templates)
 */
async function findCSSFiles(modelDir) {
  const entries = await fs.readdir(modelDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".css"))
    .map((e) => path.join(modelDir, e.name));
}

async function buildModel(modelName) {
  const modelDir = path.join(cardTemplatesDir, modelName);
  const outDir = path.join(distDir, modelName);

  await fs.mkdir(outDir, { recursive: true });

  // Process CSS files
  const cssFiles = await findCSSFiles(modelDir);
  for (const cssFile of cssFiles) {
    const content = await fs.readFile(cssFile, "utf8");
    const processed = await processCSSFile(content);
    const outPath = path.join(outDir, path.basename(cssFile));
    await fs.writeFile(outPath, processed, "utf8");
  }

  // Process HTML files (may be in subdirectories)
  const htmlFiles = await findHTMLFiles(modelDir);
  for (const htmlFile of htmlFiles) {
    const content = await fs.readFile(htmlFile, "utf8");
    const processed = await processHTMLFile(content);
    const outPath = path.join(outDir, path.basename(htmlFile));
    await fs.writeFile(outPath, processed, "utf8");
  }
}

/**
 * Run PurgeCSS per model: each model's CSS is purged using only that model's HTML.
 * This ensures CSS selectors from one note type don't prevent purging in another.
 */
async function purgeCSSInDist() {
  const modelEntries = await fs.readdir(distDir, { withFileTypes: true });
  for (const entry of modelEntries) {
    if (!entry.isDirectory()) continue;
    const modelDistDir = path.join(distDir, entry.name);

    const htmlFiles = await findHTMLFiles(modelDistDir);
    if (htmlFiles.length === 0) continue;

    const cssEntries = await fs.readdir(modelDistDir, { withFileTypes: true });
    const cssFiles = cssEntries
      .filter((e) => e.isFile() && e.name.endsWith(".css"))
      .map((e) => path.join(modelDistDir, e.name));
    if (cssFiles.length === 0) continue;

    const results = await new PurgeCSS().purge({
      content: htmlFiles.map((f) => ({ raw: require("fs").readFileSync(f, "utf8"), extension: "html" })),
      css: cssFiles,
    });

    for (const result of results) {
      await fs.writeFile(result.file, result.css, "utf8");
    }
  }
}

async function main() {
  const entries = await fs.readdir(cardTemplatesDir, { withFileTypes: true });
  const modelDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  for (const modelName of modelDirs) {
    await buildModel(modelName);
  }

  await purgeCSSInDist();

  console.log(`Built ${modelDirs.length} models → dist/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
