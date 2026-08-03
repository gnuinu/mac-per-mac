import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MemoryCache, RateLimiter, clientIp, readQuery } from './_lib/guards';

/**
 * Claude 추정 폴백.
 *
 * 카탈로그에도 없고 쇼핑몰에도 안 잡히는 것 — "에펠탑", "국회의원 연봉",
 * "누리호 발사 비용" — 을 웹 검색을 붙여 합리적으로 추정한다.
 *
 * GET /api/estimate?q=에펠탑
 *   200 { priceKRW: number | null, label, reasoning, confidence, sourceUrl }
 *   429 레이트 리밋 초과
 *   503 ANTHROPIC_API_KEY 미설정
 */

/**
 * 요청하신 대로 claude-sonnet-4-6을 기본값으로 둡니다. 더 정확한 추정이
 * 필요하면 CLAUDE_MODEL 환경변수로 claude-sonnet-5 등으로 바꿀 수 있습니다.
 */
const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 추정치는 하루 정도 재사용해도 무방하다
const RATE_LIMIT = 10; // 쇼핑보다 비싸므로 더 조인다
const RATE_WINDOW_MS = 60 * 1000;
const MAX_TOKENS = 2_048;
const MAX_TURNS = 4; // pause_turn 재개 상한

const SYSTEM_PROMPT = `당신은 한국 시장 기준으로 어떤 것의 가격을 추정하는 도구입니다.

출력 규칙 (반드시 지킬 것):
- JSON 객체 **하나만** 출력합니다.
- 마크다운 코드펜스(\`\`\`)를 절대 쓰지 않습니다.
- JSON 앞뒤에 설명, 인사, 주석을 붙이지 않습니다.

스키마:
{
  "priceKRW": number | null,
  "label": string,
  "reasoning": string,
  "confidence": "high" | "medium" | "low",
  "sourceUrl": string | null
}

각 필드:
- priceKRW: 대한민국 원화 기준 정수. 값을 특정할 수 없으면 null.
- label: 무엇의 가격인지 짧게. 예: "에펠탑 건설비 (현재가치 환산)"
- reasoning: 어떻게 그 값에 도달했는지 한두 문장. 추정이면 추정이라고 밝힙니다.
- confidence: 근거가 명확하면 high, 계산·환산이 섞였으면 medium, 대략치면 low.
- sourceUrl: 근거로 삼은 웹 페이지 URL. 없으면 null.

추정 방침:
- 쇼핑몰에서 팔지 않는 것도 최대한 추정합니다. 건축물은 건설비 또는 자산가치,
  직업은 연봉, 사업은 총사업비처럼 그 대상에 가장 자연스러운 금액을 고릅니다.
- 외화 기준이면 최근 환율로 원화 환산하고, reasoning에 그 사실을 밝힙니다.
- 최신 수치가 중요하면 web_search로 확인한 뒤 답합니다.
- 가격을 매기는 것이 무의미하거나(추상적 개념, 감정) 대상이 모호해 특정할 수
  없으면 priceKRW를 null로 두고 reasoning에 이유를 씁니다. 억지로 지어내지 않습니다.`;

interface EstimatePayload {
  priceKRW: number | null;
  label: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  sourceUrl: string | null;
}

const cache = new MemoryCache<EstimatePayload>(CACHE_TTL_MS);
const limiter = new RateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

/** 코드펜스 금지를 지시했지만, 어겼을 때를 대비해 방어적으로 벗겨낸다. */
function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

/** 텍스트 앞뒤에 군더더기가 붙어도 첫 JSON 객체를 건져낸다. */
function extractJson(text: string): unknown {
  const cleaned = stripFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('JSON을 찾지 못했습니다');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function toPayload(raw: unknown, query: string): EstimatePayload {
  if (typeof raw !== 'object' || raw === null) throw new Error('객체가 아닙니다');
  const o = raw as Record<string, unknown>;

  const price =
    typeof o.priceKRW === 'number' && Number.isFinite(o.priceKRW) && o.priceKRW > 0
      ? Math.round(o.priceKRW)
      : null;

  const confidence =
    o.confidence === 'high' || o.confidence === 'medium' || o.confidence === 'low'
      ? o.confidence
      : 'low';

  return {
    priceKRW: price,
    label: typeof o.label === 'string' && o.label ? o.label : query,
    reasoning: typeof o.reasoning === 'string' ? o.reasoning : '',
    confidence,
    sourceUrl: typeof o.sourceUrl === 'string' && o.sourceUrl ? o.sourceUrl : null,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET만 지원합니다' });
    return;
  }

  const query = readQuery(req.query.q);
  if (!query) {
    res.status(400).json({ error: 'q 파라미터가 필요합니다' });
    return;
  }

  if (!limiter.take(clientIp(req.headers))) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 뒤 다시 시도해주세요.' });
    return;
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.status(200).json(cached);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다' });
    return;
  }

  const client = new Anthropic();

  try {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `다음의 가격을 추정해줘: ${query}` },
    ];

    let response: Anthropic.Message | null = null;

    // web_search는 서버 측에서 도는 툴이라 한 번에 끝나는 게 보통이지만,
    // 반복 한도에 걸리면 pause_turn으로 돌아온다. 그때는 이어서 재개한다.
    for (let turn = 0; turn < MAX_TURNS; turn += 1) {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }],
        messages,
      });

      if (response.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: response.content });
    }

    if (!response) throw new Error('응답을 받지 못했습니다');

    if (response.stop_reason === 'refusal') {
      res.status(422).json({ error: '이 요청에는 답할 수 없습니다' });
      return;
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) throw new Error('텍스트 블록이 비어 있습니다');

    const payload = toPayload(extractJson(text), query);
    cache.set(cacheKey, payload);
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: `추정에 실패했습니다: ${message}` });
  }
}
