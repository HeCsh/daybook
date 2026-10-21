# Daybook (password protected)

The whole Daybook app, encrypted. Visiting the site shows a password box; the right password decrypts and opens the app
in the browser. Nothing readable is stored in this repo: `index.html` is a small gate page plus an encrypted blob
(AES-256-GCM, key from PBKDF2-SHA256, 300k rounds).

Your data (to-dos, workouts, logs) is saved in the browser you use, so it does not sync between devices.
Real Madrid and F1 info is a snapshot baked in at build time.

## Rebuild after changing the app or refreshing the data
```
cd daybook-site
node build.js        # a hidden dialog asks for the password
git add index.html && git commit -m "Rebuild" && git push
```
`build.js` reads `../hibi.html` (the app) and `seed.json` (Real Madrid + F1 data). Both stay on your Mac and are git-ignored.
A weak password can be guessed offline, so use something long.
