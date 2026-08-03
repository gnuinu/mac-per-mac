/**
 * PWA 아이콘 PNG를 생성한다. `node scripts/generate-icons.mjs`
 *
 * 이미지 편집기나 외부 의존성 없이 재현할 수 있도록 픽셀을 직접 그린다.
 * 색은 src/styles/tokens.css의 라이트 테마 값과 맞춰둔다.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public');

const PAPER = [0xf6, 0xf4, 0xef];
const ACCENT = [0x1f, 0x6f, 0x5c];

// ── PNG 인코딩 ──────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10~12: compression / filter / interlace = 0

  // 각 스캔라인 앞에 필터 바이트(0)를 붙인다.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const src = y * size * 4;
    const dst = y * (size * 4 + 1);
    raw[dst] = 0;
    rgba.copy(raw, dst + 1, src, src + size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 도형 ────────────────────────────────────────────────────────────────

/** 단위 좌표(0..1)에서 그 점이 버거 안에 있는지. */
function inBurger(x, y) {
  const ellipse = (cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const bar = (top, bottom) => x >= 0.2 && x <= 0.8 && y >= top && y <= bottom;

  // 윗빵 (돔) — 참깨 세 알은 구멍으로 뚫는다.
  if (y <= 0.47 && ellipse(0.5, 0.47, 0.3, 0.19)) {
    for (const [sx, sy] of [
      [0.38, 0.38],
      [0.5, 0.35],
      [0.62, 0.38],
    ]) {
      if (ellipse(sx, sy, 0.028, 0.028)) return false;
    }
    return true;
  }

  if (bar(0.5, 0.55)) return true; // 치즈
  if (bar(0.58, 0.63)) return true; // 패티
  if (y >= 0.66 && ellipse(0.5, 0.66, 0.3, 0.12)) return true; // 아랫빵

  return false;
}

const SUPERSAMPLE = 3;

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      // 서브픽셀 샘플링으로 계단을 눌러준다.
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (inBurger(x, y)) hits += 1;
        }
      }

      const t = hits / (SUPERSAMPLE * SUPERSAMPLE);
      const offset = (py * size + px) * 4;
      for (let c = 0; c < 3; c += 1) {
        rgba[offset + c] = Math.round(PAPER[c] * (1 - t) + ACCENT[c] * t);
      }
      rgba[offset + 3] = 255;
    }
  }

  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, render(size));
  console.log(`wrote ${file}`);
}
