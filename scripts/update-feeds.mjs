#!/usr/bin/env node
/*
 * Refreshes feeds.json: Real Madrid results and fixtures (ESPN) and F1 standings and calendar (Jolpica, the Ergast successor).
 * Both sources are free and need no key. The Daybook reads feeds.json and puts every fixture and race on the calendar by itself.
 * If one source is down, the previous data for it is kept, so a bad run never blanks the page.
 *
 *   node scripts/update-feeds.mjs          (Node 18+)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'feeds.json');
const TZ = 'America/Los_Angeles';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const RM_ID = '86';
const COACH = 'José Mourinho'; // not in any free feed; edit here when it changes

const get = async url => { const r = await fetch(url, { headers: { 'user-agent': 'daybook-feeds' } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };
const fmt = (d, o) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...o }).format(d);
const ymd = d => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const clock = d => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value])); return `${p.hour === '24' ? '00' : p.hour.padStart(2, '0')}:${p.minute} PT`; };
const today = new Date();

/* ---------------- Real Madrid ---------------- */
const COMP = { 'esp.1': 'La Liga', 'uefa.champions': 'Champions League', 'esp.copa_del_rey': 'Copa del Rey', 'esp.super_cup': 'Supercopa', 'uefa.super_cup': 'UEFA Super Cup', 'fifa.cwc': 'Club World Cup', 'fifa.intercontinental.cup': 'Intercontinental Cup' };
const compOf = (ev, opp) => { const slug = ev.league?.slug || ''; let c = COMP[slug] || ev.league?.name || ev.seasonType?.name || 'Match';
  if (slug === 'esp.1' && /^barcelona$/i.test(opp)) c += ' · El Clásico'; return c; };
const sides = ev => { const cs = ev.competitions[0].competitors, me = cs.find(c => c.team.id === RM_ID), op = cs.find(c => c.team.id !== RM_ID);
  const home = cs.find(c => c.homeAway === 'home'), away = cs.find(c => c.homeAway === 'away');
  return { me, op, home, away }; };
const score = c => { const s = c.score; return typeof s === 'object' ? Number(s?.value ?? s?.displayValue ?? 0) : Number(s ?? 0); };

async function scorers(eventId) {
  try {
    const d = await get(`${ESPN}/all/summary?event=${eventId}`), by = new Map();
    for (const k of d.keyEvents || []) {
      if (!k.scoringPlay) continue;
      const kind = k.type?.text || '', own = /own/i.test(kind), mine = k.team?.displayName === 'Real Madrid';
      if (own ? mine : !mine) continue; // own goals are credited to the other team
      const full = (k.participants?.[0]?.athlete?.displayName || '').trim(); if (!full) continue;
      const name = own ? `${full.split(' ').slice(-1)[0]} (og)` : full.split(' ').slice(-1)[0];
      const min = (k.clock?.displayValue || '').replace(/\s/g, '') + (/pen/i.test(kind) ? ' pen' : '');
      by.set(name, [...(by.get(name) || []), min]);
    }
    return [...by].map(([n, m]) => `${n} ${m.join(', ')}`).join(', ');
  } catch { return ''; }
}

