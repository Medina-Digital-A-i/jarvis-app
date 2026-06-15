// api/publish-blog.ts
// Autonomously publish a blog post to the live TPS Pro website:
//   1. Create blog-<slug>.html in the site repo (flat-file convention, like the
//      existing blog-*.html posts) with full SEO meta + Article JSON-LD.
//   2. Insert a card into blog.html so the post appears in the blog index.
//   3. Append the post to public/blog-index.json in the JARVIS repo.
//
// POST { title, slug, content, targetKeyword, metaDescription, excerpt?, readMinutes? }
//   header: x-jarvis-token: <JARVIS_ACTION_TOKEN>
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SITE_REPO,
  JARVIS_REPO,
  getFile,
  putFile,
  escapeHtml,
  cors,
  requireActionToken,
  readBody,
  appendAgentLog,
} from './_lib/github.js';

const SITE = 'https://totalpropertysolution.net';

// "choose-cleaning" | "blog-choose-cleaning" -> "blog-choose-cleaning"
function normalizeSlug(slug: string): string {
  let s = (slug || '')
    .trim()
    .toLowerCase()
    .replace(/\.html$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s.startsWith('blog-')) s = `blog-${s}`;
  return s;
}

function wordCount(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

function buildPage(opts: {
  title: string;
  metaDescription: string;
  content: string;
  targetKeyword: string;
  slug: string;
  dateIso: string;
  readMinutes: number;
}): string {
  const { title, metaDescription, content, targetKeyword, slug, dateIso, readMinutes } = opts;
  const url = `${SITE}/${slug}.html`;
  const t = escapeHtml(title);
  const d = escapeHtml(metaDescription);
  const dateLabel = new Date(dateIso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t} | TPS Pro LLC</title>
<meta name="description" content="${d}" />
<meta name="keywords" content="${escapeHtml(targetKeyword)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${url}" />
<meta property="og:title" content="${t} | TPS Pro LLC" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="TPS Pro LLC" />
<script type="application/ld+json">
${JSON.stringify(
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: metaDescription,
    datePublished: dateIso,
    author: { '@type': 'Organization', name: 'TPS Pro LLC' },
    publisher: {
      '@type': 'Organization',
      name: 'TPS Pro LLC',
      logo: { '@type': 'ImageObject', url: `${SITE}/images/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  },
  null,
  2
)}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  :root { --navy:#1a2e4a; --blue:#2563eb; --green:#258D21; --green-deep:#144C12; --ink:#2D2E32; --muted:#6A6C72; --line:#E6E7EA; --max:780px; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',system-ui,sans-serif; color:var(--ink); background:#fff; line-height:1.7; -webkit-font-smoothing:antialiased; }
  a { color:var(--blue); }
  .site-header { background:#fff; border-bottom:1px solid var(--line); padding:16px 24px; display:flex; align-items:center; justify-content:space-between; }
  .logo-text strong { font-size:17px; font-weight:800; color:var(--green); }
  .logo-text small { font-size:11px; color:var(--muted); display:block; }
  .nav-links a { font-size:14px; font-weight:600; color:var(--ink); margin-left:20px; text-decoration:none; }
  .article-hero { background:linear-gradient(135deg,var(--navy) 0%,#2c4a7a 100%); color:#fff; padding:64px 24px; }
  .article-hero .wrap { max-width:var(--max); margin:0 auto; }
  .article-hero .tag { background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.25); font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:4px 12px; border-radius:20px; display:inline-block; margin-bottom:18px; }
  .article-hero h1 { font-size:clamp(26px,4vw,40px); font-weight:800; line-height:1.2; letter-spacing:-.02em; }
  .article-hero .meta { color:rgba(255,255,255,0.7); font-size:14px; margin-top:14px; }
  .article-body { max-width:var(--max); margin:0 auto; padding:48px 24px; font-size:17px; }
  .article-body h2 { font-size:26px; font-weight:800; color:var(--navy); margin:36px 0 14px; letter-spacing:-.02em; }
  .article-body h3 { font-size:20px; font-weight:700; color:var(--navy); margin:28px 0 10px; }
  .article-body p { margin:0 0 18px; }
  .article-body ul, .article-body ol { margin:0 0 18px 22px; }
  .article-body li { margin-bottom:8px; }
  .cta-strip { background:var(--navy); padding:56px 24px; text-align:center; }
  .cta-strip h2 { font-size:clamp(22px,3vw,32px); font-weight:800; color:#fff; margin-bottom:12px; }
  .cta-strip p { color:rgba(255,255,255,0.8); margin-bottom:24px; }
  .cta-strip a.btn { background:#FFD700; color:var(--navy); font-weight:800; padding:14px 32px; border-radius:8px; display:inline-block; text-decoration:none; }
  footer { padding:32px 24px; text-align:center; color:var(--muted); font-size:13px; border-top:1px solid var(--line); }
</style>
</head>
<body>
<header class="site-header">
  <a href="/" style="text-decoration:none"><div class="logo-text"><strong>TPS Pro LLC</strong><small>Commercial Cleaning &amp; Property Maintenance · Albany, NY</small></div></a>
  <nav class="nav-links"><a href="/services.html">Services</a><a href="/blog.html">Blog</a><a href="/contact.html">Contact</a><a href="/quote.html">Free Quote</a></nav>
</header>
<section class="article-hero"><div class="wrap">
  <span class="tag">TPS Pro Blog</span>
  <h1>${t}</h1>
  <div class="meta">${dateLabel} &nbsp;&middot;&nbsp; ${readMinutes} min read</div>
</div></section>
<article class="article-body">
${content}
</article>
<section class="cta-strip">
  <h2>Need commercial cleaning in the Capital Region?</h2>
  <p>TPS Pro LLC — bonded, insured, and trusted by Albany-area property managers.</p>
  <a class="btn" href="/quote.html">Get a Free Quote</a>
</section>
<footer>&copy; ${new Date(dateIso).getUTCFullYear()} TPS Pro LLC · Albany, NY · (518) 948-7156</footer>
</body>
</html>
`;
}

// Insert a blog card right after the <div class="blog-grid"> opening tag.
function insertCard(blogHtml: string, opts: { slug: string; title: string; excerpt: string; dateLabel: string; readMinutes: number }): string {
  const card = `
    <article class="blog-card">
      <div class="blog-card-img">
        <span class="card-tag">TPS Pro Blog</span>
      </div>
      <div class="blog-card-body">
        <div class="blog-card-meta">${opts.dateLabel} &nbsp;&middot;&nbsp; ${opts.readMinutes} min read</div>
        <h3>${escapeHtml(opts.title)}</h3>
        <p>${escapeHtml(opts.excerpt)}</p>
        <a href="/${opts.slug}.html" class="blog-card-link">Read the guide &rarr;</a>
      </div>
    </article>`;
  const marker = blogHtml.match(/<div class="blog-grid">/);
  if (!marker) return blogHtml; // no grid found — skip card injection
  return blogHtml.replace(/<div class="blog-grid">/, `<div class="blog-grid">${card}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireActionToken(req, res)) return;

  const body = readBody(req);
  const title = String(body.title ?? '').trim();
  const rawSlug = String(body.slug ?? '').trim();
  const content = String(body.content ?? '').trim();
  const targetKeyword = String(body.targetKeyword ?? '').trim();
  const metaDescription = String(body.metaDescription ?? '').trim();
  const excerpt = String(body.excerpt ?? metaDescription).trim();
  const readMinutes = Number(body.readMinutes) || Math.max(3, Math.round(wordCount(content) / 200));

  if (!title || !content || !metaDescription)
    return res.status(400).json({ error: 'title, content, and metaDescription are required' });

  const slug = normalizeSlug(rawSlug || title);
  const path = `${slug}.html`;
  const dateIso = new Date().toISOString();
  const dateLabel = new Date(dateIso).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  try {
    // Refuse to clobber an existing post.
    const existing = await getFile(SITE_REPO, path);
    if (existing) return res.status(409).json({ error: `Post already exists: ${path}` });

    // 1) Create the post page.
    const page = buildPage({ title, metaDescription, content, targetKeyword, slug, dateIso, readMinutes });
    const postCommit = await putFile(SITE_REPO, path, page, `blog: publish "${title}" [JARVIS]`, undefined);

    // 2) Insert a card into blog.html (best-effort).
    let indexUpdated = false;
    try {
      const blogIndex = await getFile(SITE_REPO, 'blog.html');
      if (blogIndex) {
        const updated = insertCard(blogIndex.content, { slug, title, excerpt, dateLabel, readMinutes });
        if (updated !== blogIndex.content) {
          await putFile(SITE_REPO, 'blog.html', updated, `blog: add card for "${title}" [JARVIS]`, blogIndex.sha);
          indexUpdated = true;
        }
      }
    } catch {
      /* card injection is non-critical */
    }

    // 3) Append to public/blog-index.json in the JARVIS repo.
    let jarvisIndexUpdated = false;
    try {
      const idxPath = 'public/blog-index.json';
      const idxFile = await getFile(JARVIS_REPO, idxPath);
      const idx = idxFile ? JSON.parse(idxFile.content) : { lastUpdated: '', posts: [] };
      idx.posts = [
        { title, slug, publishedDate: dateIso.split('T')[0], targetKeyword, wordCount: wordCount(content) },
        ...(idx.posts || []),
      ];
      idx.lastUpdated = dateIso.split('T')[0];
      await putFile(JARVIS_REPO, idxPath, JSON.stringify(idx, null, 2) + '\n', `chore(blog-index): add "${title}" [JARVIS]`, idxFile?.sha);
      jarvisIndexUpdated = true;
    } catch {
      /* index update is non-critical */
    }

    try {
      await appendAgentLog({
        timestamp: dateIso,
        agentName: 'jarvis-blog-publisher',
        status: 'success',
        actions: [
          `Published "${title}" → /${path}`,
          `Target keyword: ${targetKeyword || '(none)'}`,
          indexUpdated ? 'Added card to blog.html' : 'blog.html card NOT added (marker missing)',
          jarvisIndexUpdated ? 'Updated public/blog-index.json' : 'blog-index.json NOT updated',
          `Commit ${postCommit.commitSha.slice(0, 7)}`,
        ],
        pagesAffected: [path, 'blog.html', 'public/blog-index.json'],
        deployed: true,
      });
    } catch {
      /* non-critical */
    }

    return res.json({
      ok: true,
      slug,
      path,
      url: `${SITE}/${path}`,
      wordCount: wordCount(content),
      blogIndexCardAdded: indexUpdated,
      jarvisIndexUpdated,
      commit: postCommit,
    });
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
