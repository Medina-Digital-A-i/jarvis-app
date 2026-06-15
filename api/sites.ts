// api/sites.ts
// The multi-site registry API powering the SiteSwitcher and Settings.
//
//   GET    /api/sites           → list all active sites (public, no secrets)
//   POST   /api/sites           → add a site   (x-jarvis-token)
//     body: { label, domain, platform?, gscProperty?, githubRepo?, brand?, phone?, region? }
//   DELETE /api/sites?id=<id>    → deactivate a site (x-jarvis-token)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, requireActionToken, readBody } from './_lib/github.js';
import { listSites, addSite, deleteSite } from './_lib/sites.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const sites = await listSites();
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ sites });
    }

    if (req.method === 'POST') {
      if (!requireActionToken(req, res)) return;
      const body = readBody(req);
      const label = String(body.label ?? '').trim();
      const domain = String(body.domain ?? '').trim();
      if (!label || !domain) return res.status(400).json({ error: 'label and domain are required' });
      const site = await addSite({
        label,
        domain,
        platform: body.platform as any,
        gscProperty: body.gscProperty ? String(body.gscProperty) : null,
        githubRepo: body.githubRepo ? String(body.githubRepo) : null,
        brand: body.brand ? String(body.brand) : undefined,
        brandShort: body.brandShort ? String(body.brandShort) : undefined,
        phone: body.phone ? String(body.phone) : undefined,
        region: body.region ? String(body.region) : undefined,
      });
      return res.json({ ok: true, site });
    }

    if (req.method === 'DELETE') {
      if (!requireActionToken(req, res)) return;
      const id = String(req.query.id ?? readBody(req).id ?? '').trim();
      if (!id) return res.status(400).json({ error: 'id is required' });
      if (id === 'tps') return res.status(400).json({ error: 'The primary TPS Pro site cannot be removed.' });
      await deleteSite(id);
      return res.json({ ok: true, removed: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: unknown) {
    return res.status(500).json({ error: String(e) });
  }
}
