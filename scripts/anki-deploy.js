#!/usr/bin/env node

// Usage: node scripts/anki-deploy.js [--model=NAME] [--dry-run] [--no-confirm] [--force]
//
// Safety (ADR-003): validates dist/ before writing, refuses to overwrite edits made
// directly in Anki (unless --force), snapshots current Anki state first, verifies
// after write, and records hashes of what was deployed in .deploy-state.json.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  checkConnection,
  modelNames,
  modelTemplates,
  modelStyling,
  updateModelTemplates,
  updateModelStyling,
} = require('./lib/ankiconnect');
const { snapshotModels } = require('./lib/snapshot');
const { paths, promptConfirm, parseCli } = require('./lib/util');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Flat { "<template> / Front": sha, ..., "style.css": sha } for comparison/recording. */
function fingerprint(templates, css) {
  const out = { 'style.css': sha(css || '') };
  for (const [name, { Front, Back }] of Object.entries(templates)) {
    out[`${name} / Front`] = sha(Front || '');
    out[`${name} / Back`] = sha(Back || '');
  }
  return out;
}

/** Restrict Anki templates to the names we manage (dist), so extra Anki templates don't count. */
const pick = (templates, names) => Object.fromEntries(names.map((n) => [n, templates[n] || {}]));

function differingKeys(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(paths.state, 'utf8'));
  } catch {
    return {};
  }
}

function lineCount(text) {
  return text ? text.split('\n').length : 0;
}

function diffStats(current, next) {
  const c = lineCount(current);
  const n = lineCount(next);
  return { added: Math.max(0, n - c), removed: Math.max(0, c - n), changed: current !== next };
}

