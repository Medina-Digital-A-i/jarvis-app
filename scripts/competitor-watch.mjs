#!/usr/bin/env node
// scripts/competitor-watch.mjs
// JARVIS agent: Competitor Watch
//
// Autonomous, credential-free. Runs weekly in GitHub Actions. Fetches the
// verified Albany/Capital Region competitor set + TPS Pro's own money pages,
// extracts on-page SEO signals, diffs against the last snapshot, and writes
// a human-readable intel report + machine snapshot into competitor-intel/.
// The Action commits the result, so every report is versioned history.
//
// Deliberately deterministic: no AI calls, no secrets, nothing to expire.
// Signal extraction is string-level (same spirit as seo-autopilot).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT_DIR = 'competitor-intel';
const SNAPSHOT = `${OUT_DIR}/snapshot.json`;
const REPORT = `${OUT_DIR}/latest-report.md`;

// Verified competitive set (2026-07-12 deep-research run: 23 claims, 3-0 verified)
const COMPETITORS = [
  { id: 'mcw', name: 'MCW Janitorial', url: 'https://mcwjanitorial.com/' },
  { id: 'cleantec', name: 'Cleantec (Albany page)', url: 'https://www.cleantec.us/service-areas/albany/' },
  { id: 'janpro', name: 'JAN-PRO Capital District', url: 'https://jan-pro.com/capitaldistrict/' },
  { id: 'cleanmethod', name: 'Clean Method (Albany page)', url: 'https://cleanmethod.com/near-me/new-york/albany/' },
  { id: 'daigle', name: 'Daigle Cleaning Systems', url: 'https://daigleclean.com/' },
  { id: 'martinez', name: 'Martinez Cleaning (post-construction)', url: 'https://www.martinezcleaningllc.com/services/post-construction-cleaning/' },
  { id: 'abm', name: 'ABM Albany', url: 'https://locations.abm.com/ny/albany/' },
  { id: 'olsens', name: "Olsen's Property Maintenance", url: 'https://olsensproperty.com/commercial/' },
];

// Our own money pages — tracked with the same instruments so the report
// always shows TPS vs the field on identical metrics.
const SELF = [
  { id: 'tps-home', name: 'TPS Pro — Home', url: 'https://totalpropertysolution.net/' },
  { id: 'tps-student', name: 'TPS Pro — Student Turnovers', url: 'https://totalpropertysolution.net/student-turnover-cleaning.html' },
  { id: 'tps-commercial', name: 'TPS Pro — Commercial Cleaning', url: 'https://totalpropertysolution.net/commercial-cleaning-albany-ny.html' },
  { id: 'tps-postcon', name: 'TPS Pro — Post-Construction', url: 'https://totalpropertysolution.net/post-construction-cleaning.html' },
  { id: 'tps-pm', name: 'TPS Pro — Property Management', url: 'https://totalpropertysolution.net/property-management.html' },
];

// If a competitor page starts using these, that's encroachment on lanes we own
// (student turnover is uncontested in this market as of the July 2026 study —
// we want to know the day that changes).
const WATCH_KEYWORDS = [
  'student turnover',
  'student housing turn',
  'student turn',
  'rental turnover',
  'turnover ticket',
  'property management',
  'renovation',
  'one contract',
];

const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
const strip = (s) => unesc(s.replace(/\s+/g, ' ').trim());
const get = (html, rx) => {
  const m = html.match(rx);
  return m ? strip(m[1]) : null;
};

async function inspect({ id, name, url }) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; JARVIS-competitor-watch/1.0)' },
    });
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase();
    const schemaTypes = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    return {
      id, name, url,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - t0,
      title: get(html, /<title[^>]*>([^<]*)<\/title>/i),
      description: (html.match(/<meta[^>]+name=["']description["'][^>]+content=("|')([\s\S]*?)\1/i) || [])[2]?.replace(/\s+/g, ' ').trim().replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'") || null,
      h1: get(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, '').trim() || null,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      hasTelLink: /href=["']tel:/i.test(html),
      hasForm: /<form[\s>]/i.test(html),
      schemaTypes: [...new Set(schemaTypes)].sort(),
      keywordHits: WATCH_KEYWORDS.filter((k) => text.includes(k)),
    };
  } catch (e) {
    return { id, name, url, ok: false, status: 0, ms: Date.now() - t0, error: String(e && e.message || e) };
  }
}

function diffEntry(prev, cur) {
  if (!prev) return ['first observation'];
  const notes = [];
  for (const f of ['title', 'description', 'h1']) {
    if ((prev[f] || null) !== (cur[f] || null)) notes.push(`${f} changed:\n    - was: ${prev[f] ?? '(none)'}\n    - now: ${cur[f] ?? '(none)'}`);
  }
  const prevKw = new Set(prev.keywordHits || []);
  const newKw = (cur.keywordHits || []).filter((k) => !prevKw.has(k));
  if (newKw.length) notes.push(`⚠️ NEW WATCH-KEYWORD USE: ${newKw.join(', ')}`);
  const prevSchema = new Set(prev.schemaTypes || []);
  const newSchema = (cur.schemaTypes || []).filter((s) => !prevSchema.has(s));
  if (newSchema.length) notes.push(`new schema types: ${newSchema.join(', ')}`);
  if (prev.ok && !cur.ok) notes.push(`site DOWN or blocked (status ${cur.status})`);
  return notes;
}

