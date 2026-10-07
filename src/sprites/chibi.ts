import type { PixelSprite } from "../lib/schema";

/**
 * 귀여운 비율(치비) 조립 (기획서 11장).
 * 스킨/텍스처에서 머리·몸·팔·다리 "앞면"을 잘라 32×32 도트 칸에 머리는 크게, 몸은 작게 다시 붙인다.
 * 최근접 픽셀만 쓰고(도트 느낌 유지), 머리는 정수 배(2배)로 키운다.
 * 점프점프(jumping/src/editor/skin.ts)의 스킨 변환을 바탕으로, 몹마다 다른 텍스처 배치를 표(PartSpec 목록)로 받게 바꿨다.
 * 숫자는 이 그림 밖(머리 위 별도 영역)에 그리므로 여기서는 자리를 비우지 않는다.
 */

export type Face = { x: number; y: number; w: number; h: number };

/** 그릴 부위 하나: 텍스처의 src 면을 결과 칸의 dst에 (늘리거나 줄여) 옮긴다 */
export type PartSpec = {
  src: Face;
  dst: Face;
  /** 좌우 뒤집기 (예전 스킨의 왼팔·왼다리, 몹의 반대쪽 다리) */
  mirror?: boolean;
};

export type Texture = { rgba: Uint8ClampedArray; width: number; height: number };

/** 결과 크기와 꼬마 비율. 여기 숫자만 바꿔 비율을 조정한다 (머리는 정수 배 권장) */
export const CHIBI = {
  size: 32,
  headScale: 2,
  bodyW: 8,
  bodyH: 6,
  armW: 2,
  legW: 4,
  legH: 5,
  /** 모자(겉) 층은 머리보다 위·양옆으로 한 칸 크게 — 실제 게임처럼 바깥 층이 부풀어 보이게 */
  hatGrow: 1,
} as const;

const HEAD = 8 * CHIBI.headScale;
/** 전체 키(모자 포함) 중 머리 비율 — 기획서 권장 55~60% 안팎 */
export const CHIBI_HEAD_RATIO = (HEAD + CHIBI.hatGrow) / (CHIBI.hatGrow + HEAD + CHIBI.bodyH + CHIBI.legH);

/** 반투명은 이 값 이상이면 칠한 칸 */
const ALPHA_CUT = 128;

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

function pixel(t: Texture, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= t.width || y >= t.height) return "";
  const i = (y * t.width + x) * 4;
  if (t.rgba[i + 3] < ALPHA_CUT) return "";
  return `#${hex2(t.rgba[i])}${hex2(t.rgba[i + 1])}${hex2(t.rgba[i + 2])}`;
}

/** 표대로 붙여서 도트 칸으로 (뒤에 오는 부위가 위에 덮인다. 투명한 칸은 덮지 않는다) */
export function compose(t: Texture, parts: readonly PartSpec[], size: number = CHIBI.size): PixelSprite {
  const out = new Array<string>(size * size).fill("");
  for (const p of parts) {
    const { src, dst } = p;
    for (let oy = 0; oy < dst.h; oy++) {
      const fy = Math.min(src.h - 1, Math.floor(((oy + 0.5) * src.h) / dst.h));
      for (let ox = 0; ox < dst.w; ox++) {
        let fx = Math.min(src.w - 1, Math.floor(((ox + 0.5) * src.w) / dst.w));
        if (p.mirror) fx = src.w - 1 - fx;
        const c = pixel(t, src.x + fx, src.y + fy);
        const tx = dst.x + ox;
        const ty = dst.y + oy;
        if (c && tx >= 0 && ty >= 0 && tx < size && ty < size) out[ty * size + tx] = c;
      }
    }
  }
  return { kind: "pixel", width: size, height: size, pixels: out };
}

/** 사람형(플레이어·좀비·스켈레톤) 부위의 앞면 */
export type HumanoidFaces = {
  head: Face;
  hat?: Face;
  body: Face;
  bodyOver?: Face;
  /** 화면 왼쪽 = 캐릭터의 오른팔 */
  armL: Face;
  armLOver?: Face;
  /** 없으면 armL을 뒤집어 쓴다 */
  armR?: Face;
  armROver?: Face;
  legL: Face;
  legLOver?: Face;
  legR?: Face;
  legROver?: Face;
};