/** Read dist/<model>/ dirs. Throws on hard errors (collected into a list by caller). */
function readDistModels(filterModel) {
  const names = fs
    .readdirSync(paths.dist, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (!filterModel || e.name === filterModel))
    .map((e) => e.name);

  return names.map((modelName) => {
    const modelDir = path.join(paths.dist, modelName);
    const cssPath = path.join(modelDir, 'style.css');
    const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    const templates = {};
    for (const file of fs.readdirSync(modelDir).filter((f) => f.endsWith('.html'))) {
      const m = file.match(/^(.+) - (Front|Back)\.html$/);
      if (!m) {
        console.error(`Warning: Unexpected HTML file name: ${modelName}/${file}`);
        continue;
      }
      templates[m[1]] ||= { Front: '', Back: '' };
      templates[m[1]][m[2]] = fs.readFileSync(path.join(modelDir, file), 'utf8');
    }
    return { modelName, css, templates };
  });
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function deploy() {
  const { values } = parseCli({
    model: { type: 'string' },
    'dry-run': { type: 'boolean' },
    'no-confirm': { type: 'boolean' },
    force: { type: 'boolean' },
  });
  const { 'dry-run': dryRun, 'no-confirm': noConfirm, force, model: filterModel } = values;

  if (!fs.existsSync(paths.dist)) fail("dist/ directory not found. Run 'npm run build' first.");

  try {
    await checkConnection();
  } catch (err) {
    fail(err.message);
  }

  const ankiModels = await modelNames();
  const distModels = readDistModels(filterModel);
  if (distModels.length === 0) {
    fail(filterModel ? `No model directory found in dist/ for: ${filterModel}` : 'No model directories found in dist/');
  }

  // ---- Hard validation (nothing is written if any of this fails) ----
  const errors = [];
  const current = {};
  for (const { modelName, css, templates } of distModels) {
    if (!ankiModels.includes(modelName)) {
      errors.push(`Model "${modelName}" does not exist in Anki. Valid models: ${ankiModels.join(', ')}`);
      continue;
    }
    if (!css.trim()) errors.push(`${modelName}: dist style.css is missing or empty (refusing to send empty CSS)`);
    const ankiTemplates = await modelTemplates(modelName);
    current[modelName] = { templates: ankiTemplates, css: (await modelStyling(modelName)).css || '' };
    const valid = Object.keys(ankiTemplates);
    if (Object.keys(templates).length === 0) errors.push(`${modelName}: no templates found in dist`);
    for (const [name, { Front, Back }] of Object.entries(templates)) {
      if (!valid.includes(name)) {
        errors.push(`${modelName}: template "${name}" does not exist in Anki. Valid names: ${valid.join(', ')}`);
        continue;
      }
      if (!Front.trim()) errors.push(`${modelName}: template "${name}" has an empty Front`);
      if (!Back.trim()) errors.push(`${modelName}: template "${name}" has an empty Back`);
    }
  }
  if (errors.length) fail(`Refusing to deploy:\n  - ${errors.join('\n  - ')}`);

  // ---- Detect edits made directly in Anki since last deploy ----
  const state = loadState();
  let drifted = false;
  for (const { modelName, templates } of distModels) {
    const cur = current[modelName];
    const recorded = state[modelName];
    if (!recorded) {
      console.log(`Note: no deploy record for "${modelName}" (first run); skipping Anki-edit check.`);
      continue;
    }
    const diff = differingKeys(recorded, fingerprint(pick(cur.templates, Object.keys(templates)), cur.css));
    if (diff.length) {
      drifted = true;
      console.error(`\nAnki content for "${modelName}" differs from what was last deployed:`);
      for (const k of diff) console.error(`  - ${k}`);
    }
  }
  if (drifted) {
    if (!force) {
      console.error(
        '\nThese were edited in Anki since the last deploy. Run `npm run anki:pull` to inspect them\n' +
          '(written to pulled/), then re-run with --force to overwrite.'
      );
      if (!dryRun) process.exit(1);
    } else {
      console.log('\n--force given: overwriting Anki-side edits.');
    }
  }

  // ---- Diff summary ----
  const changed = [];
  for (const m of distModels) {
    const cur = current[m.modelName];
    const cssDiff = diffStats(cur.css, m.css);
    const tDiffs = {};
    let any = cssDiff.changed;
    for (const [name, { Front, Back }] of Object.entries(m.templates)) {
      const f = diffStats(cur.templates[name].Front || '', Front);
      const b = diffStats(cur.templates[name].Back || '', Back);
      tDiffs[name] = { f, b };
      any = any || f.changed || b.changed;
    }
    if (any) changed.push({ ...m, cssDiff, tDiffs });
  }

  console.log(`\n${changed.length} model(s) to deploy, ${distModels.length - changed.length} unchanged\n`);
  for (const { modelName, cssDiff, tDiffs } of changed) {
    console.log(`  ${modelName}`);
    if (cssDiff.changed) console.log(`    CSS: +${cssDiff.added} lines / -${cssDiff.removed} lines`);
    for (const [name, { f, b }] of Object.entries(tDiffs)) {
      if (f.changed) console.log(`    ${name} (Front): +${f.added} lines / -${f.removed} lines`);
      if (b.changed) console.log(`    ${name} (Back): +${b.added} lines / -${b.removed} lines`);
    }
  }

  if (dryRun) return console.log('\nDry run complete. No changes made.');

  // Unchanged models already match Anki: record them so future edits are detected.
  const newState = { ...state };
  for (const m of distModels) {
    if (!changed.some((c) => c.modelName === m.modelName)) {
      newState[m.modelName] = fingerprint(m.templates, m.css);
    }
  }
  const saveState = () => fs.writeFileSync(paths.state, JSON.stringify(newState, null, 2));

  if (changed.length === 0) {
    saveState();
    return console.log('Nothing to deploy.');
  }

  if (!noConfirm && !(await promptConfirm(`\nDeploy ${changed.length} model(s)? (y/N) `))) {
    return console.log('Aborted.');
  }

  // ---- Backup, write, verify ----
  const backup = await snapshotModels(changed.map((m) => m.modelName));
  const rollbackCmd = `npm run anki:rollback -- backups/${backup.name}`;
  console.log(`Backup saved to backups/${backup.name}`);

  let deployed = 0;
  for (const { modelName, css, templates } of changed) {
    try {
      await updateModelTemplates(modelName, templates);
      await updateModelStyling(modelName, css);

      const after = await modelTemplates(modelName);
      const afterCss = (await modelStyling(modelName)).css || '';
      const sent = fingerprint(templates, css);
      const got = fingerprint(pick(after, Object.keys(templates)), afterCss);
      const bad = differingKeys(sent, got);
      if (bad.length) {
        throw new Error(`verification failed, Anki content differs from what was sent: ${bad.join(', ')}`);
      }
      newState[modelName] = got;
      console.log(`✓ Deployed and verified ${modelName}`);
      deployed++;
    } catch (err) {
      saveState();
      console.error(`\nFailed on ${modelName}: ${err.message}`);
      console.error(`${deployed} model(s) deployed before the failure. To restore the previous state, run:\n  ${rollbackCmd}`);
      process.exit(1);
    }
  }

  saveState();
  console.log(`\nDone. ${deployed} model(s) deployed. Rollback if needed: ${rollbackCmd}`);
}

deploy().catch((err) => {
  console.error(`Deploy failed: ${err.message}`);
  process.exit(1);
});
