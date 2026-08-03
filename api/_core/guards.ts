/**
 * 인메모리 캐시 + 레이트 리밋.
 *
 * 인스턴스(Node 람다 / Workers isolate) 단위 메모리라서 콜드 스타트나 스케일
 * 아웃 시 초기화된다. 남용을 막고 같은 쿼리의 반복 호출을 줄이는 게 목적이지
 * 엄밀한 보장은 아니다. 엄밀함이 필요해지면 Cloudflare KV나 Durable Object로
 * 옮기면 된다 — 구현만 갈아끼울 수 있게 인터페이스를 좁게 잡았다.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      // 가장 오래된 항목부터 버린다 (Map은 삽입 순서를 유지한다).
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** 허용되면 true. 한도를 넘겼으면 false. */
  take(key: string): boolean {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.prune(now);
      this.hits.set(key, { count: 1, windowStart: now });
      return true;
    }

    entry.count += 1;
    return entry.count <= this.limit;
  }

  private prune(now: number): void {
    for (const [key, entry] of this.hits) {
      if (now - entry.windowStart >= this.windowMs) this.hits.delete(key);
    }
  }
}
