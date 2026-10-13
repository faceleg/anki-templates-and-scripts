#!/usr/bin/env node

// Usage: node scripts/anki-rollback.js <backup-path> [--model=NAME] [--no-confirm] [--restore-source]
//
// Restores templates/CSS from a backup into Anki. By default only note types that exist
// in dist/ (this repo's note types) are restored; --model restores a single one.
// --restore-source also runs `git checkout <manifest.gitCommit> -- "Card Templates" shared`
// (refused if those paths have uncommitted changes).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  checkConnection,
  modelNames,
  updateModelTemplates,
  updateModelStyling,
} = require('./lib/ankiconnect');
const { ROOT, paths, promptConfirm, parseCli, git } = require('./lib/util');

const SOURCE_PATHS = ['Card Templates', 'shared'];

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function rollback() {
  const { values, positionals } = parseCli(
    {
      model: { type: 'string' },
      'no-confirm': { type: 'boolean' },
      'restore-source': { type: 'boolean' },
    },
    true
  );
  if (positionals.length !== 1) {
    fail(
      'Usage: node scripts/anki-rollback.js <backup-path> [--model=NAME] [--no-confirm] [--restore-source]\n' +
        'Example: node scripts/anki-rollback.js backups/20260311-143022'
    );
  }

  const backupDir = path.resolve(ROOT, positionals[0]);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  } catch (err) {
    fail(`Failed to read manifest.json in ${backupDir}: ${err.message}`);
  }

  // Which models: dist/ note types (or one via --model), limited to what the backup holds.
  let targets;
  if (values.model) {
    if (!manifest.models.includes(values.model)) {
      fail(`Model "${values.model}" is not in this backup. Backup has: ${manifest.models.join(', ')}`);
    }
    targets = [values.model];
  } else {
    const distNames = fs.existsSync(paths.dist)
      ? fs.readdirSync(paths.dist, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      : [];
    targets = manifest.models.filter((m) => distNames.includes(m));
    if (targets.length === 0) fail('No models in this backup match dist/. Use --model=NAME to pick one.');
  }

  // ---- Pre-checks (nothing is written until all pass) ----
  try {
    await checkConnection();
  } catch (err) {
    fail(err.message);
  }
  const ankiModels = await modelNames();
  const missing = targets.filter((m) => !ankiModels.includes(m));
  if (missing.length) fail(`Model(s) not found in Anki: ${missing.join(', ')}. Nothing was written.`);

  const loaded = targets.map((modelName) => {
    const dir = path.join(backupDir, modelName);
    let templates;
    try {
      templates = JSON.parse(fs.readFileSync(path.join(dir, 'templates.json'), 'utf8'));
    } catch (err) {
      fail(`Failed to read templates.json for "${modelName}": ${err.message}`);
    }
    const cssPath = path.join(dir, 'style.css');
    return { modelName, templates, css: fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : null };
  });

  if (values['restore-source']) {
    if (!manifest.gitCommit || manifest.gitCommit === 'unknown') fail('Backup has no gitCommit; cannot restore source.');
    const dirty = git(['status', '--porcelain', '--', ...SOURCE_PATHS]).trim();
    if (dirty) fail(`Refusing --restore-source: uncommitted changes in ${SOURCE_PATHS.join(', ')}:\n${dirty}`);
  }

  console.log(`\nRestoring backup ${manifest.timestamp} (git ${manifest.gitCommit})`);
  console.log(`Models: ${targets.join(', ')}`);
  if (values['restore-source']) console.log(`Will also: git checkout ${manifest.gitCommit} -- ${SOURCE_PATHS.join(' ')}`);

  if (!values['no-confirm'] && !(await promptConfirm('\nProceed with rollback? (y/N) '))) {
    return console.log('Aborted.');
  }

  for (const { modelName, templates, css } of loaded) {
    try {
      await updateModelTemplates(modelName, templates);
      if (css !== null) await updateModelStyling(modelName, css);
      else console.error(`Warning: no style.css in backup for "${modelName}" (CSS not restored)`);
      console.log(`✓ Restored ${modelName}`);
    } catch (err) {
      fail(`Failed to restore "${modelName}": ${err.message}`);
    }
  }

  if (values['restore-source']) {
    execFileSync('git', ['checkout', manifest.gitCommit, '--', ...SOURCE_PATHS], { cwd: ROOT, stdio: 'inherit' });
    console.log('✓ Restored source files from git');
  }

  // Anki no longer matches the last deploy record; drop it so the next deploy isn't a false alarm.
  try {
    const state = JSON.parse(fs.readFileSync(paths.state, 'utf8'));
    for (const m of targets) delete state[m];
    fs.writeFileSync(paths.state, JSON.stringify(state, null, 2));
  } catch {
    // no state file yet
  }

  console.log('\nRollback complete.');
}

rollback().catch((err) => fail(`Rollback failed: ${err.message}`));
