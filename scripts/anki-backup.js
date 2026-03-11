#!/usr/bin/env node

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  checkConnection,
  modelNames,
  modelTemplates,
  modelStyling,
} = require('./lib/ankiconnect');

/**
 * Generate a timestamp in format YYYYMMDD-HHMMSS
 * @returns {string} Formatted timestamp
 */
function generateTimestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
}

/**
 * Get the current git commit hash
 * @returns {string} Git commit hash
 */
function getGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (err) {
    console.error('Failed to get git commit:', err.message);
    process.exit(1);
  }
}

/**
 * Create a directory recursively
 * @param {string} dirPath - Path to create
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    console.error(`Failed to create directory ${dirPath}:`, err.message);
    throw err;
  }
}

/**
 * Copy a directory recursively (skips if source doesn't exist)
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @returns {boolean} True if copied, false if source doesn't exist
 */
function copyDirIfExists(src, dest) {
  if (!fsSync.existsSync(src)) {
    return false;
  }
  try {
    fsSync.cpSync(src, dest, { recursive: true });
    return true;
  } catch (err) {
    console.error(`Failed to copy ${src} to ${dest}:`, err.message);
    throw err;
  }
}

/**
 * Main backup function
 */
async function backup() {
  try {
    // Step 1: Connect to AnkiConnect
    console.log('Connecting to AnkiConnect...');
    await checkConnection();
    console.log('Connected to AnkiConnect');

    // Step 2: Get all model names
    const models = await modelNames();
    console.log(`Found ${models.length} model(s): ${models.join(', ')}`);

    // Step 3: Generate timestamp
    const timestamp = generateTimestamp();
    console.log(`Backup timestamp: ${timestamp}`);

    // Step 4: Create backup directory structure
    const backupDir = path.join(process.cwd(), 'backups', timestamp);
    await ensureDir(backupDir);

    // Step 5: Backup each model
    for (const modelName of models) {
      console.log(`Backing up model: ${modelName}`);
      const modelDir = path.join(backupDir, modelName);
      await ensureDir(modelDir);

      // Get templates
      const templates = await modelTemplates(modelName);
      const templatesPath = path.join(modelDir, 'templates.json');
      await fs.writeFile(templatesPath, JSON.stringify(templates, null, 2));
      console.log(`  → templates.json`);

      // Get styling
      const styling = await modelStyling(modelName);
      const stylePath = path.join(modelDir, 'style.css');
      await fs.writeFile(stylePath, styling.css);
      console.log(`  → style.css`);
    }

    // Step 6: Copy repo source files
    console.log('Copying repo source files...');
    const repoSnapshotDir = path.join(backupDir, 'repo-snapshot');
    await ensureDir(repoSnapshotDir);

    const scriptsDir = path.join(process.cwd(), 'scripts');
    fsSync.cpSync(scriptsDir, path.join(repoSnapshotDir, 'scripts'), {
      recursive: true,
    });
    console.log('  → scripts/');

    const cardTemplatesDir = path.join(process.cwd(), 'Card Templates');
    fsSync.cpSync(cardTemplatesDir, path.join(repoSnapshotDir, 'Card Templates'), {
      recursive: true,
    });
    console.log('  → Card Templates/');

    const sharedDir = path.join(process.cwd(), 'shared');
    if (copyDirIfExists(sharedDir, path.join(repoSnapshotDir, 'shared'))) {
      console.log('  → shared/');
    }

    // Step 7: Write manifest
    const gitCommit = getGitCommit();
    const manifest = {
      timestamp,
      models,
      nodeVersion: process.version,
      gitCommit,
    };
    const manifestPath = path.join(backupDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('  → manifest.json');

    // Step 8: Print completion message
    const dateStr = timestamp.slice(0, 8);
    const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    console.log(
      `\nBackup saved to backups/${timestamp}. Run: git add backups/ && git commit -m 'chore: backup ${formattedDate}'`
    );
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

backup();
