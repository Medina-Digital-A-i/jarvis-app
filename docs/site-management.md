# JARVIS Site Management — Autonomous SEO Ops

JARVIS's autonomous "keep the site ranking and relevant" layer for TPS Pro
(and, where applicable, Pour Decisions). Five recurring jobs run as **Anthropic
Routines** (provisioned in the browser at `claude.ai/code/routines`); each
Routine POSTs/GETs a Jarvis API route, which generates the content, persists it,
and — for drafts — waits for Miguel's approval before anything goes live.

> This doc covers **Jarvis's side**. Creating the Routines themselves is
> browser-side work (biometric-gated) and is done separately.

## Architecture at a glance

```
Anthropic Routine (cron)  ──HTTP──▶  /api/routine/<job>   (Vercel serverless, Haiku 4.5)
                                          │
                                          ├─▶ generate content (prompt caching ON)
                                          ├─▶ append to public/site-management.json  (JARVIS repo, GitHub)
                                          │        └─▶ served at /site-management.json ─▶ /site-management dashboard page
                                          ├─▶ return { markdown, localPath }  ─▶ Routine writes ~/Documents mirror copy
                                          └─▶ Telegram ping "reply APPROVE"  (blog/GBP drafts only)

Miguel replies APPROVE  ─▶ Phoebe/Routine ─▶ POST /api/routine/blog-publish { id }
                                                   ├─ killswitch check
                                                   └─ forwards to /api/publish-blog ─▶ commits blog-<slug>.html ─▶ Pages redeploy
```

**Why GitHub, not local disk:** Vercel functions have an ephemeral, read-only
filesystem, so they can't write to Miguel's Mac. The durable, dashboard-readable
store is a JSON file committed to the JARVIS repo under `public/` (same pattern as
`agent-log.json`). Each route also returns the full `markdown` + a suggested
`localPath`, so the Routine can drop a local mirror into
`~/Documents/Businesses/TPS/07-Marketing-Web/`.

## The five jobs

| # | Job | Route | Method | Suggested schedule | Publishes? |
|---|---|---|---|---|---|
| 1 | Weekly blog draft | `/api/routine/blog-draft` | POST | Mon 6 AM ET | No — queues for approval |
| 2 | GBP post draft | `/api/routine/gbp-draft` | POST | Tue + Fri 9 AM ET | No — queues for approval |
| 3 | Rank + CTR report | `/api/routine/rank-report` | GET | Fri 5 PM ET | No — read-only report |
| 4 | Citation audit | `/api/routine/citation-audit` | GET/POST | 1st of month | No — read-only report |
| 5 | Competitor scan | `/api/routine/competitor-scan` | GET/POST | Sun 10 PM ET | No — read-only report |
| + | **Blog publish (approval gate)** | `/api/routine/blog-publish` | POST | on APPROVE only | **Yes** |

All routes are gated by `x-jarvis-token: <JARVIS_ACTION_TOKEN>` (GET routes also
accept `?token=`). Every route accepts `dryRun` (query or body) to generate +
return **without** persisting or notifying — safe for testing.

### Model & cost
All routes default to **Haiku 4.5** (`JARVIS_ROUTINE_MODEL`), decoupled from the
AI Editor's model. System prompts are marked `cache_control: ephemeral`, so the
static instructions are cached (keeps the ~96% hit rate). Escalate a specific job
to Sonnet only if it needs real reasoning.

## Job details

### 1. `POST /api/routine/blog-draft`
Body: `{ topic?, site?, dryRun? }`. Generates title + SEO meta + HTML article body,
queues it as `draft_awaiting_approval`, pings Telegram. If `topic` is omitted,
rotates through a seed list. Returns `{ id, slug, markdown, publishWith }`. No API
key → deterministic fallback draft (job never hard-fails).

### 2. `POST /api/routine/gbp-draft`
Body: `{ kind?: 'offer'|'event'|'update', prompt?, site?, dryRun? }`. Queues a GBP
post draft. **Dependency:** actually posting to GBP (`/api/gbp-post`) is blocked
until the GMB OAuth refresh token is re-authed — the response flags this. Drafting
still works.

