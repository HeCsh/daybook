# Daybook (password protected)

The whole Daybook app, encrypted. Visiting the site shows a password box; the right password decrypts and opens the app
in the browser. Nothing readable is stored in this repo: `index.html` is a small gate page plus an encrypted blob
(AES-256-GCM, key from PBKDF2-SHA256, 300k rounds).

Your data (to-dos, workouts, logs) is saved in the browser you use, so it does not sync between devices.

## Games and races fill themselves in
A GitHub Action (`.github/workflows/update-feeds.yml`) runs every two hours and runs `scripts/update-feeds.mjs`, which pulls
Real Madrid results, scorers, table and the full fixture list (ESPN), and F1 standings, last race and the whole calendar (Jolpica).
It commits `feeds.json` when something changed. The app loads `feeds.json` each time it opens, so every Real Madrid game and F1 race
lands on the calendar with no typing. The data is public sports info, so `feeds.json` is not encrypted. To refresh by hand, open the
repo's Actions tab and run "Update feeds". The head coach's name is a constant at the top of the script.

## Rebuild after changing the app or refreshing the data
```
cd daybook-site
node build.js        # a hidden dialog asks for the password
git add index.html && git commit -m "Rebuild" && git push
```
`build.js` reads `../hibi.html` (the app) and `seed.json` (Real Madrid + F1 data). Both stay on your Mac and are git-ignored.
A weak password can be guessed offline, so use something long.
