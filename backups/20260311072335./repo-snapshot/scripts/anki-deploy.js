#!/usr/bin/env node

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const {
  checkConnection,
  modelTemplates,
  modelStyling,
  updateModelTemplates,
  updateModelStyling,
} = require('./lib/ankiconnect');

/**
 * Parse CLI arguments
 * @returns {{ dryRun: boolean, noConfirm: boolean, model: string|null }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noConfirm = args.includes('--no-confirm');
  const modelIdx = args.indexOf('--model');
  const model = modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : null;
  return { dryRun, noConfirm, model };
}

/**
 * Count lines in a string
 * @param {string} text
 * @returns {number}
 */
function countLines(text) {
  if (!text) return 0;
  return text.split('\n').length;
}

/**
 * Compute a simple line-count diff summary
 * @param {string} current
 * @param {string} next
 * @returns {{ added: number, removed: number, changed: boolean }}
 */
function diffStats(current, next) {
  const currentLines = countLines(current);
  const nextLines = countLines(next);
  const changed = current !== next;
  const added = Math.max(0, nextLines - currentLines);
  const removed = Math.max(0, currentLines - nextLines);
  return { added, removed, changed };
}

/**
 * Prompt user for confirmation via stdin
 * @param {string} question
 * @returns {Promise<boolean>}
 */
function promptConfirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/**
 * Read all model data from dist/ directory
 * @param {string} distDir
 * @param {string|null} filterModel
 * @returns {Promise<Array<{ modelName: string, css: string, templates: object }>>}
 */
async function readDistModels(distDir, filterModel) {
  const entries = await fs.readdir(distDir, { withFileTypes: true });
  const modelDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !filterModel || name === filterModel);

  const models = [];
  for (const modelName of modelDirs) {
    const modelDir = path.join(distDir, modelName);

    // Read style.css
    const cssPath = path.join(modelDir, 'style.css');
    let css = '';
    try {
      css = await fs.readFile(cssPath, 'utf8');
    } catch {
      console.error(`Warning: No style.css found in dist/${modelName}`);
    }

    // Read all *.html files and group into templates
    const htmlEntries = await fs.readdir(modelDir, { withFileTypes: true });
    const htmlFiles = htmlEntries.filter((e) => e.isFile() && e.name.endsWith('.html'));

    const templates = {};
    for (const htmlFile of htmlFiles) {
      // Match pattern: "<TemplateName> - Front.html" or "<TemplateName> - Back.html"
      const match = htmlFile.name.match(/^(.+) - (Front|Back)\.html$/);
      if (!match) {
        console.error(`Warning: Unexpected HTML file name: ${htmlFile.name}`);
        continue;
      }
      const [, templateName, side] = match;
      if (!templates[templateName]) {
        templates[templateName] = { Front: '', Back: '' };
      }
      const content = await fs.readFile(path.join(modelDir, htmlFile.name), 'utf8');
      templates[templateName][side] = content;
    }

    models.push({ modelName, css, templates });
  }

  return models;
}

/**
 * Main deploy function
 */
async function deploy() {
  const { dryRun, noConfirm, model: filterModel } = parseArgs();

  const distDir = path.join(process.cwd(), 'dist');
  if (!fsSync.existsSync(distDir)) {
    console.error("dist/ directory not found. Run 'npm run build' first.");
    process.exit(1);
  }

  // Connect to AnkiConnect
  try {
    await checkConnection();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // Read dist/ models
  let distModels;
  try {
    distModels = await readDistModels(distDir, filterModel);
  } catch (err) {
    console.error('Failed to read dist/ directory:', err.message);
    process.exit(1);
  }

  if (distModels.length === 0) {
    if (filterModel) {
      console.error(`No model directory found for: ${filterModel}`);
    } else {
      console.error('No model directories found in dist/');
    }
    process.exit(1);
  }

  // Fetch current Anki state and compute diffs
  const modelDiffs = [];
  for (const { modelName, css, templates } of distModels) {
    let currentTemplates;
    let currentStyling;
    try {
      currentTemplates = await modelTemplates(modelName);
      currentStyling = await modelStyling(modelName);
    } catch (err) {
      console.error(`Failed to fetch current state for model "${modelName}": ${err.message}`);
      process.exit(1);
    }

    const currentCss = currentStyling.css || '';
    const cssDiff = diffStats(currentCss, css);

    const templateDiffs = {};
    let hasTemplateChanges = false;
    for (const [templateName, { Front, Back }] of Object.entries(templates)) {
      const currentTemplate = currentTemplates[templateName] || {};
      const frontDiff = diffStats(currentTemplate.Front || '', Front);
      const backDiff = diffStats(currentTemplate.Back || '', Back);
      templateDiffs[templateName] = { frontDiff, backDiff };
      if (frontDiff.changed || backDiff.changed) {
        hasTemplateChanges = true;
      }
    }

    const hasChanges = cssDiff.changed || hasTemplateChanges;
    modelDiffs.push({ modelName, css, templates, cssDiff, templateDiffs, hasChanges });
  }

  const changedModels = modelDiffs.filter((m) => m.hasChanges);
  const unchangedCount = modelDiffs.length - changedModels.length;

  // Print summary
  console.log(`\n${changedModels.length} model(s) to deploy, ${unchangedCount} unchanged\n`);
  for (const { modelName, cssDiff, templateDiffs } of changedModels) {
    console.log(`  ${modelName}`);
    if (cssDiff.changed) {
      console.log(`    CSS: +${cssDiff.added} lines / -${cssDiff.removed} lines`);
    }
    for (const [templateName, { frontDiff, backDiff }] of Object.entries(templateDiffs)) {
      if (frontDiff.changed) {
        console.log(
          `    ${templateName} (Front): +${frontDiff.added} lines / -${frontDiff.removed} lines`
        );
      }
      if (backDiff.changed) {
        console.log(
          `    ${templateName} (Back): +${backDiff.added} lines / -${backDiff.removed} lines`
        );
      }
    }
  }

  if (dryRun) {
    console.log('\nDry run complete. No changes made.');
    return;
  }

  if (changedModels.length === 0) {
    console.log('Nothing to deploy.');
    return;
  }

  // Confirmation prompt
  if (!noConfirm) {
    const confirmed = await promptConfirm(`\nDeploy ${changedModels.length} model(s)? (y/N) `);
    if (!confirmed) {
      console.log('Aborted.');
      return;
    }
  }

  // Deploy each changed model
  let deployedCount = 0;
  for (const { modelName, css, templates } of changedModels) {
    try {
      await updateModelTemplates(modelName, templates);
      await updateModelStyling(modelName, css);
      console.log(`✓ Deployed ${modelName}`);
      deployedCount++;
    } catch (err) {
      console.error(`Failed to deploy ${modelName}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\nDone. ${deployedCount} model(s) deployed.`);
}

deploy();
