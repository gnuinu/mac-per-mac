import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleShopping } from './_core/shopping';
import { corsHeaders, firstForwardedIp, normalizeQuery } from './_core/types';

/**
 * Vercel(Node) 어댑터. 로직은 _core/shopping.ts에 있고 여기서는 요청/응답만 옮긴다.
 * Cloudflare용 같은 어댑터는 functions/api/shopping.ts에 있다.
 *
 * GET /api/shopping?q=맥미니
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
  const result = await handleShopping({
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
