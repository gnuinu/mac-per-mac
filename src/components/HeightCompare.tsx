import { useMemo } from 'react';
import {
  PERSON_HEIGHT_CM,
  formatCount,
  type HeightComparison,
} from '../domain/format';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  BURGER_TILE,
  LANDMARK_SPRITES,
  PERSON,
  parseSprite,
  type ParsedSprite,
} from './pixel/sprites';
import styles from './HeightCompare.module.css';

interface Props {
  /** 쌓은 높이 (cm). */
  stackCm: number;
  comparison: HeightComparison;
  /** 실제 빅맥 개수. 스택 라벨에 쓴다. */
  burgerCount: number;
}

/*
 * 그림판 좌표. 높이는 고정, 가로 폭은 내용에 맞춰 계산한다.
 * 폭을 고정해두면 스프라이트가 작을 때 가운데가 휑하게 비어 두 대상을
 * 눈으로 견주기 어려워진다.
 */
const VIEW_H = 92;
const GROUND_Y = 84;
const TOP_PAD = 6;
const MAX_H = GROUND_Y - TOP_PAD;
const SIDE_PAD = 8;
/** 사람과 기둥 사이 / 기둥과 랜드마크 사이 간격. */
const GAP_PERSON = 12;
const GAP_GROUP = 26;

/**
 * 이 배율을 넘으면 작은 쪽이 1px 밑으로 내려가 아무것도 안 보인다.
 * 그때는 실제 비율 대신 "잘림 표시 + 배수"로 바꾼다. 인포그래픽의 관례다.
 */
const MAX_TRUE_RATIO = 7;
/** 잘림 모드에서 랜드마크에 주는 고정 높이. */
const CLAMPED_LANDMARK_H = 26;

/** 너무 납작한 스프라이트가 화면 밖으로 나가지 않게. */
const MAX_SPRITE_W = 72;

/** 빅맥 기둥에 그릴 최대 층수. 적을수록 층이 굵고 "쌓인" 느낌이 산다. */
const MAX_TILES = 16;

interface Placed {
  sprite: ParsedSprite;
  /** 한 픽셀 칸의 변 길이. */
  unit: number;
  w: number;
  h: number;
}

function place(sprite: ParsedSprite, height: number): Placed {
  const capped = Math.min(height, (MAX_SPRITE_W * sprite.rows) / sprite.cols);
  const unit = capped / sprite.rows;
  return { sprite, unit, w: unit * sprite.cols, h: capped };
}

function Pixels({
  placed,
  x,
  animate,
}: {
  placed: Placed;
  /** 스프라이트 가로 중심. */
  x: number;
  animate: boolean;
}) {
  const { sprite, unit, w, h } = placed;
  const left = x - w / 2;
  const top = GROUND_Y - h;

  return (
    <g
      className={animate ? styles.grow : undefined}
      style={{ transformOrigin: `${x}px ${GROUND_Y}px` }}
    >
      {sprite.runs.map((run, index) => (
        <rect
          key={index}
          x={left + run.x * unit}
          y={top + run.y * unit}
          width={run.w * unit}
          height={unit}
          opacity={run.faint ? 0.45 : 1}
        />
      ))}
    </g>
  );
}

/**
 * 쌓은 빅맥과 비유 대상을 실제 비율대로 나란히 세운다.
 *
 * 수치만으로는 "18.9km"가 얼마나 높은지 감이 안 오므로, 사람을 눈대중 기준으로
 * 함께 세워 크기를 읽을 수 있게 한다.
 */
