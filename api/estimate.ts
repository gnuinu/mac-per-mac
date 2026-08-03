import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleEstimate } from './_core/estimate';
import { corsHeaders, firstForwardedIp, normalizeQuery } from './_core/types';

/**
 * Vercel(Node) 어댑터. 로직은 _core/estimate.ts에 있다.
 * Cloudflare용 같은 어댑터는 functions/api/estimate.ts에 있다.
 *
 * GET /api/estimate?q=에펠탑
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const env = process.env;
  const cors = corsHeaders(env);
  for (const [key, value] of Object.entries(cors)) res.setHeader(key, value);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET만 지원합니다' });
    return;
  }

  const raw = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const result = await handleEstimate({
    query: normalizeQuery(raw),
    clientIp: firstForwardedIp(
      Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for'],
    ),
    env,
  });

  for (const [key, value] of Object.entries(result.headers ?? {})) {
    res.setHeader(key, value);
  }
  res.status(result.status).json(result.body);
}
