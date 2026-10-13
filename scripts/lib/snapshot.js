const fs = require('fs').promises;
const path = require('path');
const { modelTemplates, modelStyling } = require('./ankiconnect');
const { paths, ensureDir, timestamp, git } = require('./util');

/**
 * Snapshot current Anki templates + CSS for the given models into
 * backups/<timestamp>/. Returns { dir, name } (name = timestamp).
 */
async function snapshotModels(models) {
  const name = timestamp();
  const dir = path.join(paths.backups, name);
  await ensureDir(dir);

  for (const modelName of models) {
    console.log(`Backing up model: ${modelName}`);
    const modelDir = path.join(dir, modelName);
    await ensureDir(modelDir);
    const templates = await modelTemplates(modelName);
    await fs.writeFile(path.join(modelDir, 'templates.json'), JSON.stringify(templates, null, 2));
    const styling = await modelStyling(modelName);
    await fs.writeFile(path.join(modelDir, 'style.css'), styling.css);
  }

  let gitCommit = 'unknown';
  let gitDirty = null;
  try {
    gitCommit = git(['rev-parse', 'HEAD']).trim();
    gitDirty = git(['status', '--porcelain']).trim().length > 0;
  } catch {
    // not a git checkout
  }
  const manifest = { timestamp: name, models, nodeVersion: process.version, gitCommit, gitDirty };
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { dir, name };
}

module.exports = { snapshotModels };
