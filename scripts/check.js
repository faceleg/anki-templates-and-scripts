#!/usr/bin/env node

// npm run check: build, fail if dist/ is stale vs git, and assert PurgeCSS kept the tone classes.

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { processCSSFile, cardTemplatesDir, distDir } = require('./build');
const { ROOT } = require('./lib/util');

const problems = [];

// 1. Build
const build = spawnSync('node', [path.join(__dirname, 'build.js')], { cwd: ROOT, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

// 2. dist/ must match what git has (tracked changes or new untracked files = stale)
const stale = spawnSync('git', ['diff', '--exit-code', '--stat', '--', 'dist/'], { cwd: ROOT, encoding: 'utf8' });
if (stale.status !== 0) problems.push(`dist/ is stale (differs from git). Commit the rebuilt output:\n${stale.stdout}`);
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'dist/'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
if (untracked) problems.push(`dist/ has untracked files:\n${untracked}`);

// 3. Tone classes must survive purge wherever they existed before it
const has = (css, cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(css);
const required = ['t1', 't2', 't3', 't4', 'tone1', 'char-tone1'];
(async () => {
  for (const model of fs.readdirSync(cardTemplatesDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const src = fs.readFileSync(path.join(cardTemplatesDir, model.name, 'style.css'), 'utf8');
    if (!has(await processCSSFile(src), 't1')) continue;
    const purged = fs.readFileSync(path.join(distDir, model.name, 'style.css'), 'utf8');
    const lost = required.filter((c) => !has(purged, c));
    if (lost.length) problems.push(`${model.name}: PurgeCSS dropped tone classes: ${lost.map((c) => '.' + c).join(', ')}`);
  }

  if (problems.length) {
    console.error(`\ncheck failed:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('check passed: dist/ is current, tone classes intact.');
})();