const pct = (arr, f) => arr.length ? Math.round((arr.filter(f).length / arr.length) * 100) : 0;

async function main() {
  const targets = [...SELF, ...COMPETITORS];
  const results = [];
  for (const t of targets) {
    results.push(await inspect(t));
    await new Promise((r) => setTimeout(r, 800)); // be polite
  }

  let prev = {};
  if (existsSync(SNAPSHOT)) {
    try { prev = JSON.parse(await readFile(SNAPSHOT, 'utf8')).pages || {}; } catch {}
  }

  const now = new Date().toISOString();
  const self = results.filter((r) => r.id.startsWith('tps-'));
  const field = results.filter((r) => !r.id.startsWith('tps-') && r.ok);

  const lines = [];
  lines.push(`# JARVIS Competitor Watch — ${now.slice(0, 10)}`);
  lines.push('');
  lines.push(`Tracked: ${COMPETITORS.length} competitors + ${SELF.length} TPS pages · generated ${now}`);
  lines.push('');

  // 1) changes since last run
  lines.push('## Changes since last run');
  let anyChange = false;
  for (const r of results) {
    const notes = diffEntry(prev[r.id], r);
    if (notes.length && notes[0] !== 'first observation') {
      anyChange = true;
      lines.push(`### ${r.name}`);
      for (const n of notes) lines.push(`- ${n}`);
      lines.push('');
    }
  }
  if (!anyChange) lines.push('_No changes detected across the tracked set._', '');

  // 2) encroachment board
  lines.push('## Keyword encroachment board');
  lines.push('');
  lines.push('| Competitor | Watch keywords found on tracked page |');
  lines.push('|---|---|');
  for (const r of field) lines.push(`| ${r.name} | ${(r.keywordHits || []).join(', ') || '—'} |`);
  lines.push('');
  const studentThreat = field.filter((r) => (r.keywordHits || []).some((k) => k.startsWith('student')));
  lines.push(studentThreat.length
    ? `**⚠️ ${studentThreat.length} competitor(s) now mention student-turn keywords: ${studentThreat.map((r) => r.name).join(', ')} — review their pages.**`
    : '**✅ Student-turnover lane still uncontested on tracked pages.**');
  lines.push('');

  // 3) scorecard
  lines.push('## Scorecard — TPS vs the field');
  lines.push('');
  lines.push('| Metric | TPS Pro (avg of money pages) | Field (avg of reachable competitors) |');
  lines.push('|---|---|---|');
  const avg = (arr, f) => arr.length ? Math.round(arr.reduce((a, r) => a + (f(r) || 0), 0) / arr.length) : 0;
  lines.push(`| Word count | ${avg(self, (r) => r.wordCount)} | ${avg(field, (r) => r.wordCount)} |`);
  lines.push(`| Has tel: click-to-call | ${pct(self, (r) => r.hasTelLink)}% | ${pct(field, (r) => r.hasTelLink)}% |`);
  lines.push(`| Has lead form | ${pct(self, (r) => r.hasForm)}% | ${pct(field, (r) => r.hasForm)}% |`);
  lines.push(`| Schema types per page | ${avg(self, (r) => (r.schemaTypes || []).length)} | ${avg(field, (r) => (r.schemaTypes || []).length)} |`);
  lines.push('');

  // 4) raw table
  lines.push('## Tracked pages (raw)');
  lines.push('');
  for (const r of results) {
    lines.push(`### ${r.name}`);
    lines.push(`- url: ${r.url}`);
    if (!r.ok) { lines.push(`- ❌ unreachable (status ${r.status}${r.error ? `, ${r.error}` : ''})`, ''); continue; }
    lines.push(`- title (${(r.title || '').length} ch): ${r.title ?? '(none)'}`);
    lines.push(`- h1: ${r.h1 ?? '(none)'}`);
    lines.push(`- description (${(r.description || '').length} ch): ${r.description ?? '(none)'}`);
    lines.push(`- words ~${r.wordCount} · tel:${r.hasTelLink ? 'yes' : 'NO'} · form:${r.hasForm ? 'yes' : 'NO'} · schema: ${(r.schemaTypes || []).join(', ') || 'none'}`);
    lines.push('');
  }

  await mkdir(OUT_DIR, { recursive: true });
  const pages = {};
  for (const r of results) pages[r.id] = r;
  await writeFile(SNAPSHOT, JSON.stringify({ generatedAt: now, pages }, null, 2));
  await writeFile(REPORT, lines.join('\n'));
  // also keep a dated copy so history reads without git archaeology
  await writeFile(`${OUT_DIR}/report-${now.slice(0, 10)}.md`, lines.join('\n'));

  console.log(`competitor-watch: ${results.filter((r) => r.ok).length}/${results.length} pages inspected, report written`);
  if (anyChange) console.log('CHANGES DETECTED — see latest-report.md');
}

main().catch((e) => { console.error(e); process.exit(1); });
