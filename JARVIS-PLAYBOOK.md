# JARVIS Playbook — the autonomous SEO operation for TPS Pro

Goal: **first page of Google for every money keyword in the Capital Region.**
This file is the doctrine: what each agent does, how often, with what guardrails,
and what only Miguel can do. Updated 2026-07-12.

## The math we operate on (verified July 2026 industry data)

Local Pack ranking weight: **GBP signals 32% · on-page 19% · reviews 16–20%
(fastest-growing factor; review recency jumped from factor #93 to #11) ·
links 15% · behavioral 8% · citations 7%.** Businesses with 50+ Google reviews
are ~266% more likely to appear in the Local Pack.

Translation for TPS Pro:
1. **On-page (19%)** — DONE. As of 2026-07-12 all 43 pages are hand-tuned and
   the autopilot guards drift. We are ahead of every tracked competitor here.
2. **GBP (32%)** — the single biggest lever, and it is NOT wired yet (needs
   Miguel's Google Business Profile access). Everything else is smaller.
3. **Reviews (16–20%)** — second biggest lever. Velocity + recency + responses.
4. **Links/citations (22% combined)** — steady background work.

## The agent fleet

| Agent | Where it runs | Cadence | Job | Guardrails |
|---|---|---|---|---|
| **SEO Autopilot** | GitHub Action → Vercel `api/seo-autopilot` | Every 6h | Audit every page of the live site repo; fix missing/weak title, description, canonical, viewport, OG, twitter, schema; commit fixes | Never fabricates meta from filenames; title band 30–65, desc 100–170; never flips noindex on `-lp`/thank-you pages; max 10 changes/run; Telegram notify |
| **Competitor Watch** | GitHub Action `competitor-watch.yml` | Weekly (Mon) | Fetch the 8 verified Albany competitors + our 5 money pages; diff titles/H1/descriptions/schema/keywords vs last snapshot; write `competitor-intel/latest-report.md`; flag keyword encroachment (especially student-turnover lane) | Read-only on the web; commits reports only to this repo; no AI, no secrets |
| **Inspector** | Site-repo Action `jarvis-inspector.yml` | Weekly (Tue) | Deep-audit all 43 pages (meta bands, broken links, schema, GA, orphans, image weight, alt text); merge Scout intel cross-repo; write `jarvis/tasks.json` ledger; post the crew's weekly report as a GitHub Issue | Read-only on pages — routes work to fixer/content/human owners |
| **Season Rotator** | Site-repo Action `jarvis-season.yml` | Monthly (1st) | Rotate the homepage seasonal strip with the Albany calendar (turns → fall renovations → winter contracts → spring make-ready) | Edits ONLY between `jarvis:season` markers; aborts if markers missing |
| **Daily Brief** | Vercel cron `api/cron/seo-daily` | 9am ET | Morning digest to Miguel | Existing |
| **GBP Poster** | `api/gbp-post` + `gbp-post-queue.json` | Queued | Publish Google Business Profile posts | **BLOCKED: needs GBP OAuth (Miguel)** |
| **Review Responder** | repo `Review-Responder` | — | Auto-draft responses to Google reviews | **BLOCKED: needs GBP OAuth (Miguel)** |
| **Content Machine** | repo `Content-Machine` / `api/publish-blog` | Monthly target | Draft city/service blog content for keyword gaps | Policy: drafts as PRs, never auto-publish copy |

## Standing weekly loop

1. **Mon** — Scout (Competitor Watch) runs → intel lands in `competitor-intel/`.
2. **Tue** — Inspector audits the site + merges Scout intel → task ledger updated → weekly report posted as a GitHub Issue on the site repo (Miguel gets notified).
3. **Continuous** — Fixer (Autopilot) guards on-page drift every 6 hours; meta findings in the ledger clear on its next pass.
4. **Monthly (1st)** — Rotator swaps the homepage seasonal banner.
5. **When intel flags encroachment** (e.g. a competitor starts targeting
   "student turnover cleaning") → the Inspector marks it HIGH in the Issue:
   strengthen that page's content, consider a supporting blog post, check
   their GBP activity manually.
6. **Miguel's 15-minute weekly ritual** (until GBP/reviews are API-wired):
   - Ask 2–3 finished customers for a Google review (use
     `seo-strategy/review-request-sequence.md` templates). Respond to every
     new review same-week — recency and response rate are ranked factors.
   - Post once to Google Business Profile (photo of real work + one line +
     link to a service page).

## What only Miguel can unlock (in priority order)

1. **Google Business Profile access** → unlocks the 32% bucket: GBP Poster,
   Review Responder, Q&A seeding, photo pipeline. Highest ROI of anything left.
2. **Google Search Console API credentials** → dashboard shows real rankings;
   agents get feedback on what's actually moving (closes the loop from
   "we changed X" to "position improved/fell").
3. **Vercel login** → verify `ANTHROPIC_API_KEY` is set so autopilot's
   AI-written meta actually engages (the June "Index Services" incident is
   consistent with the key missing/failing and templates taking over).
4. **Townsquare Media call** → release totalpropertysolutionspro.com, then
   301 it to totalpropertysolution.net (consolidates split authority).
5. **Cloudflare login** → first-party form endpoint (Worker) so leads also
   land in the dashboard `/leads` pipeline, not only the inbox.

## Rules of engagement (all agents)

- **Meta is fixable, copy is sacred**: agents may adjust tags and structure;
  body copy changes ship as PRs for human review.
- **Never touch**: forms' destination address, the thank-you page's noindex,
  hand-written titles inside the safe bands, anything under `images/work/`.
- **Every autonomous commit must be attributable** (JARVIS Agent author,
  descriptive message) and **reversible** (single-purpose commits).
- **Silence is success**: a clean run that changes nothing reports nothing.
- **🔒 Never expose secrets to the browser**: `JARVIS_ACTION_TOKEN` gates every
  write (site commits, blog, GBP). NEVER return it from a public endpoint. The
  dashboard has no login yet, so any endpoint that hands it out (e.g. `/api/init`)
  gives the whole internet full write access to the live site. Enter it manually
  until the Clerk login is live; then gate token delivery behind the signed-in
  session. **Do not re-open `/api/init` token serving.**

## 🔒 Security & agent coordination (Phoebe / OpenClaw ↔ Claude Code)

Two autonomous agents now share this repo — coordinate through it (commits + this file).

- **Incident 2026-07-13:** `api/init` shipped returning `JARVIS_ACTION_TOKEN` in
  plaintext to any anonymous visitor ("obscure URL" ≠ auth). Combined with the
  login-less dashboard, that publicly exposed full write access to the live site.
  **Closed** — `api/init` neutered (403, no token); token reverts to manual entry.
  **Do not reintroduce.**
- **Vercel token:** the "no-expiry, full-account-access" token minted from Chrome
  is a standing risk — replace with a scoped/expiring one and delete the old one.
- **Permanent fix:** enable the Clerk login (`VITE_CLERK_PUBLISHABLE_KEY`); after
  that, token delivery can be safely automated for the signed-in owner only, and
  `/api/init` may return the token *only* behind a verified session.
