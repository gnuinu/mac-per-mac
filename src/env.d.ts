/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * 조회 API가 있는 곳. 빌드 시점에 박힌다.
   *   미설정          같은 출처 (`/api/…`). Cloudflare Pages·Vercel.
   *   'none'          원격 조회를 끈다. GitHub Pages 같은 정적 단독 배포.
   *   'https://…'     다른 출처. 정적 호스팅 + 외부 함수 조합.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
