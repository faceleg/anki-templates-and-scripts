#!/usr/bin/env node

const { checkConnection, modelNames } = require('./lib/ankiconnect');
const { snapshotModels } = require('./lib/snapshot');
const { parseCli } = require('./lib/util');

async function backup() {
  parseCli({});
  try {
    await checkConnection();
    const models = await modelNames();
    console.log(`Found ${models.length} model(s): ${models.join(', ')}`);
    const { name } = await snapshotModels(models);
    console.log(`\nBackup saved to backups/${name} (gitignored, local only).`);
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

backup();
