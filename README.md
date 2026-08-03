# 빅맥계산기

아무 가격이나 넣으면 빅맥 몇 개인지 알려주는 웹앱.

금액을 넣거나 항목을 고르면 빅맥 개수로 환산하고, 총 열량 · 쌓았을 때 높이 ·
최저시급 기준 필요 노동시간을 함께 보여준다. 카탈로그에 없는 것은 쇼핑몰 검색과
추정으로 이어지는 3단 폴백으로 찾는다.

```
React 18 + TypeScript + Vite · vite-plugin-pwa
상태관리 라이브러리 없음 · UI 라이브러리 없음 · 웹폰트 없음
```

## 시작하기

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 도메인·서비스 단위 테스트
npm run build      # 타입체크 + 프로덕션 빌드
```

실시간 가격 조회를 로컬에서 쓰려면 `.env.example`을 `.env.local`로 복사해 키를
채우고 서버 함수까지 도는 개발 서버(`wrangler pages dev`나 `vercel dev`)로 띄운다.
키가 없어도 앱은 로컬 카탈로그만으로 정상 동작한다.

## 배포

두 곳에 동시에 올라간다. 갈리는 건 환경변수 두 개뿐이고, 런타임 분기는 없다.

| | GitHub Pages | Cloudflare Pages |
|---|---|---|
| 용도 | 프로토타입 미리보기 | 실제 배포 |
| 조회 단계 | 1단계(카탈로그)만 | 3단계 전부 |
| `BASE_PATH` | `/mac-per-mac/` | 미설정 (루트) |
| `VITE_API_BASE_URL` | `none` | 미설정 (같은 출처) |

**GitHub Pages** — `.github/workflows/deploy-pages.yml`이 `main` 푸시마다 배포한다.
레포 **Settings → Pages → Source**를 `GitHub Actions`로 바꿔두면 끝이다.
정적 호스팅이라 서버 함수가 없으므로 쇼핑몰·추정 단계는 꺼진 채로 빌드된다 —
있지도 않은 단계를 "검색 중"이라고 표시했다가 실패하는 것보다 정직하다.

**Cloudflare Pages** — 빌드 명령 `npm run build`, 출력 디렉터리 `dist`.
`functions/api/*.ts`가 Pages Functions로 자동 배포되어 `/api/…`를 같은 출처에서
서빙하므로 CORS가 필요 없다. 대시보드 **Settings → Environment variables**에
`NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` / `ANTHROPIC_API_KEY`를 넣는다.

서버 함수는 런타임 중립으로 짜여 있다. 로직은 `api/_core/`에 있고, `api/*.ts`가
Vercel(Node) 어댑터, `functions/api/*.ts`가 Cloudflare(Workers) 어댑터다.
`process.env`나 특정 호스팅 SDK는 코어가 아니라 어댑터만 안다.

> 프로토타입 한계: GitHub Pages에서는 "재배포 없이 prices.json만 교체"가
> 성립하지 않는다. 사이트가 곧 레포라 JSON 수정이 곧 배포다. 이 성질이 필요하면
> `usePrices`의 `url`을 외부 호스트로 돌리면 된다.

## 구조

```
src/
├── domain/          ← DOM·React를 import하지 않는 순수 TS. 계산은 전부 여기.
│   ├── bigmac.ts      toBigMacs, scaleOf
│   ├── format.ts      한국식 숫자, 높이 단위+비유, 노동시간
│   ├── catalog.ts     parsePriceData, loadPrices, searchCatalog
│   ├── hangul.ts      초성 추출·매칭
│   └── fallback.ts    prices.json을 빌드 시점에 번들로 끌어온 fallback
├── services/        ← 조회 파이프라인
│   ├── priceLookup.ts    3단 폴백 오케스트레이션
│   └── shoppingFilter.ts 쇼핑 응답 정제 (순수 함수)
├── hooks/           usePrices · useUrlState · useReducedMotion
├── components/      전부 직접 만든 것. 외부 UI 라이브러리 없음.
└── share/renderCard.ts   공유 카드 Canvas 렌더러

api/                 서버 함수 (런타임 중립 코어 + Vercel 어댑터)
├── _core/             로직. Request/Response도 process.env도 모른다.
│   ├── shopping.ts      네이버 쇼핑 프록시
│   ├── estimate.ts      Claude 추정 폴백
│   ├── guards.ts        인메모리 캐시 + 레이트 리밋
│   └── types.ts         Env·결과 타입, CORS
├── shopping.ts        Vercel(Node) 어댑터
└── estimate.ts

functions/           Cloudflare Pages Functions 어댑터
├── _adapter.ts
└── api/{shopping,estimate}.ts

public/data/prices.json  ← 재배포 없이 갈아끼우는 가격 데이터
```

`src/domain/`은 DOM·React에 의존하지 않는다. 테스트도 `environment: 'node'`로
돌려서 그 제약을 환경 자체로 강제한다.

## 가격 데이터

앱은 `/data/prices.json`을 fetch하고, 실패하면 번들에 포함된 fallback을 쓴다.
가격이 바뀌면 이 파일만 교체하면 되고 재배포는 필요 없다 —
`public/_headers`(Cloudflare)와 `vercel.json`에서 `Cache-Control: no-cache`,
서비스워커에서 `NetworkFirst`로 잡아뒀다. (GitHub Pages는 예외 — 위 배포 절 참고)

`fallback.ts`는 같은 JSON을 빌드 시점에 import한다. 손으로 복사해 두면 두 벌이
조용히 어긋나므로 한 벌로 유지한다.

카탈로그 항목의 `uncertain: true`는 값이 확실치 않다는 뜻이고, UI에서 "추정치"로
표시된다. `priceNote`에 기준 시점과 근거를 적어둔다.

## 실시간 가격 조회

카탈로그에 없는 항목은 `lookupPrice()`가 3단계로 찾는다. 각 단계는 타임아웃이
있고, 실패하면 **조용히** 다음 단계로 넘어간다.

| 단계 | 소스 | `source` | `confidence` | 타임아웃 |
|---|---|---|---|---|
| 1 | 로컬 카탈로그 (퍼지 매칭) | `catalog` | `exact` / `estimated` | 3초 |
| 2 | 네이버 쇼핑 (`/api/shopping`) | `shopping` | `market` | 3초 |
| 3 | Claude 추정 (`/api/estimate`) | `estimate` | `estimated` | 25초 |

2·3단계는 `apiBaseUrl`로 켜고 끈다. `null`이면 요청도 보내지 않고 단계 자체를
건너뛴다 — GitHub Pages 같은 정적 단독 배포용이다.

세 단계가 모두 빈손이면 `PriceLookupError('not_found')`, 3단계가 "값을 매길 수
없다"고 판단하면 `PriceLookupError('unpriceable')`을 던진다. UI는 각각
"가격을 못 찾았어요" / "이건 값을 매기기 어렵네요"로 처리한다.

> **3단계 타임아웃이 3초가 아닌 이유**
> 요청받은 값은 세 단계 모두 3초였지만, 3단계는 Claude가 웹 검색까지 돌고 오므로
> 3초 안에 끝나는 일이 사실상 없다. 그대로 두면 폴백 체인의 마지막 칸이 항상 죽은
> 코드가 되어 25초로 잡았다. `src/services/priceLookup.ts`의 `STAGE_TIMEOUT_MS`
> 한 줄만 바꾸면 되돌릴 수 있다.

### 네이버 쇼핑 API 설정

1. [네이버 개발자센터](https://developers.naver.com)에 네이버 계정으로 로그인한다.
2. 상단 **Application → 애플리케이션 등록**으로 이동한다.
3. 애플리케이션 정보를 입력한다.
   - **애플리케이션 이름**: 아무거나 (예: `빅맥계산기`)
   - **사용 API**: `검색`을 선택한다. (쇼핑 검색은 `검색` API에 포함된다)
   - **비로그인 오픈 API 서비스 환경**: `WEB 설정`을 고르고 서비스 URL에
     배포 도메인을 넣는다. 로컬 개발은 `http://localhost:3000`을 함께 등록한다.
4. 등록하면 **Client ID**와 **Client Secret**이 발급된다.
5. `.env.local`에 넣는다.
   ```
   NAVER_CLIENT_ID=발급받은_ID
   NAVER_CLIENT_SECRET=발급받은_SECRET
   ```
6. 배포 시에는 호스팅의 환경변수에 같은 두 값을 등록한다
   (Cloudflare Pages: Settings → Environment variables).

검색 API는 일 25,000회 호출 제한이 있다. `/api/shopping`은 동일 쿼리를 1시간
캐시하고 IP당 분당 20회로 제한해 여유를 둔다.

`/api/shopping`이 하는 일:

- `display=20`으로 받아온 뒤 `title`에서 HTML 태그와 엔티티를 제거
- 중고 · 케이스 · 필름 · 부품 · 렌탈 등 본품이 아닌 결과를 키워드로 제외
- 검색어 토큰이 하나도 안 걸리는 결과를 제외
- 남은 `lprice`에서 **상하위 20%를 잘라낸 뒤 중앙값**을 대표가로 사용
  (평균은 묶음판매·오타 가격 같은 이상치에 취약해서 쓰지 않는다)
- 남은 결과가 3개 미만이면 실패로 보고 404를 돌려준다 → 호출자는 3단계로 넘어간다

정제 로직 자체는 `src/services/shoppingFilter.ts`에 순수 함수로 떼어놨다.
HTTP·시크릿과 섞이면 단위 테스트가 불가능해지기 때문이고, 파이프라인상 위치는
그대로 `/api/shopping` 엔드포인트다.

### Claude 추정 설정

1. [Anthropic Console](https://console.anthropic.com/settings/keys)에서 API 키를 발급한다.
2. `.env.local`에 `ANTHROPIC_API_KEY`를 넣는다. 호스팅에도 같은 값을 등록한다.

`/api/estimate`는 `web_search` 툴을 붙여 호출하고, 시스템 프롬프트로 JSON만
출력하도록 지시한다(코드펜스 금지). 응답 스키마:

```json
{
  "priceKRW": 1234567,
  "label": "에펠탑 건설비 (현재가치 환산)",
  "reasoning": "어떻게 그 값에 도달했는지 한두 문장",
  "confidence": "high | medium | low",
  "sourceUrl": "https://..."
}
```

가격을 특정할 수 없으면 `priceKRW: null`을 돌려주고, UI는 "이건 값을 매기기
어렵네요"로 처리한다.

모델은 기본값이 `claude-sonnet-4-6`이고 `CLAUDE_MODEL` 환경변수로 바꿀 수 있다.
더 정확한 추정이 필요하면 `claude-sonnet-5`를 넣으면 된다.

## 디자인

맥도날드의 빨강·노랑 대신 "가격표 / 영수증 / 계산기"의 시각 언어를 썼다.
개념은 그대로 두되 표현은 요즘 감각으로 맞췄다 — 딱딱한 1px 테두리 대신
헤어라인 링 + 부드러운 그림자, 큰 반경, 스프링 이징의 미세 모션.

- 강조색은 딥 그린 `#146B58` **하나뿐**. 나머지는 전부 무채색이다.
  바꾸려면 `src/styles/tokens.css`의 `--accent` 두 줄(라이트/다크)만 고치면 된다.
  파생 톤(hover, soft, ring)은 손으로 고른 알파 헥스가 아니라 `color-mix`로 뽑는다.
- 숫자는 시스템 등폭 서체 + `tabular-nums`. **웹폰트는 받지 않는다** —
  오프라인 동작과 공유 카드 Canvas 렌더링이 폰트 로딩을 기다리지 않게.
- 종이 질감은 이미지 없이 인라인 SVG 노이즈 한 겹 + 상단의 옅은 강조색 워시로 낸다.
- 버거는 사진 대신 직접 그린 SVG. `currentColor`를 따르므로 어디에 놓든 주변 색을 받는다.
- 다크 모드는 `prefers-color-scheme` 자동 전환. 큰 숫자에만 은은한 발광이 붙는다.
  공유 카드는 라이트로 고정한다 — 공유된 이미지가 보는 사람 설정에 따라
  달라지면 곤란하므로. 카드 팔레트는 `tokens.css`의 라이트 값과 맞춰둔다.

레이아웃은 `100dvh` 고정이고 페이지 자체는 스크롤하지 않는다. 데스크톱은
좌(입력)/우(영수증) 2열, 모바일은 1열 스택이며, 버거 격자만 내부 스크롤을 허용해
전체 레이아웃이 밀리지 않게 했다.

세로가 짧은 화면(`max-height: 46rem`)에서는 인기 항목 칩이 한 줄 가로 스크롤로
바뀐다. 칩이 서너 줄을 먹으면 결과가 화면 밖으로 밀리기 때문이다. 그래도 모자라면
페이지 대신 결과 패널이 스크롤된다.

## 공유

- **이미지**: 1080×1350 Canvas로 영수증 카드를 그린다. `navigator.canShare`가
  파일을 받으면 Web Share, 아니면 PNG 다운로드로 폴백한다.
- **링크**: 상태를 `?q=맥%20미니%20M4&p=890000`으로 URL에 반영한다(`replaceState`).
  첫 로드 때 파싱해 복원한다.

## 테스트

```bash
npm test
```

도메인과 서비스 레이어를 덮는다 — 환산 경계값, `scale` 구간, 한국식 숫자 포맷,
높이 단위 전환과 비유, 초성 검색, `parsePriceData` 스키마 거부,
`loadPrices` fallback 폴백, 쇼핑 응답 정제(절사·중앙값·키워드 필터),
그리고 `lookupPrice`의 폴백 순서(1번 실패→2번 성공, 1·2번 실패→3번 성공,
타임아웃, "값을 매길 수 없음"의 비폴백 전파).

## 아이콘 다시 만들기

```bash
node scripts/generate-icons.mjs
```

PWA 아이콘 PNG를 픽셀부터 직접 그려서 생성한다. 이미지 편집기나 외부 의존성 없이
재현할 수 있게 해둔 것이다.

## 이 단계에서 하지 않은 것

- localStorage/sessionStorage 외 브라우저 스토리지 API
- 외부 UI 라이브러리
- 로그인, 히스토리, 가격 알림
