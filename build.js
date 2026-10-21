#!/usr/bin/env node
/*
 * Builds index.html: the whole Daybook app, encrypted with a password you choose.
 * The site only shows a password box until the right password decrypts the app in the browser (AES-256-GCM, PBKDF2-SHA256).
 *
 *   node build.js                 asks for the password in a hidden macOS dialog
 *   node build.js --out FILE      writes somewhere else (default: index.html next to this file)
 *   DAYBOOK_PASSWORD=... node build.js   non-interactive (testing only: the password lands in shell history)
 *
 * Inputs (kept out of git): ../hibi.html (the app) and seed.json (Real Madrid + F1 data).
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process');
const outArg = process.argv.indexOf('--out'), OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(__dirname, 'index.html');
const ITER = 300000;

function ask(msg) {
  const r = spawnSync('osascript', ['-e', `text returned of (display dialog "${msg}" default answer "" with hidden answer with title "Daybook" buttons {"Cancel","OK"} default button "OK")`], { encoding: 'utf8' });
  if (r.status !== 0) { console.error('Cancelled.'); process.exit(1); }
  return r.stdout.replace(/\r?\n$/, '');
}
let pw = process.env.DAYBOOK_PASSWORD;
if (!pw) { pw = ask('Choose a password for your Daybook website (at least 10 characters):'); if (ask('Type it again to confirm:') !== pw) { console.error('Passwords did not match.'); process.exit(1); } }
if (pw.length < 10) { console.error('Use at least 10 characters.'); process.exit(1); }

const app = fs.readFileSync(path.join(__dirname, '..', 'hibi.html'), 'utf8').replace(/^\s*<title>[^<]*<\/title>\s*/, '');
const seed = fs.existsSync(path.join(__dirname, 'seed.json')) ? fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8') : '{"feeds":[]}';
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Daybook</title></head><body>
<script>window.DAYBOOK_SEED=${seed.replace(/</g, '\\u003c')};</script>
${app}
<script>(() => { const f = document.querySelector('.foot'); if (!f) return; const b = document.createElement('button'); b.className = 'pill'; b.textContent = 'Lock'; b.title = 'Ask for the password again'; b.onclick = () => { try { sessionStorage.removeItem('dbk'); } catch {} location.reload(); }; f.appendChild(b); })();</script>
</body></html>`;

const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256');
const c = crypto.createCipheriv('aes-256-gcm', key, iv);
const data = Buffer.concat([c.update(page, 'utf8'), c.final(), c.getAuthTag()]);
const payload = { s: salt.toString('base64'), v: iv.toString('base64'), i: ITER, d: data.toString('base64') };

const gate = fs.readFileSync(path.join(__dirname, 'gate.html'), 'utf8').replace('__PAYLOAD__', JSON.stringify(payload));
fs.writeFileSync(OUT, gate);
console.log(`Wrote ${OUT} (${(gate.length / 1024).toFixed(0)} KB, encrypted).`);
