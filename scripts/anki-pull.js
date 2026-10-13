#!/usr/bin/env node

// Pull templates/CSS from Anki into pulled/<timestamp>/<model>/ for comparison.
// Never writes into Card Templates/ (source of truth is the repo).

const fs = require('fs').promises;
const path = require('path');
const { checkConnection, modelNames, modelTemplates, modelStyling } = require('./lib/ankiconnect');
const { paths, ensureDir, parseCli, sanitizeName, timestamp } = require('./lib/util');

async function pull() {
  const { values } = parseCli({ model: { type: 'string' } });
  try {
    await checkConnection();

    let models = await modelNames();
    if (values.model) {
      if (!models.includes(values.model)) {
        console.error(`Error: Model "${values.model}" not found in Anki`);
        console.error(`Available models: ${models.join(', ')}`);
        process.exit(1);
      }
      models = [values.model];
    }

    const outRoot = path.join(paths.pulled, timestamp());

    for (const modelName of models) {
      console.log(`Pulling model: ${modelName}`);
      const modelDir = path.join(outRoot, sanitizeName(modelName));
      await ensureDir(modelDir);

      const templates = await modelTemplates(modelName);
      for (const [templateName, data] of Object.entries(templates)) {
        for (const side of ['Front', 'Back']) {
          if (typeof data[side] !== 'string') {
            console.warn(`Warning: ${side} of "${templateName}" in "${modelName}" is not a string, skipping`);
            continue;
          }
          const file = `${sanitizeName(templateName)} - ${side}.html`;
          await fs.writeFile(path.join(modelDir, file), data[side]);
          console.log(`  → ${file}`);
        }
      }

      const styling = await modelStyling(modelName);
      if (typeof styling.css === 'string') {
        await fs.writeFile(path.join(modelDir, 'style.css'), styling.css);
        console.log('  → style.css');
      } else {
        console.warn(`Warning: CSS for model "${modelName}" is not a string, skipping`);
      }
    }

    const rel = path.relative(paths.root, outRoot);
    console.log(`\nPulled ${models.length} model(s) into ${rel}/ (for comparison only; Card Templates/ untouched)`);
  } catch (err) {
    console.error('Pull failed:', err.message);
    process.exit(1);
  }
}

pull();
