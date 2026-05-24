# JARVIS — Multi-site Command Center

Phase 1 application scaffold for Miguel's businesses (TPS Pro, Pour Decisions, +).

## Stack

- React 18 + TypeScript
- Vite (dev + build)
- React Router 6
- Tailwind CSS (custom Jarvis design tokens)
- Mock data layer — swap with real API client when backend is ready

## Quick start

```bash
cd jarvis-app
npm install
npm run dev
```

Open http://localhost:5173

## Build & deploy

```bash
npm run build       # outputs to dist/
npm run preview     # preview the production build
```

**Vercel:** push this folder to a Git repo, connect to Vercel, deploy. `vercel.json` is configured. Done.

## What's wired up

**Working features:**
- Site switcher (TPS Pro ↔ Pour Decisions) — all KPIs swap live, persists in localStorage
- Live clock in top bar
- Side navigation (6 groups, 19 routes)
- Active state highlighting on nav + site switcher
- Cmd/Ctrl + K focuses the floating command bar
- Responsive layout (desktop / tablet / phone)
- Full Jarvis design system: colors, fonts, glow effects, animations

**Functional pages:**
- `/` — Dashboard (KPIs, traffic chart, live feed, integrations, agents, tasks)
- `/pages` — Pages CMS (table view of all site pages)
- `/blog` — Blog post list
- `/leads` — CRM pipeline view

**Stubs (UI placeholders, ready to implement):**
- Quick Actions, Photos, Testimonials
- Analytics, SEO & Meta, Reviews
- Google Business, Google Ads, Search Console, Calendar
- Email Campaigns, Social Media, Automations
- Settings, Integrations

Each stub shows a roadmap of what to build next, so it's easy to pick up.

## Phase 2 — what to wire next

1. **Auth** — drop in Clerk or Supabase Auth. Routes already work; just gate at the layout level.
2. **Backend** — Express + Postgres (or just Supabase). Schema sketch:
   - `users`, `sites`, `pages`, `posts`, `leads`, `reviews`, `integrations`, `agents`, `tasks`
3. **Google APIs** — replace `src/data/mock.ts` with real fetches:
   - GA4 Data API for visitor metrics
   - Business Profile API for reviews/posts
   - Search Console API for queries/rank
   - Google Ads API for campaigns
   - All authed via OAuth from Settings → Integrations
4. **Real-time activity feed** — Supabase Realtime or Pusher subscribed to `events` table
5. **Phoebe / Claude agent connectors** — webhook endpoints + bridge file watcher
6. **Deploy** — push to Vercel, set env vars for OAuth client IDs, you're live

## Project layout

```
jarvis-app/
├── public/                   # static assets (favicon)
├── src/
│   ├── App.tsx               # routes
│   ├── main.tsx              # entry
│   ├── styles.css            # Tailwind + Jarvis component classes
│   ├── layouts/
│   │   └── AppLayout.tsx     # top bar + side nav + outlet + cmd bar
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── SideNav.tsx
│   │   ├── SiteSwitcher.tsx
│   │   ├── PageHead.tsx
│   │   ├── KpiCard.tsx
│   │   ├── Panel.tsx
│   │   └── CommandBar.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx     # KPIs, chart, feed, integrations, agents, tasks
│   │   ├── Pages.tsx         # CMS list
│   │   ├── Blog.tsx          # posts list
│   │   ├── Leads.tsx         # CRM pipeline
│   │   └── Stub.tsx          # placeholder for unimplemented sections
│   ├── data/
│   │   ├── sites.ts          # site profiles + per-site metrics
│   │   └── mock.ts           # activity, integrations, agents, tasks, etc.
│   └── lib/
│       └── store.ts          # tiny store for active site (localStorage)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
└── README.md
```

## Brand tokens

Tailwind classes available (custom):

```
text-amber, text-cyan, text-gold, text-success, text-alert
text-ink, text-ink-soft, text-ink-dim
bg-bg-deep, bg-bg-mid, bg-bg-soft
border-line, border-line-strong
shadow-glow-amber, shadow-glow-cyan
font-mono, font-grid
animate-pulse, animate-led-pulse
```

## Notes

- **Mock data** lives in `src/data/`. Don't ship the mocks to prod — replace with real fetches before launch.
- **No auth yet.** Public app. Lock it down before wiring real client APIs.
- **Tested in latest Chrome / Safari / Firefox.** Mobile responsive at 1100, 880, 560 breakpoints.

Built May 3, 2026. Phase 0 design preview saved separately at `jarvis-dashboard-preview.html`.
