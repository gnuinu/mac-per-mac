import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** 사용자가 모션 감소를 켜뒀는지. 켜져 있으면 stagger 애니메이션을 끈다. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => globalThis.matchMedia?.(QUERY).matches ?? false,
  );

  useEffect(() => {
    const media = globalThis.matchMedia?.(QUERY);
    if (!media) return;

    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
