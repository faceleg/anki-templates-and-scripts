#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { checkConnection, modelNames } = require('./lib/ankiconnect');

/**
 * Get all directories in the Card Templates directory
 * @returns {string[]} Array of directory names
 */
function getRepoModels() {
  const cardTemplatesDir = path.join(process.cwd(), 'Card Templates');
  try {
    if (!fs.existsSync(cardTemplatesDir)) {
      return [];
    }
    const entries = fs.readdirSync(cardTemplatesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (err) {
    console.error(`Failed to read Card Templates directory: ${err.message}`);
    return [];
  }
}

/**
 * Format a table row with aligned columns
 * @param {string} name
 * @param {boolean} inAnki
 * @param {boolean} inRepo
 * @param {number} nameWidth
 * @returns {string} Formatted row
 */
function formatRow(name, inAnki, inRepo, nameWidth) {
  const anki = inAnki ? '✓' : '✗';
  const repo = inRepo ? '✓' : '✗';
  return `${name.padEnd(nameWidth)} | ${anki.padEnd(3)} | ${repo.padEnd(3)}`;
}

/**
 * Main discover function
 */
async function discover() {
  try {
    // Step 1: Connect to AnkiConnect
    console.log('Connecting to AnkiConnect...\n');
    await checkConnection();

    // Step 2: Get all model names from Anki
    const ankiModels = await modelNames();

    // Step 3: Get all model directories from repo
    const repoModels = getRepoModels();

    // Step 4: Get all unique model names
    const allModels = Array.from(new Set([...ankiModels, ...repoModels])).sort();

    // Step 5: Build table data
    const nameWidth = Math.max(20, Math.max(...allModels.map((m) => m.length)));
    const header = formatRow('Model Name', true, true, nameWidth);
    const separator = '-'.repeat(header.length);

    console.log(header);
    console.log(separator);

    for (const modelName of allModels) {
      const inAnki = ankiModels.includes(modelName);
      const inRepo = repoModels.includes(modelName);
      console.log(formatRow(modelName, inAnki, inRepo, nameWidth));
    }

    // Step 6: Print summary
    console.log('\n' + '='.repeat(header.length));
    const notInRepo = ankiModels.filter((m) => !repoModels.includes(m)).length;
    console.log(
      `${ankiModels.length} models in Anki, ${repoModels.length} in repo, ${notInRepo} not in repo`
    );
  } catch (err) {
    console.error('Discover failed:', err.message);
    process.exit(1);
  }
}

discover();
