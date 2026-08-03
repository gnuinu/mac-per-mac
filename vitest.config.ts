import { defineConfig } from 'vitest/config';

/**
 * 테스트 설정은 vite.config.ts와 분리한다.
 * vitest가 자체 vite 사본을 들고 있어서 한 파일에 합치면 플러그인 타입이 충돌하고,
 * 도메인·서비스 테스트는 react/PWA 플러그인이 필요 없다.
 */
export default defineConfig({
  test: {
    // 도메인 레이어가 DOM 없이 돌아야 한다는 제약을 환경 자체로 강제한다.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
