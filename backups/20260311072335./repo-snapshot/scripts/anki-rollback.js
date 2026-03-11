#!/usr/bin/env node

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { checkConnection, updateModelTemplates, updateModelStyling } = require('./lib/ankiconnect');

/**
 * Parse CLI arguments
 * @returns {{ backupPath: string|null, restoreSource: boolean }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const restoreSource = args.includes('--restore-source');
  const positional = args.filter((a) => !a.startsWith('--'));
  const backupPath = positional[0] || null;
  return { backupPath, restoreSource };
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
 * Check for uncommitted git changes
 * @returns {boolean} True if there are uncommitted changes
 */
function hasUncommittedChanges() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf8' });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Main rollback function
 */
async function rollback() {
  const { backupPath, restoreSource } = parseArgs();

  // Validate backup path argument
  if (!backupPath) {
    console.error('Usage: node scripts/anki-rollback.js <backup-path> [--restore-source]');
    console.error('Example: node scripts/anki-rollback.js backups/20260311-143022');
    process.exit(1);
  }

  // Resolve backup path (support both absolute and relative)
  const resolvedBackupPath = path.isAbsolute(backupPath)
    ? backupPath
    : path.join(process.cwd(), backupPath);

  // Validate backup path exists
  if (!fsSync.existsSync(resolvedBackupPath)) {
    console.error(`Backup path does not exist: ${resolvedBackupPath}`);
    process.exit(1);
  }

  // Read manifest
  const manifestPath = path.join(resolvedBackupPath, 'manifest.json');
  let manifest;
  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    manifest = JSON.parse(manifestContent);
  } catch (err) {
    console.error(`Failed to read manifest.json: ${err.message}`);
    process.exit(1);
  }

  const { timestamp, models, gitCommit } = manifest;

  // Print what will be restored
  console.log(`\nRestoring backup from ${timestamp}`);
  console.log(`Models: ${models.join(', ')}`);
  console.log(`Git commit: ${gitCommit}`);
  if (restoreSource) {
    console.log('\nWarning: --restore-source will overwrite source files in working directory.');
  }

  // Check for uncommitted git changes if restoring source
  if (restoreSource) {
    if (hasUncommittedChanges()) {
      console.log(
        '\nWarning: You have uncommitted git changes. Proceeding will overwrite working directory files.'
      );
    }
  }

  // Prompt for confirmation
  const confirmed = await promptConfirm('\nProceed with rollback? (y/N) ');
  if (!confirmed) {
    console.log('Aborted.');
    return;
  }

  // Connect to AnkiConnect
  try {
    await checkConnection();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  // Restore each model
  for (const modelName of models) {
    const modelDir = path.join(resolvedBackupPath, modelName);

    // Read templates
    const templatesPath = path.join(modelDir, 'templates.json');
    let templates;
    try {
      const templatesContent = await fs.readFile(templatesPath, 'utf8');
      templates = JSON.parse(templatesContent);
    } catch (err) {
      console.error(`Failed to read templates for "${modelName}": ${err.message}`);
      process.exit(1);
    }

    // Read style.css (optional — might be missing if backup was partial)
    let css = '';
    const stylePath = path.join(modelDir, 'style.css');
    if (fsSync.existsSync(stylePath)) {
      try {
        css = await fs.readFile(stylePath, 'utf8');
      } catch (err) {
        console.error(`Failed to read style.css for "${modelName}": ${err.message}`);
        process.exit(1);
      }
    } else {
      console.error(`Warning: No style.css found for "${modelName}" in backup (skipping CSS restore)`);
    }

    // Update Anki
    try {
      await updateModelTemplates(modelName, templates);
      if (fsSync.existsSync(stylePath)) {
        await updateModelStyling(modelName, css);
      }
      console.log(`✓ Restored ${modelName}`);
    } catch (err) {
      console.error(`Failed to restore "${modelName}": ${err.message}`);
      process.exit(1);
    }
  }

  // Restore source files if requested
  if (restoreSource) {
    const repoSnapshotDir = path.join(resolvedBackupPath, 'repo-snapshot');

    // Restore scripts/
    const backupScriptsDir = path.join(repoSnapshotDir, 'scripts');
    const targetScriptsDir = path.join(process.cwd(), 'scripts');
    try {
      await fs.cp(backupScriptsDir, targetScriptsDir, { recursive: true });
    } catch (err) {
      console.error(`Failed to restore scripts/: ${err.message}`);
      process.exit(1);
    }

    // Restore Card Templates/
    const backupCardTemplatesDir = path.join(repoSnapshotDir, 'Card Templates');
    const targetCardTemplatesDir = path.join(process.cwd(), 'Card Templates');
    try {
      await fs.cp(backupCardTemplatesDir, targetCardTemplatesDir, { recursive: true });
    } catch (err) {
      console.error(`Failed to restore Card Templates/: ${err.message}`);
      process.exit(1);
    }

    // Restore shared/ if it exists in backup
    const backupSharedDir = path.join(repoSnapshotDir, 'shared');
    if (fsSync.existsSync(backupSharedDir)) {
      const targetSharedDir = path.join(process.cwd(), 'shared');
      try {
        await fs.cp(backupSharedDir, targetSharedDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to restore shared/: ${err.message}`);
        process.exit(1);
      }
    }

    console.log('✓ Restored source files from backup');
  }

  console.log('\nRollback complete.');
}

rollback();
