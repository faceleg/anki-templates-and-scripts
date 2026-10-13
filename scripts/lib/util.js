const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseArgs } = require('util');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

// Env overrides exist so tests can run against temp dirs.
const paths = {
  root: ROOT,
  cardTemplates: path.join(ROOT, 'Card Templates'),
  dist: process.env.ANKI_DIST_DIR || path.join(ROOT, 'dist'),
  backups: process.env.ANKI_BACKUPS_DIR || path.join(ROOT, 'backups'),
  pulled: process.env.ANKI_PULLED_DIR || path.join(ROOT, 'pulled'),
  state: process.env.ANKI_STATE_FILE || path.join(ROOT, '.deploy-state.json'),
};

function ensureDir(dir) {
  return fs.promises.mkdir(dir, { recursive: true });
}

function promptConfirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/** Strict CLI parsing: unknown flags and bare `--model` exit 2 with a message. */
function parseCli(options, allowPositionals = false) {
  try {
    return parseArgs({ options, strict: true, allowPositionals });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }
}

/** Safe single path segment for model/template names. */
function sanitizeName(str) {
  return str
    .replace(/[<>:"|?*]/g, '')
    .replace(/[/\\]/g, '_')
    .trim()
    .replace(/^\.+/, '_');
}

/** Local time YYYYMMDD-HHMMSS */
function timestamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

module.exports = { ROOT, paths, ensureDir, promptConfirm, parseCli, sanitizeName, timestamp, git };
