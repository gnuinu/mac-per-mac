import type { CSSProperties } from 'react';

interface Props {
  className?: string;
  style?: CSSProperties;
  /** 장식용이면 aria-hidden 처리된다. */
  title?: string;
}

/**
 * 직접 그린 단순한 버거 아이콘. 사진도, 브랜드 색도 쓰지 않는다.
 * 색은 currentColor를 따르므로 어디에 놓든 주변 텍스트 색을 그대로 받는다.
 */
export function BurgerIcon({ className, style, title }: Props) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* 윗빵 */}
      <path d="M2.5 7.5C2.5 4.2 6.8 1.8 12 1.8S21.5 4.2 21.5 7.5" />
      {/* 참깨 */}
      <path d="M8.6 5.1h.01M12 4.1h.01M15.4 5.1h.01" strokeWidth="1.8" />
      {/* 치즈 / 패티 */}
      <path d="M2.9 7.6h18.2" />
      <path d="M4.2 10.1c1.4 1.1 2.6-.9 4-.1s2.5 1.2 3.9.4 2.4-1.1 3.8-.3 2.6.9 3.9-.2" />
      <path d="M3.4 12.6h17.2" />
      {/* 아랫빵 */}
      <path d="M3 14.9c0 2.1 3.4 3.3 9 3.3s9-1.2 9-3.3" />
    </svg>
  );
}