/** 사람형 꼬마 배치: 다리 → 몸 → 팔 → 머리 → 모자 순서. 아래쪽 끝에 맞춘다 */
export function humanoidParts(f: HumanoidFaces): PartSpec[] {
  const S = CHIBI.size;
  const legY = S - CHIBI.legH;
  const bodyY = legY - CHIBI.bodyH;
  const headY = bodyY - HEAD;
  const left = (S - CHIBI.bodyW) / 2;
  const headX = (S - HEAD) / 2;
  const parts: PartSpec[] = [];
  const add = (src: Face | undefined, dst: Face, mirror = false) => {
    if (src) parts.push({ src, dst, mirror });
  };
  const legL: Face = { x: left, y: legY, w: CHIBI.legW, h: CHIBI.legH };
  const legR: Face = { x: left + CHIBI.legW, y: legY, w: CHIBI.legW, h: CHIBI.legH };
  add(f.legL, legL);
  add(f.legLOver, legL);
  add(f.legR ?? f.legL, legR, !f.legR);
  add(f.legR ? f.legROver : undefined, legR);
  const body: Face = { x: left, y: bodyY, w: CHIBI.bodyW, h: CHIBI.bodyH };
  add(f.body, body);
  add(f.bodyOver, body);
  const armL: Face = { x: left - CHIBI.armW, y: bodyY, w: CHIBI.armW, h: CHIBI.bodyH };
  const armR: Face = { x: left + CHIBI.bodyW, y: bodyY, w: CHIBI.armW, h: CHIBI.bodyH };
  add(f.armL, armL);
  add(f.armLOver, armL);
  add(f.armR ?? f.armL, armR, !f.armR);
  add(f.armR ? f.armROver : undefined, armR);
  add(f.head, { x: headX, y: headY, w: HEAD, h: HEAD });
  const g = CHIBI.hatGrow;
  add(f.hat, { x: headX - g, y: headY - g, w: HEAD + g * 2, h: HEAD + g });
  return parts;
}

// ── 플레이어 스킨 (64×64 또는 예전 64×32) ──

export function isSkinSize(w: number, h: number) {
  return w === 64 && (h === 64 || h === 32);
}

function fullyOpaque(t: Texture, f: Face) {
  for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (!pixel(t, x, y)) return false;
  return true;
}

function emptyColumn(t: Texture, x: number, y: number, h: number) {
  for (let k = 0; k < h; k++) if (pixel(t, x, y + k)) return false;
  return true;
}

/** 스킨 → 앞면 위치 (기획서 11.2 표). 얇은 팔(3px)·예전 스킨(왼쪽 없음)·꽉 찬 모자 층을 처리한다 */
export function playerFaces(t: Texture): HumanoidFaces {
  const modern = t.height === 64;
  const armW = modern && emptyColumn(t, 47, 20, 12) ? 3 : 4;
  // 예전 스킨은 모자 층을 꽉 채워 둔 경우가 많다 — 모자 층 전체가 불투명하면 모자가 없는 것으로 본다
  const hatUsable = modern || !fullyOpaque(t, { x: 32, y: 0, w: 32, h: 16 });
  return {
    head: { x: 8, y: 8, w: 8, h: 8 },
    hat: hatUsable ? { x: 40, y: 8, w: 8, h: 8 } : undefined,
    body: { x: 20, y: 20, w: 8, h: 12 },
    bodyOver: modern ? { x: 20, y: 36, w: 8, h: 12 } : undefined,
    armL: { x: 44, y: 20, w: armW, h: 12 },
    armLOver: modern ? { x: 44, y: 36, w: armW, h: 12 } : undefined,
    armR: modern ? { x: 36, y: 52, w: armW, h: 12 } : undefined,
    armROver: modern ? { x: 52, y: 52, w: armW, h: 12 } : undefined,
    legL: { x: 4, y: 20, w: 4, h: 12 },
    legLOver: modern ? { x: 4, y: 36, w: 4, h: 12 } : undefined,
    legR: modern ? { x: 20, y: 52, w: 4, h: 12 } : undefined,
    legROver: modern ? { x: 4, y: 52, w: 4, h: 12 } : undefined,
  };
}

export function skinToChibi(t: Texture): PixelSprite {
  return compose(t, humanoidParts(playerFaces(t)));
}

