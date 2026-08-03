import { handleShopping } from '../../api/_core/shopping';
import { corsHeaders, firstForwardedIp, normalizeQuery } from '../../api/_core/types';
import { toResponse, type PagesContext } from '../_adapter';

/**
 * Cloudflare Pages Function 어댑터.
 * 로직은 api/_core/shopping.ts에 있고, Vercel 어댑터와 같은 코어를 공유한다.
 *
 * GET /api/shopping?q=맥미니
 */
export const onRequestGet = async ({
  request,
  env,
}: PagesContext): Promise<Response> => {
  const url = new URL(request.url);
  const result = await handleShopping({
    query: normalizeQuery(url.searchParams.get('q')),
    // Cloudflare는 cf-connecting-ip에 원본 IP를 넣어준다. 위조가 어렵다.
    clientIp:
      request.headers.get('cf-connecting-ip') ??
      firstForwardedIp(request.headers.get('x-forwarded-for')),
    env,
  });
  return toResponse(result, env);
};

export const onRequestOptions = ({ env }: PagesContext): Response =>
  new Response(null, { status: 204, headers: corsHeaders(env) });