async function realMadrid() {
  const [past, fut, liga, ucl] = await Promise.all([
    get(`${ESPN}/all/teams/${RM_ID}/schedule`), get(`${ESPN}/all/teams/${RM_ID}/schedule?fixture=true`),
    get('https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings'), get('https://site.api.espn.com/apis/v2/sports/soccer/uefa.champions/standings')]);
  const real = ev => !/friendly/i.test(ev.league?.slug || '') && !/friendly/i.test(ev.seasonType?.name || '');
  const done = (past.events || []).filter(ev => real(ev) && /FULL_TIME|FINAL|AET|PEN/i.test(ev.competitions[0].status?.type?.name || '')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recent = [];
  for (const ev of done) { const { home, away, op } = sides(ev), when = new Date(ev.date);
    recent.push({ date: ymd(when), home: home.team.displayName, away: away.team.displayName, hs: score(home), as: score(away), comp: compOf(ev, op.team.displayName), scorers: await scorers(ev.id) }); }
  const upcoming = (fut.events || []).filter(ev => real(ev) && !/FULL_TIME|FINAL|IN_PROGRESS|POSTPONED|CANCEL/i.test(ev.competitions[0].status?.type?.name || ''))
    .sort((a, b) => a.date.localeCompare(b.date)).map(ev => { const { home, away, op } = sides(ev), when = new Date(ev.date);
      return { date: ymd(when), time: ev.timeValid === false ? '' : clock(when), home: home.team.displayName, away: away.team.displayName, comp: compOf(ev, op.team.displayName) }; });
  const stat = (e, n) => e.stats.find(s => s.name === n)?.value;
  const entries = (liga.children?.[0]?.standings?.entries || []).map(e => ({ pos: stat(e, 'rank'), team: e.team.displayName, points: stat(e, 'points'), played: stat(e, 'gamesPlayed') })).sort((a, b) => a.pos - b.pos);
  const me = entries.find(e => e.team === 'Real Madrid'), ue = (ucl.children?.[0]?.standings?.entries || []).find(e => e.team.displayName === 'Real Madrid');
  return { id: 'realmadrid', asOf: fmt(today, { month: 'short', day: 'numeric', year: 'numeric' }), coach: COACH,
    liga: { pos: me?.pos, points: me?.points, played: me?.played, top5: entries.slice(0, 5).map(({ pos, team, points }) => ({ pos, team, points })) },
    ...(ue ? { ucl: { pos: stat(ue, 'rank'), points: stat(ue, 'points') } } : {}), recent, upcoming, updated: today.toISOString() };
}

/* ---------------- Formula 1 ---------------- */
const TEAM = { 'Red Bull': 'Red Bull Racing', 'RB F1 Team': 'Racing Bulls', 'Alpine F1 Team': 'Alpine', 'Haas F1 Team': 'Haas', 'Cadillac F1 Team': 'Cadillac', 'Aston Martin': 'Aston Martin', 'Sauber': 'Audi', 'Kick Sauber': 'Audi' };
const team = n => TEAM[n] || n;

async function f1() {
  const J = 'https://api.jolpi.ca/ergast/f1/current';
  const [ds, cs, last, sched] = await Promise.all([get(`${J}/driverStandings.json`), get(`${J}/constructorStandings.json`), get(`${J}/last/results.json`), get(`${J}.json?limit=40`)]);
  const dl = ds.MRData.StandingsTable.StandingsLists[0], cl = cs.MRData.StandingsTable.StandingsLists[0], lr = last.MRData.RaceTable.Races[0], races = sched.MRData.RaceTable.Races;
  const lastDate = lr.date, short = n => n.replace(' Grand Prix', ' GP');
  const md = new Date(lastDate + 'T12:00:00Z');
  return { id: 'f1', asOf: `after the ${short(lr.raceName)} (${md.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })})`,
    round: Number(dl.round), totalRounds: races.length,
    drivers: dl.DriverStandings.map(d => ({ pos: Number(d.position), name: `${d.Driver.givenName} ${d.Driver.familyName}`, team: team(d.Constructors[0]?.name || ''), points: Number(d.points) })),
    constructors: cl.ConstructorStandings.map(c => ({ pos: Number(c.position), team: team(c.Constructor.name), points: Number(c.points) })),
    lastRace: { name: lr.raceName, date: lastDate, podium: lr.Results.slice(0, 3).map(r => `${r.Driver.givenName} ${r.Driver.familyName} · ${team(r.Constructor.name)}`) },
    completed: races.filter(r => r.date <= lastDate).map(r => ({ date: r.date, name: r.raceName, place: `${r.Circuit.circuitName}, ${r.Circuit.Location.locality}`, sprint: !!r.Sprint })),
    upcoming: races.filter(r => r.date > lastDate).map(r => ({ date: r.date, name: r.raceName, place: `${r.Circuit.circuitName}, ${r.Circuit.Location.locality}`, sprint: !!r.Sprint })),
    updated: today.toISOString() };
}

/* ---------------- run ---------------- */
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { feeds: [] };
const keep = id => prev.feeds.find(f => f.id === id);
const feeds = [];
let failed = 0;
for (const [id, fn] of [['realmadrid', realMadrid], ['f1', f1]]) {
  try { feeds.push(await fn()); console.log(`${id}: updated`); }
  catch (e) { failed++; console.error(`${id}: FAILED (${e.message}); keeping the previous data`); if (keep(id)) feeds.push(keep(id)); }
}
/* write only when the data (not just the timestamps) changed, so the repo history stays quiet */
const strip = f => JSON.stringify(f, (k, v) => (k === 'updated' || k === 'asOf' && false) ? undefined : v);
const same = JSON.stringify(prev.feeds.map(strip)) === JSON.stringify(feeds.map(strip));
if (!same || !fs.existsSync(OUT)) { fs.writeFileSync(OUT, JSON.stringify({ updated: today.toISOString(), feeds }, null, 1) + '\n'); console.log('feeds.json written'); }
else console.log('no change');
if (failed === 2) process.exit(1);
