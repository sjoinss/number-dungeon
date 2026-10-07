/**
 * 저장 데이터 모델. 저장소에서 읽은 값은 모두 validate(아래)를 거친 뒤에만 이 타입으로 다룬다.
 */

/** 도트 한 칸의 색: "#rrggbb"(소문자) 또는 투명("") */
export type PixelColor = string;

export const TRANSPARENT: PixelColor = "";

export type PixelSprite = {
  kind: "pixel";
  width: number;
  height: number;
  /** 길이 = width × height, 왼쪽 위부터 행 순서 */
  pixels: PixelColor[];
};

/** 에디터 격자 크기 (기획서 10.2 — 정사각형 16×16 / 32×32) */
export const GRID_SIZES = [16, 32] as const;
export type GridSize = (typeof GRID_SIZES)[number];

/** 꾸미기: null이면 기본 그림 */
export type CustomSprites = {
  hero: PixelSprite | null;
  boss: PixelSprite | null;
  /** 몬스터 외형 칸. 길이 ≥ 기본 몬스터 수, 기본 칸은 null이면 기본 그림, 추가 칸은 그림이 있어야 한다 */
  monsters: (PixelSprite | null)[];
};

export const MAX_MONSTER_SLOTS = 10;

const HEX = /^#[0-9a-f]{6}$/;

export function isPixelSprite(v: unknown): v is PixelSprite {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<PixelSprite>;
  return (
    s.kind === "pixel" &&
    typeof s.width === "number" &&
    typeof s.height === "number" &&
    (GRID_SIZES as readonly number[]).includes(s.width) &&
    s.width === s.height &&
    Array.isArray(s.pixels) &&
    s.pixels.length === s.width * s.height &&
    s.pixels.every((p) => p === "" || (typeof p === "string" && HEX.test(p)))
  );
}

/** 저장소에서 읽은 값 → 꾸미기 데이터. 이상한 칸은 기본으로 되돌린다 */
export function parseCustomSprites(raw: unknown, defaultMonsterCount: number): CustomSprites {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hero = isPixelSprite(r.hero) ? r.hero : null;
  const boss = isPixelSprite(r.boss) ? r.boss : null;
  const list = Array.isArray(r.monsters) ? r.monsters.slice(0, MAX_MONSTER_SLOTS) : [];
  const monsters: (PixelSprite | null)[] = [];
  list.forEach((m, i) => {
    if (isPixelSprite(m)) monsters.push(m);
    else if (i < defaultMonsterCount) monsters.push(null);
  });
  while (monsters.length < defaultMonsterCount) monsters.push(null);
  return { hero, boss, monsters };
}
