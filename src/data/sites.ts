// Mock data for the active sites Jarvis manages.
// Real production: replace with API client → backend → DB.

export type Site = {
  id: 'tps' | 'pour' | string;
  name: string;
  domain: string;
  brand: { primary: string; accent: string };
  metrics: {
    visitors30d: string;
    visitorsDelta: string;
    leadsWeek: number;
    leadsDelta: string;
    conversionRate: string;
    conversionDelta: string;
    pipelineValue: string;
    pipelineDelta: string;
    traffic14d: number[]; // 0-100 scale
  };
};

export const SITES: Site[] = [
  {
    id: 'tps',
    name: 'TPS Pro',
    domain: 'totalpropertysolution.net',
    brand: { primary: '#1F4860', accent: '#F4B83A' },
    metrics: {
      visitors30d: '14,287',
      visitorsDelta: '+18.4%',
      leadsWeek: 42,
      leadsDelta: '+7 new since Mon',
      conversionRate: '4.7%',
      conversionDelta: '+0.6 pts',
      pipelineValue: '$48.2K',
      pipelineDelta: '+$9.4K added',
      traffic14d: [40, 55, 48, 62, 58, 72, 80, 54, 68, 75, 82, 88, 95, 100],
    },
  },
  {
    id: 'pour',
    name: 'Pour Decisions',
    domain: 'pourdecisions.com',
    brand: { primary: '#1F4860', accent: '#E8B547' },
    metrics: {
      visitors30d: '3,842',
      visitorsDelta: '+44.1%',
      leadsWeek: 11,
      leadsDelta: '+3 new since Mon',
      conversionRate: '6.2%',
      conversionDelta: '+1.1 pts',
      pipelineValue: '$12.8K',
      pipelineDelta: '+$3.1K added',
      traffic14d: [22, 30, 28, 35, 40, 48, 56, 50, 62, 70, 78, 85, 92, 96],
    },
  },
];

export function getSite(id: string): Site {
  return SITES.find((s) => s.id === id) ?? SITES[0];
}
