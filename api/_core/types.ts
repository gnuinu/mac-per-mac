/**
 * 런타임 중립 계층.
 *
 * 핸들러 본체는 Request/Response도, process.env도, 특정 호스팅 SDK도 모른다.
 * 질의 문자열과 환경변수를 받아 상태코드 + 본문을 돌려줄 뿐이다.
 * Vercel(Node)과 Cloudflare(Workers) 어댑터가 이걸 감싼다.
 */

export interface LookupEnv {
  NAVER_CLIENT_ID?: string | undefined;
  NAVER_CLIENT_SECRET?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  CLAUDE_MODEL?: string | undefined;
  /** 교차 출처 허용 오리진. 미설정이면 같은 출처만 쓴다고 보고 헤더를 안 붙인다. */
  ALLOWED_ORIGIN?: string | undefined;
}

export interface ApiResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface RequestContext {
  query: string | null;
  clientIp: string;
  env: LookupEnv;
}

/** x-forwarded-for의 첫 번째 주소가 실제 클라이언트다. */
export function firstForwardedIp(value: string | null | undefined): string {
  return value?.split(',')[0]?.trim() || 'unknown';
}

export function normalizeQuery(raw: string | null | undefined, maxLength = 100): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * CORS 헤더. GitHub Pages 같은 다른 출처에서 부를 때만 필요하다.
 *
 * ALLOWED_ORIGIN을 비워두면 헤더를 붙이지 않는다 — 같은 출처 배포(Cloudflare
 * Pages Functions, Vercel)에서는 필요 없고, 실수로 '*'가 열려서 남의 트래픽이
 * 네이버·Anthropic 할당량을 태우는 일도 막는다.
 */
export function corsHeaders(env: LookupEnv): Record<string, string> {
  if (!env.ALLOWED_ORIGIN) return {};
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };
}
