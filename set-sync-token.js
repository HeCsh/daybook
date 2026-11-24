#!/usr/bin/env node
/* Stores the Daybook cloud-sync GitHub token in the macOS Keychain (service "daybook-sync-token").
   The token is typed into a hidden dialog, so it never lands in shell history, chat, or a file. Then run: node build.js */
const { spawnSync } = require('child_process');
const r = spawnSync('osascript', ['-e', 'text returned of (display dialog "Paste your Daybook sync token (starts with github_pat_):" default answer "" with hidden answer with title "Daybook" buttons {"Cancel","OK"} default button "OK")'], { encoding: 'utf8' });
if (r.status !== 0) { console.error('Cancelled.'); process.exit(1); }
const t = r.stdout.trim();
if (!/^github_pat_[A-Za-z0-9_]{20,}$/.test(t)) { console.error('That does not look like a fine-grained token (github_pat_...).'); process.exit(1); }
const s = spawnSync('security', ['add-generic-password', '-U', '-s', 'daybook-sync-token', '-a', 'daybook', '-w', t], { encoding: 'utf8' });
if (s.status !== 0) { console.error('Could not save to the Keychain:', s.stderr); process.exit(1); }
console.log('Saved the sync token to the Keychain.');
