// Runs the real scripts against a stub AnkiConnect server. Never touches a live Anki.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const SCRIPTS = path.join(__dirname, '..');
let server, url, tmp, anki, writes, ignoreWrites;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { action, params } = JSON.parse(body);
      let result = null;
      let error = null;
      if (action === 'version') result = 6;
      else if (action === 'modelNames') result = Object.keys(anki);
      else if (action === 'modelTemplates') result = anki[params.modelName].templates;
      else if (action === 'modelStyling') result = { css: anki[params.modelName].css };
      else if (action === 'modelFieldNames') result = ['Front'];
      else if (action === 'updateModelTemplates') {
        writes.push(action);
        if (!ignoreWrites) Object.assign(anki[params.model.name].templates, params.model.templates);
      } else if (action === 'updateModelStyling') {
        writes.push(action);
        if (!ignoreWrites) anki[params.model.name].css = params.model.css;
      } else error = `unknown action ${action}`;
      res.end(JSON.stringify({ result, error }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-test-'));
  writes = [];
  ignoreWrites = false;
  anki = { M: { templates: { T1: { Front: 'old f', Back: 'old b' } }, css: '.old{}' } };
  const dist = path.join(tmp, 'dist', 'M');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(dist, 'style.css'), '.new{}');
  fs.writeFileSync(path.join(dist, 'T1 - Front.html'), 'new f');
  fs.writeFileSync(path.join(dist, 'T1 - Back.html'), 'new b');
});

const distFile = (f) => path.join(tmp, 'dist', 'M', f);
const state = () => path.join(tmp, 'state.json');

function run(script, args = []) {
  const env = {
    ...process.env,
    ANKICONNECT_URL: url,
    ANKI_DIST_DIR: path.join(tmp, 'dist'),
    ANKI_BACKUPS_DIR: path.join(tmp, 'backups'),
    ANKI_PULLED_DIR: path.join(tmp, 'pulled'),
    ANKI_STATE_FILE: state(),
  };
  return new Promise((resolve) =>
    execFile('node', [path.join(SCRIPTS, script), ...args], { env }, (err, stdout, stderr) =>
      resolve({ code: err ? err.code : 0, out: stdout + stderr })
    )
  );
}

test('deploy: backs up, writes, verifies, records state', async () => {
  const r = await run('anki-deploy.js', ['--no-confirm']);
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /first run/);
  assert.strictEqual(anki.M.css, '.new{}');
  assert.strictEqual(anki.M.templates.T1.Front, 'new f');
  const [b] = fs.readdirSync(path.join(tmp, 'backups'));
  assert.match(b, /^\d{8}-\d{6}$/);
  assert.strictEqual(fs.readFileSync(path.join(tmp, 'backups', b, 'M', 'style.css'), 'utf8'), '.old{}');
  assert.ok(JSON.parse(fs.readFileSync(state(), 'utf8')).M);
});

test('deploy: blocks when Anki was edited since last deploy, --force overrides', async () => {
  await run('anki-deploy.js', ['--no-confirm']);
  anki.M.templates.T1.Front = 'edited in anki';
  fs.writeFileSync(distFile('T1 - Front.html'), 'newer f');
  writes = [];
  let r = await run('anki-deploy.js', ['--no-confirm']);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /T1 \/ Front/);
  assert.strictEqual(writes.length, 0);
  r = await run('anki-deploy.js', ['--no-confirm', '--force']);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(anki.M.templates.T1.Front, 'newer f');
});

test('deploy: hard errors write nothing', async () => {
  fs.writeFileSync(distFile('style.css'), '');
  let r = await run('anki-deploy.js', ['--no-confirm']);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /style\.css/);

  fs.writeFileSync(distFile('style.css'), '.x{}');
  fs.writeFileSync(distFile('Nope - Front.html'), 'x');
  fs.writeFileSync(distFile('Nope - Back.html'), 'x');
  r = await run('anki-deploy.js', ['--no-confirm']);
  assert.match(r.out, /"Nope" does not exist in Anki. Valid names: T1/);

  fs.rmSync(distFile('Nope - Front.html'));
  fs.rmSync(distFile('Nope - Back.html'));
  fs.writeFileSync(distFile('T1 - Back.html'), '  ');
  r = await run('anki-deploy.js', ['--no-confirm']);
  assert.match(r.out, /empty Back/);
  assert.strictEqual(writes.length, 0);
});

test('deploy: verify-after-write catches silently dropped writes', async () => {
  ignoreWrites = true;
  const r = await run('anki-deploy.js', ['--no-confirm']);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /verification failed/);
  assert.match(r.out, /anki:rollback -- backups\//);
});

test('args: --model=X works, bare --model and unknown flags error', async () => {
  assert.strictEqual((await run('anki-deploy.js', ['--model=M', '--dry-run'])).code, 0);
  assert.strictEqual((await run('anki-deploy.js', ['--model'])).code, 2);
  assert.strictEqual((await run('anki-deploy.js', ['--bogus'])).code, 2);
  assert.strictEqual(writes.length, 0);
});

test('pull: writes under pulled/, never Card Templates/', async () => {
  const r = await run('anki-pull.js');
  assert.strictEqual(r.code, 0, r.out);
  const [ts] = fs.readdirSync(path.join(tmp, 'pulled'));
  assert.strictEqual(fs.readFileSync(path.join(tmp, 'pulled', ts, 'M', 'T1 - Front.html'), 'utf8'), 'old f');
});

test('rollback: restores dist models only; missing model aborts before any write', async () => {
  await run('anki-deploy.js', ['--no-confirm']);
  const [b] = fs.readdirSync(path.join(tmp, 'backups'));
  const bdir = path.join(tmp, 'backups', b);
  // backup also lists a non-dist, non-Anki model
  const mf = path.join(bdir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  manifest.models.push('Other');
  fs.writeFileSync(mf, JSON.stringify(manifest));
  fs.mkdirSync(path.join(bdir, 'Other'));
  fs.writeFileSync(path.join(bdir, 'Other', 'templates.json'), '{}');

  writes = [];
  let r = await run('anki-rollback.js', [bdir, '--model=Other', '--no-confirm']);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /not found in Anki: Other/);
  assert.strictEqual(writes.length, 0);

  r = await run('anki-rollback.js', [bdir, '--no-confirm']);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(anki.M.css, '.old{}');
  assert.strictEqual(anki.M.templates.T1.Front, 'old f');
});
