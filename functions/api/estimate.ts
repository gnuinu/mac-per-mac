import { handleEstimate } from '../../api/_core/estimate';
import { corsHeaders, firstForwardedIp, normalizeQuery } from '../../api/_core/types';
import { toResponse, type PagesContext } from '../_adapter';

/**
 * Cloudflare Pages Function 어댑터.
 * 로직은 api/_core/estimate.ts에 있고, Vercel 어댑터와 같은 코어를 공유한다.
 *
 * GET /api/estimate?q=에펠탑
 */
export const onRequestGet = async ({
  request,
  env,
}: PagesContext): Promise<Response> => {
  const url = new URL(request.url);
  const result = await handleEstimate({
    query: normalizeQuery(url.searchParams.get('q')),
    clientIp:
      request.headers.get('cf-connecting-ip') ??
      firstForwardedIp(request.headers.get('x-forwarded-for')),
    env,
  });
  return toResponse(result, env);
};

export const onRequestOptions = ({ env }: PagesContext): Response =>
  new Response(null, { status: 204, headers: corsHeaders(env) });