export function HeightCompare({ stackCm, comparison, burgerCount }: Props) {
  const reducedMotion = useReducedMotion();
  const { landmark, ratio } = comparison;

  const sprites = useMemo(
    () => ({
      person: parseSprite(PERSON),
      burger: parseSprite(BURGER_TILE),
      landmark: parseSprite(LANDMARK_SPRITES[landmark.id]),
    }),
    [landmark.id],
  );

  if (!Number.isFinite(stackCm) || stackCm <= 0) return null;

  const clamped = ratio > MAX_TRUE_RATIO;

  // 큰 쪽이 그림판을 채우고, 작은 쪽은 실제 비율만큼 작아진다.
  const stackH = ratio >= 1 ? MAX_H : MAX_H * ratio;
  const landmarkH = clamped
    ? CLAMPED_LANDMARK_H
    : ratio >= 1
      ? MAX_H / ratio
      : MAX_H;

  const tallestCm = Math.max(stackCm, landmark.cm);
  const tallestH = Math.max(stackH, landmarkH);
  // 사람은 늘 실제 비율로. 2px보다 작아지면 점 하나로 남아 오히려 헷갈리니 뺀다.
  const personH = (PERSON_HEIGHT_CM / tallestCm) * tallestH;
  const showPerson = personH >= 4;

  const placedLandmark = place(sprites.landmark, landmarkH);
  const placedPerson = place(sprites.person, personH);

  // 빅맥 기둥: 한 층 높이를 정하고 그림판에 들어가는 만큼만 쌓는다.
  const stackUnit = Math.max(0.9, stackH / MAX_TILES / sprites.burger.rows);
  const tileH = stackUnit * sprites.burger.rows;
  const tileW = stackUnit * sprites.burger.cols;
  const tiles = Math.max(1, Math.min(Math.round(stackH / tileH), MAX_TILES));

  // 왼쪽부터 차곡차곡 놓고, 마지막 위치로 그림판 폭을 정한다.
  let cursor = SIDE_PAD;
  const personX = cursor + placedPerson.w / 2;
  if (showPerson) cursor = personX + placedPerson.w / 2 + GAP_PERSON;

  const stackX = cursor + tileW / 2;
  cursor = stackX + tileW / 2 + GAP_GROUP;

  const landmarkX = cursor + placedLandmark.w / 2;
  const viewW = landmarkX + placedLandmark.w / 2 + SIDE_PAD;

  return (
    <figure className={styles.wrap}>
      <svg
        className={styles.canvas}
        viewBox={`0 0 ${viewW} ${VIEW_H}`}
        role="img"
        aria-label={`쌓은 높이를 ${landmark.name}와 비교한 그림`}
        shapeRendering="crispEdges"
        fill="currentColor"
      >
        {/* 지면 */}
        <rect
          className={styles.ground}
          x={0}
          y={GROUND_Y}
          width={viewW}
          height={1}
        />

        {showPerson ? (
          <Pixels placed={placedPerson} x={personX} animate={!reducedMotion} />
        ) : null}

        <g
          className={`${styles.stack} ${reducedMotion ? '' : styles.grow}`}
          style={{ transformOrigin: `${stackX}px ${GROUND_Y}px` }}
        >
          {Array.from({ length: tiles }, (_, i) => {
            const top = GROUND_Y - (i + 1) * tileH;
            return sprites.burger.runs.map((run, index) => (
              <rect
                key={`${i}-${index}`}
                x={stackX - tileW / 2 + run.x * stackUnit}
                y={top + run.y * stackUnit}
                width={run.w * stackUnit}
                height={stackUnit}
                opacity={run.faint ? 0.45 : 1}
              />
            ));
          })}
        </g>

        {/* 실제 비율을 포기했다는 표시. 기둥을 한 번 끊는다. */}
        {clamped ? (
          <rect
            className={styles.break}
            x={stackX - tileW}
            y={TOP_PAD + 18}
            width={tileW * 2}
            height={6}
          />
        ) : null}

        <Pixels placed={placedLandmark} x={landmarkX} animate={!reducedMotion} />
      </svg>

      <figcaption className={styles.legend}>
        <span className={styles.item}>
          <em className={styles.swatch} aria-hidden="true" />
          빅맥 {formatCount(Math.floor(burgerCount))}
        </span>
        <span className={styles.item}>
          <em className={`${styles.swatch} ${styles.swatchMuted}`} aria-hidden="true" />
          {landmark.name}
          {showPerson ? ' · 옆은 사람 키' : ''}
        </span>
        {/* 실제 비율로 그리지 못했으면 그렇다고 밝힌다. */}
        {clamped ? <span className={styles.warn}>그림은 비율 축약</span> : null}
      </figcaption>
    </figure>
  );
}
