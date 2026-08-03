import {
  formatCalories,
  formatHeight,
  formatKoreanNumber,
  formatWon,
  formatWorkTime,
} from '../domain/format';
import type { BigMacResult } from '../domain/types';

/**
 * 공유 카드 Canvas 렌더러. React를 모르고, DOM에서는 canvas만 만진다.
 *
 * 웹폰트를 쓰지 않기 때문에 폰트 로딩을 기다릴 필요가 없다 —
 * 시스템 스택으로 바로 그린다.
 */

export interface CardInput {
  subject: string;
  priceKRW: number;
  bigMacPriceKRW: number;
  result: BigMacResult;
  /** "추정치" 같은 꼬리표. 없으면 생략. */
  badge?: string;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 96;

/**
 * 라이트 테마로 고정한다. 공유된 이미지가 보는 사람 설정에 따라 달라지면 곤란하다.
 * 값은 tokens.css의 라이트 팔레트와 맞춰둔다 — 한쪽만 바꾸면 카드가 앱과 달라 보인다.
 */
const PAPER = '#f2f0ea';
const INK = '#17171a';
const MUTED = '#8b8a85';
const RULE = '#e0dcd2';
const ACCENT = '#146b58';

const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
const MONO =
  'ui-monospace, "SF Mono", SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace';

function dashedLine(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.save();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(WIDTH - PAD, y);
  ctx.stroke();
  ctx.restore();
}

/** 라벨 … 점선 … 우측 정렬 값. 화면의 MetricRow와 같은 골격. */
function metricRow(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  value: string,
  sub?: string,
): number {
  ctx.textBaseline = 'alphabetic';

  ctx.font = `28px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText(label, PAD, y);
  const labelWidth = ctx.measureText(label).width;

  ctx.font = `600 36px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(value, WIDTH - PAD, y);
  const valueWidth = ctx.measureText(value).width;

  ctx.save();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 8]);
  ctx.beginPath();
  ctx.moveTo(PAD + labelWidth + 20, y - 8);
  ctx.lineTo(WIDTH - PAD - valueWidth - 20, y - 8);
  ctx.stroke();
  ctx.restore();

  if (sub) {
    ctx.font = `24px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.fillText(sub, WIDTH - PAD, y + 34);
    return y + 96;
  }
  return y + 76;
}

/** 화면의 SVG와 같은 형태를 canvas path로 옮긴 것. */
function drawBurger(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(2.5, 7.5);
  ctx.bezierCurveTo(2.5, 4.2, 6.8, 1.8, 12, 1.8);
  ctx.bezierCurveTo(17.2, 1.8, 21.5, 4.2, 21.5, 7.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(2.9, 7.6);
  ctx.lineTo(21.1, 7.6);
  ctx.moveTo(3.4, 12.6);
  ctx.lineTo(20.6, 12.6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(4.2, 10.1);
  ctx.bezierCurveTo(5.6, 11.2, 6.8, 9.2, 8.2, 10);
  ctx.bezierCurveTo(9.6, 10.8, 10.7, 11.2, 12.1, 10.4);
  ctx.bezierCurveTo(13.5, 9.6, 14.5, 9.3, 15.9, 10.1);
  ctx.bezierCurveTo(17.3, 10.9, 18.5, 11, 19.8, 9.9);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(3, 14.9);
  ctx.bezierCurveTo(3, 17, 6.4, 18.2, 12, 18.2);
  ctx.bezierCurveTo(17.6, 18.2, 21, 17, 21, 14.9);
  ctx.stroke();

  ctx.restore();
}

/**
 * 하단 격자 영역. 캔버스 밖으로 흘러나가거나 푸터와 겹치지 않도록
 * 위/아래 경계를 고정하고, 몇 개가 들어가는지는 여기서 역산한다.
 */
const GRID_TOP = 1030;
const GRID_BOTTOM = 1245;
const ICON_SIZE = 48;
const ICON_GAP = 10;
const FOOTER_Y = 1300;

export function renderCard(input: CardInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 위쪽에 강조색이 아주 옅게 번지는 것까지 화면과 맞춘다.
  // 반경 밖은 완전히 투명하므로 캔버스 전체를 칠해야 경계선이 안 생긴다.
  const wash = ctx.createRadialGradient(WIDTH / 2, 0, 0, WIDTH / 2, 0, HEIGHT * 0.55);
  wash.addColorStop(0, 'rgba(20, 107, 88, 0.07)');
  wash.addColorStop(1, 'rgba(20, 107, 88, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 종이 질감. 예전의 가로 줄무늬 대신 미세한 노이즈 한 겹.
  // 시드 고정 난수라서 같은 입력이면 같은 이미지가 나온다.
  let seed = 20260220;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  ctx.fillStyle = 'rgba(23, 23, 26, 0.045)';
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillRect(rand() * WIDTH, rand() * HEIGHT, 1.5, 1.5);
  }

  ctx.textBaseline = 'alphabetic';

  // 머리말
  ctx.font = `600 26px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('빅맥계산기', PAD, 120);

  ctx.textAlign = 'right';
  ctx.fillText(formatWon(input.priceKRW), WIDTH - PAD, 120);

  dashedLine(ctx, 156);

  // 무엇을 환산했는지
  ctx.font = `32px ${SANS}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  const subject =
    input.subject.length > 24 ? `${input.subject.slice(0, 23)}…` : input.subject;
  ctx.fillText(subject, PAD, 228);

  if (input.badge) {
    ctx.font = `22px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.fillText(input.badge, WIDTH - PAD, 228);
  }

  // 주인공: 큰 숫자
  ctx.textAlign = 'left';
  ctx.font = `700 168px ${MONO}`;
  ctx.fillStyle = ACCENT;
  const countText = formatKoreanNumber(input.result.wholeCount);
  ctx.fillText(countText, PAD, 400);

  const countWidth = ctx.measureText(countText).width;
  ctx.font = `600 52px ${MONO}`;
  ctx.fillText('개', PAD + countWidth + 16, 400);

  ctx.font = `26px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('빅맥', PAD, 448);

  dashedLine(ctx, 500);

  // 지표
  const height = formatHeight(input.result.stackHeightCm);
  const work = formatWorkTime(input.result.workHours);

  let y = 570;
  y = metricRow(ctx, y, '총 열량', formatCalories(input.result.calories));
  y = metricRow(ctx, y, '쌓은 높이', height.value, height.analogy);
  y = metricRow(ctx, y, '필요 노동시간', work.text, work.note || undefined);

  if (input.result.remainderKRW > 0 && input.result.wholeCount > 0) {
    ctx.font = `26px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left';
    ctx.fillText(
      `그리고 ${formatWon(input.result.remainderKRW)}이 남아요.`,
      PAD,
      y + 6,
    );
  }

  dashedLine(ctx, GRID_TOP - 40);

  // 격자 — 영역에 들어가는 만큼만 그리고 나머지는 "…외 N개"로 줄인다.
  const step = ICON_SIZE + ICON_GAP;
  const perRow = Math.floor((WIDTH - PAD * 2 + ICON_GAP) / step);
  const rows = Math.floor((GRID_BOTTOM - GRID_TOP + ICON_GAP) / step);
  const capacity = Math.max(0, perRow * rows);

  const whole = Math.floor(input.result.wholeCount);
  const drawn = Math.min(whole, capacity);
  for (let i = 0; i < drawn; i += 1) {
    drawBurger(
      ctx,
      PAD + (i % perRow) * step,
      GRID_TOP + Math.floor(i / perRow) * step,
      ICON_SIZE,
    );
  }

  // 푸터
  ctx.font = `22px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText(`빅맥 1개 = ${formatWon(input.bigMacPriceKRW)}`, PAD, FOOTER_Y);

  const hidden = whole - drawn;
  if (hidden > 0) {
    ctx.font = `22px ${MONO}`;
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'right';
    ctx.fillText(`…외 ${formatKoreanNumber(hidden)}개`, WIDTH - PAD, FOOTER_Y);
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('이미지를 만들지 못했습니다'));
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
