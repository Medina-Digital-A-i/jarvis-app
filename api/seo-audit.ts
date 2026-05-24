import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; JARVIS-SEO-Bot/1.0; +https://jarvis.tpspro.com)',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    const html = await response.text();
    const finalUrl = response.url;

    // --- extractors -------------------------------------------------------
    const getText = (rx: RegExp) => {
      const m = html.match(rx);
      return m ? m[1].replace(/\s+/g, ' ').trim() : null;
    };
    const getAll = (rx: RegExp) => {
      const out: string[] = [];
      let m;
      const g = new RegExp(rx.source, 'gi');
      while ((m = g.exec(html)) !== null) out.push(m[1].replace(/\s+/g, ' ').trim());
      return out;
    };

    const title = getText(/<title[^>]*>([^<]*)<\/title>/i);
    const metaDesc = getText(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)
      ?? getText(/<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']description["']/i);

    const h1s = getAll(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h2s = getAll(/<h2[^>]*>([^<]+)<\/h2>/i);
    const h3s = getAll(/<h3[^>]*>([^<]+)<\/h3>/i);

    const canonical = getText(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)
      ?? getText(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);

    const robotsMeta = getText(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)/i)
      ?? getText(/<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']robots["']/i);

    const ogTitle = getText(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i)
      ?? getText(/<meta[^>]+content=["']([^"']*?)["'][^>]+property=["']og:title["']/i);
    const ogDesc = getText(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i)
      ?? getText(/<meta[^>]+content=["']([^"']*?)["'][^>]+property=["']og:description["']/i);
    const ogImage = getText(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)/i)
      ?? getText(/<meta[^>]+content=["']([^"']*?)["'][^>]+property=["']og:image["']/i);

    const twitterCard = getText(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)/i)
      ?? getText(/<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']twitter:card["']/i);

    const hasSchema = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

    // images
    const imgMatches = html.match(/<img[^>]*>/gi) || [];
    const imgsTotal = imgMatches.length;
    const imgsNoAlt = imgMatches.filter(
      (t) => !/alt=["'][^"']+["']/i.test(t) || /alt=["']\s*["']/i.test(t)
    ).length;

    // word count (strip tags)
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const isHttps = finalUrl.startsWith('https://');
    const loadMs = response.headers.get('x-response-time') ? parseInt(response.headers.get('x-response-time')!) : null;

    // --- scoring ----------------------------------------------------------
    interface Issue { type: 'error' | 'warning' | 'ok'; label: string; detail: string }
    const issues: Issue[] = [];

    // Title
    if (!title) {
      issues.push({ type: 'error', label: 'Title tag missing', detail: 'Every page must have a <title> tag.' });
    } else if (title.length < 30) {
      issues.push({ type: 'warning', label: `Title too short (${title.length} chars)`, detail: `"${title}" — aim for 50–60 characters.` });
    } else if (title.length > 60) {
      issues.push({ type: 'warning', label: `Title too long (${title.length} chars)`, detail: `"${title.substring(0, 60)}…" — Google truncates after ~60 chars.` });
    } else {
      issues.push({ type: 'ok', label: `Title looks good (${title.length} chars)`, detail: `"${title}"` });
    }

    // Meta description
    if (!metaDesc) {
      issues.push({ type: 'error', label: 'Meta description missing', detail: 'Strongly affects CTR in search results.' });
    } else if (metaDesc.length < 100) {
      issues.push({ type: 'warning', label: `Meta description short (${metaDesc.length} chars)`, detail: `Aim for 120–160 characters.` });
    } else if (metaDesc.length > 160) {
      issues.push({ type: 'warning', label: `Meta description too long (${metaDesc.length} chars)`, detail: `Google truncates after ~160 chars.` });
    } else {
      issues.push({ type: 'ok', label: `Meta description good (${metaDesc.length} chars)`, detail: `"${metaDesc.substring(0, 80)}…"` });
    }

    // H1
    if (h1s.length === 0) {
      issues.push({ type: 'error', label: 'No H1 tag found', detail: 'Every page should have exactly one H1 with the primary keyword.' });
    } else if (h1s.length > 1) {
      issues.push({ type: 'warning', label: `Multiple H1 tags (${h1s.length})`, detail: `Found: ${h1s.map(h => `"${h}"`).join(', ')}` });
    } else {
      issues.push({ type: 'ok', label: `H1 present`, detail: `"${h1s[0]}"` });
    }

    // H2
    if (h2s.length === 0) {
      issues.push({ type: 'warning', label: 'No H2 tags', detail: 'Use H2s to structure content and target secondary keywords.' });
    } else {
      issues.push({ type: 'ok', label: `${h2s.length} H2 tag${h2s.length > 1 ? 's' : ''}`, detail: h2s.slice(0, 3).map(h => `"${h}"`).join(', ') + (h2s.length > 3 ? '…' : '') });
    }

    // Images / alt text
    if (imgsTotal > 0 && imgsNoAlt > 0) {
      issues.push({ type: 'warning', label: `${imgsNoAlt}/${imgsTotal} images missing alt text`, detail: 'Alt text helps Google understand images and boosts accessibility.' });
    } else if (imgsTotal > 0) {
      issues.push({ type: 'ok', label: `All ${imgsTotal} images have alt text`, detail: '' });
    }

    // Canonical
    if (!canonical) {
      issues.push({ type: 'warning', label: 'No canonical tag', detail: 'Add <link rel="canonical"> to prevent duplicate content issues.' });
    } else {
      issues.push({ type: 'ok', label: 'Canonical tag present', detail: canonical });
    }

    // HTTPS
    if (isHttps) {
      issues.push({ type: 'ok', label: 'HTTPS enabled', detail: '' });
    } else {
      issues.push({ type: 'error', label: 'Not using HTTPS', detail: 'Google penalizes non-HTTPS sites. Fix immediately.' });
    }

    // Robots
    if (robotsMeta && /noindex/i.test(robotsMeta)) {
      issues.push({ type: 'error', label: `Robots: ${robotsMeta}`, detail: 'This page is set to noindex — Google will not include it in search results!' });
    } else if (robotsMeta) {
      issues.push({ type: 'ok', label: `Robots meta: ${robotsMeta}`, detail: '' });
    }

    // OG tags
    const ogCount = [ogTitle, ogDesc, ogImage].filter(Boolean).length;
    if (ogCount === 0) {
      issues.push({ type: 'warning', label: 'No Open Graph tags', detail: 'OG tags control how your page looks when shared on social media.' });
    } else if (ogCount < 3) {
      issues.push({ type: 'warning', label: `Partial Open Graph (${ogCount}/3)`, detail: `Missing: ${[!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean).join(', ')}` });
    } else {
      issues.push({ type: 'ok', label: 'Open Graph tags complete', detail: '' });
    }

    // Twitter card
    if (!twitterCard) {
      issues.push({ type: 'warning', label: 'No Twitter Card meta', detail: 'Improves appearance when shared on Twitter/X.' });
    } else {
      issues.push({ type: 'ok', label: `Twitter Card: ${twitterCard}`, detail: '' });
    }

    // Schema
    if (!hasSchema) {
      issues.push({ type: 'warning', label: 'No Schema.org markup', detail: 'Add JSON-LD structured data (LocalBusiness, Service) for rich results.' });
    } else {
      issues.push({ type: 'ok', label: 'Schema.org markup found', detail: '' });
    }

    // Viewport
    if (!hasViewport) {
      issues.push({ type: 'warning', label: 'No viewport meta tag', detail: 'Required for mobile-friendliness.' });
    } else {
      issues.push({ type: 'ok', label: 'Viewport meta present', detail: '' });
    }

    // Word count
    if (wordCount < 300) {
      issues.push({ type: 'warning', label: `Thin content (${wordCount} words)`, detail: 'Pages with fewer than 300 words rarely rank well. Add more value.' });
    } else if (wordCount >= 1000) {
      issues.push({ type: 'ok', label: `Content length: ${wordCount} words`, detail: 'Good depth — Google tends to reward comprehensive pages.' });
    } else {
      issues.push({ type: 'ok', label: `Content length: ${wordCount} words`, detail: '' });
    }

    // Score: each ok = full points, warning = partial, error = 0
    const weights: Record<Issue['type'], number> = { ok: 1, warning: 0.5, error: 0 };
    const total = issues.length;
    const raw = issues.reduce((acc, i) => acc + weights[i.type], 0);
    const score = Math.round((raw / total) * 100);

    return res.status(200).json({
      url: finalUrl,
      status: response.status,
      score,
      title,
      metaDesc,
      h1s,
      h2s,
      h3s,
      canonical,
      robotsMeta,
      ogTitle,
      ogDesc,
      ogImage,
      twitterCard,
      hasSchema,
      hasViewport,
      isHttps,
      imgsTotal,
      imgsNoAlt,
      wordCount,
      loadMs,
      issues,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Failed to fetch URL: ${msg}` });
  }
}