### 3. `GET /api/routine/rank-report?site=tps&token=…`
Pulls current GSC query data via `/api/gsc-data`, diffs against the last stored
rank report to find **movers** (±3 positions) and **CTR targets** (high
impressions, low CTR), stores a Markdown report. First run has no prior week to
diff (movers appear the next run).

### 4. `GET/POST /api/routine/citation-audit`
Tracks coverage against a canonical local-directory checklist (Google, Bing, Yelp,
BBB, YellowPages, Chamber, …). POST `{ present: ["yelp","bbb"] }` marks confirmed
listings; confirmations **carry forward** between audits. Honest scope: it does not
live-scrape directories (that needs a citations data provider like Yext/BrightLocal
— a future upgrade); it reports gaps ranked by priority.

### 5. `GET/POST /api/routine/competitor-scan`
Fetches each competitor homepage (best-effort, 8s timeout), fingerprints it
(title, word count, price mentions), diffs vs the last scan, and asks Haiku for a
short threats/opportunities read. Override the list with POST `{ competitors: [...] }`.
Telegram alert fires on material changes.

## Approval → publish flow

1. `blog-draft` queues a draft (`status: draft_awaiting_approval`) and Telegrams
   Miguel with the draft `id` and "reply **APPROVE**".
2. Miguel reviews (Telegram, or the **Site Management** dashboard page) and replies
   **APPROVE**.
3. Phoebe (or the Routine) reads the approval and calls
   `POST /api/routine/blog-publish { id }` with the action token.
4. `blog-publish`:
   - **checks the killswitch** — refuses with `403 { blocked: true }` if disabled;
   - looks up the queued draft, builds the publish payload;
   - forwards to `/api/publish-blog`, which commits `blog-<slug>.html` to the site
     repo, injects a card into `blog.html`, and updates `blog-index.json` →
     GitHub Pages redeploys;
   - marks the queue item `published` and Telegrams the live URL.

Nothing reaches the live site except through this endpoint, and only after an
explicit APPROVE.

## Killswitch

Auto-publish is **ON** unless the env var is the exact string `false`.

```
# Freeze ALL publishing (drafts keep queuing):
Vercel → Settings → Environment Variables → JARVIS_AUTO_PUBLISH_ENABLED=false → Redeploy
# Re-enable:
set it back to true (or delete the var) → Redeploy
```

When disabled, `/api/routine/blog-publish` returns `403 { blocked: true, reason }`
before touching GitHub.

## Dashboard

`/site-management` (Site Management in the side nav) reads `/site-management.json`
and shows: an **Approval Queue** (drafts awaiting APPROVE) and a **Last 30 Days**
feed of all five jobs, filterable by kind, each expandable to the full Markdown.

## Environment variables

| Var | Purpose |
|---|---|
| `JARVIS_ACTION_TOKEN` | Gates every route (`x-jarvis-token` / `?token=`) |
| `ANTHROPIC_API_KEY` | AI generation (absent → deterministic fallbacks) |
| `JARVIS_ROUTINE_MODEL` | Model for these routes (default Haiku 4.5) |
| `JARVIS_AUTO_PUBLISH_ENABLED` | Killswitch — `false` freezes publishing |
| `GITHUB_TOKEN` / `JARVIS_REPO` / `GITHUB_REPO` | Persist queue + publish to site |
| `PUBLIC_BASE_URL` | Stable host for internal self-calls (gsc-data, publish-blog) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Approval pings |
| `GMB_*` / `GBP_*` | GBP posting (currently blocked on re-auth) |

## Testing

- **API type-check:** `npx tsc --noEmit -p tsconfig.api.json` (the main `tsc` only
  covers `src/`; Vercel builds `api/` separately).
- **Approval + killswitch:** driven hermetically against the real handlers with
  mock req/res and `dryRun` (no network). See the build notes for the harness.
