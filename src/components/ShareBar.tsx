import { useState } from 'react';
import type { BigMacResult } from '../domain/types';
import { copyToClipboard } from '../hooks/useUrlState';
import { canvasToBlob, downloadBlob, renderCard } from '../share/renderCard';
import styles from './ShareBar.module.css';

interface Props {
  subject: string;
  priceKRW: number;
  bigMacPriceKRW: number;
  marketName?: string;
  result: BigMacResult;
  /** 입력과 기준을 전부 비운다. */
  onReset: () => void;
  badge?: string;
  shareUrl: string;
}

type Feedback = 'idle' | 'copied' | 'saved' | 'failed';

const FEEDBACK_MS = 1600;

export function ShareBar({
  subject,
  marketName,
  onReset,
  priceKRW,
  bigMacPriceKRW,
  result,
  badge,
  shareUrl,
}: Props) {
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [busy, setBusy] = useState(false);

  function flash(next: Feedback) {
    setFeedback(next);
    window.setTimeout(() => setFeedback('idle'), FEEDBACK_MS);
  }

  async function shareImage() {
    setBusy(true);
    try {
      const canvas = renderCard({
        subject,
        priceKRW,
        bigMacPriceKRW,
        result,
        ...(badge ? { badge } : {}),
        ...(marketName ? { marketName } : {}),
      });
      const blob = await canvasToBlob(canvas);
      const filename = `빅맥계산기-${subject}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      // Web Share가 파일을 받을 수 있으면 공유, 아니면 다운로드로 폴백.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: '빅맥계산기' });
      } else {
        downloadBlob(blob, filename);
        flash('saved');
      }
    } catch (error) {
      // 사용자가 공유 시트를 닫은 경우는 실패가 아니다.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        flash('failed');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    flash((await copyToClipboard(shareUrl)) ? 'copied' : 'failed');
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.button} ${styles.primary}`}
        onClick={shareImage}
        disabled={busy}
      >
        {feedback === 'saved' ? '저장했어요' : '이미지로 공유'}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.secondary}`}
        onClick={copyLink}
      >
        {feedback === 'copied' ? '복사했어요' : '링크 복사'}
      </button>
      {/* 되돌리기는 눈에 띌 필요가 없다. 공유 두 개가 주인공이다. */}
      <button type="button" className={styles.reset} onClick={onReset}>
        초기화
      </button>
      {feedback === 'failed' ? (
        <span className={styles.failed} role="status">
          잘 안 됐어요. 다시 눌러보세요.
        </span>
      ) : null}
    </div>
  );
}
