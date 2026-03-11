#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { checkConnection, modelNames, modelTemplates, modelStyling } = require('./lib/ankiconnect');

/**
 * Sanitize a string for use as a directory name
 * @param {string} str - The string to sanitize
 * @returns {string} The sanitized string
 */
function sanitizeFileName(str) {
  // Replace problematic characters with empty string or safe alternatives
  return str.replace(/[<>:"|?*]/g, '').trim();
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
 * Main pull function
 */
async function pull() {
  try {
    // Step 1: Parse command line arguments
    const args = process.argv.slice(2);
    let targetModel = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--model' && i + 1 < args.length) {
        targetModel = args[i + 1];
        break;
      }
    }

    // Step 2: Check connection to AnkiConnect
    console.log('Connecting to AnkiConnect...');
    await checkConnection();
    console.log('Connected to AnkiConnect\n');

    // Step 3: Reminder about backup
    console.log('Tip: Run "npm run anki:backup" before pulling if you want a backup\n');

    // Step 4: Get all model names
    let models = await modelNames();
    if (targetModel) {
      if (!models.includes(targetModel)) {
        console.error(`Error: Model "${targetModel}" not found in Anki`);
        console.error(`Available models: ${models.join(', ')}`);
        process.exit(1);
      }
      models = [targetModel];
    }

    // Step 5: For each model, pull templates and CSS
    const cardTemplatesBaseDir = path.join(process.cwd(), 'Card Templates');

    for (const modelName of models) {
      try {
        console.log(`Pulling model: ${modelName}`);

        // Create model directory
        const sanitizedName = sanitizeFileName(modelName);
        const modelDir = path.join(cardTemplatesBaseDir, sanitizedName);
        await ensureDir(modelDir);

        // Get templates
        const templates = await modelTemplates(modelName);
        const templateNames = Object.keys(templates);

        // Write front and back templates
        for (const templateName of templateNames) {
          const templateData = templates[templateName];

          // Write front template
          if (typeof templateData.Front === 'string') {
            const frontFileName = `${templateName} - Front.html`;
            const frontPath = path.join(modelDir, frontFileName);
            await fs.writeFile(frontPath, templateData.Front);
            console.log(`  → ${frontFileName}`);
          } else {
            console.warn(`Warning: Front template for "${templateName}" in model "${modelName}" is not a string, skipping`);
          }

          // Write back template
          if (typeof templateData.Back === 'string') {
            const backFileName = `${templateName} - Back.html`;
            const backPath = path.join(modelDir, backFileName);
            await fs.writeFile(backPath, templateData.Back);
            console.log(`  → ${backFileName}`);
          } else {
            console.warn(`Warning: Back template for "${templateName}" in model "${modelName}" is not a string, skipping`);
          }
        }

        // Get and write CSS
        const styling = await modelStyling(modelName);
        if (typeof styling.css === 'string') {
          const stylePath = path.join(modelDir, 'style.css');
          await fs.writeFile(stylePath, styling.css);
          console.log(`  → style.css`);
        } else {
          console.warn(`Warning: CSS for model "${modelName}" is not a string, skipping`);
        }

        console.log('');
      } catch (err) {
        console.error(`Error processing model "${modelName}":`, err.message);
        throw err;
      }
    }

    // Step 6: Print summary
    const modelCount = models.length;
    const modelLabel = modelCount === 1 ? 'model' : 'models';
    console.log(`Pulled ${modelCount} ${modelLabel} into Card Templates/`);
  } catch (err) {
    console.error('Pull failed:', err.message);
    process.exit(1);
  }
}

pull();
