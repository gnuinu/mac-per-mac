import { corsHeaders, type ApiResult, type LookupEnv } from '../api/_core/types';

/**
 * Cloudflare Pages Functions 어댑터 공통부.
 *
 * @cloudflare/workers-types를 끌어오지 않으려고 필요한 만큼만 직접 선언한다.
 * 실제 런타임이 넘겨주는 컨텍스트는 이보다 크지만, 여기서 쓰는 건 두 개뿐이다.
 */
export interface PagesContext {
  request: Request;
  env: LookupEnv;
}

export function toResponse(result: ApiResult, env: LookupEnv): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(env),
      ...result.headers,
    },
  });
}
