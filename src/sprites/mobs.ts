import { CHIBI, humanoidParts, type PartSpec } from "./chibi";

/**
 * 마크모드 몹 매핑 표 (기획서 12장).
 * 텍스처는 저장소에 넣지 않고 실행할 때 공개 에셋 미러에서 받는다 (사용자 결정: 미러만 — 이전 프로젝트 minecraftimg와 같은 방식).
 * 몹마다 텍스처 배치(UV)가 달라서 "앞면 영역 → 꼬마 칸 자리"를 데이터로 적는다.
 * UV는 1.21.4 텍스처로 확인했다 (상자 모양 w×h×d가 uv(u, v)에 펼쳐지면 앞면은 (u+d, v+d, w, h)).
 */

export const MC_VERSION = "1.21.4";

export const TEXTURE_MIRRORS = [
  (path: string) => `https://assets.mcasset.cloud/${MC_VERSION}/assets/minecraft/textures/${path}.png`,
  (path: string) => `https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@${MC_VERSION}/assets/minecraft/textures/${path}.png`,
] as const;

export type MobId = "zombie" | "skeleton" | "creeper" | "spider" | "wither_skeleton";

export type MobMap = {
  id: MobId;
  name: string;
  /** textures/ 아래 경로 (확장자 없음) */
  texture: string;
  size: [number, number];
  parts: PartSpec[];
};

const S = CHIBI.size;

/** 크리퍼: 팔 없음, 다리 4×6×4 (앞에서 보면 두 개) */
function creeperParts(): PartSpec[] {
  const head = { x: 8, y: 8, w: 8, h: 8 };
  const body = { x: 20, y: 20, w: 8, h: 12 };
  const leg = { x: 4, y: 20, w: 4, h: 6 };
  const legH = 5;
  const bodyH = 7;
  const legY = S - legH;
  const bodyY = legY - bodyH;
  const left = (S - 8) / 2;
  return [
    { src: leg, dst: { x: left, y: legY, w: 4, h: legH } },
    { src: leg, dst: { x: left + 4, y: legY, w: 4, h: legH }, mirror: true },
    { src: body, dst: { x: left, y: bodyY, w: 8, h: bodyH } },
    { src: head, dst: { x: (S - 16) / 2, y: bodyY - 16, w: 16, h: 16 } },
  ];
}

/** 거미: 큰 배 뒤에, 다리 네 쌍을 양옆으로, 머리를 앞에 크게 */
function spiderParts(): PartSpec[] {
  const abdomen = { x: 12, y: 24, w: 10, h: 8 };
  const leg = { x: 20, y: 2, w: 16, h: 2 };
  const head = { x: 40, y: 12, w: 8, h: 8 };
  const parts: PartSpec[] = [{ src: abdomen, dst: { x: 6, y: 8, w: 20, h: 14 } }];
  for (const [i, y] of [14, 18, 22, 26].entries()) {
    const len = 10 - Math.abs(i - 1.5) * 2;
    parts.push({ src: leg, dst: { x: 0 + (10 - len), y, w: len, h: 2 } });
    parts.push({ src: leg, dst: { x: S - 10, y, w: len, h: 2 }, mirror: true });
  }
  parts.push({ src: head, dst: { x: 8, y: 14, w: 16, h: 16 } });
  return parts;
}

/** 스켈레톤 계열: 팔·다리가 2×12×2 (64×32 텍스처) */
const skeletonFaces = {
  head: { x: 8, y: 8, w: 8, h: 8 },
  hat: { x: 40, y: 8, w: 8, h: 8 },
  body: { x: 20, y: 20, w: 8, h: 12 },
  armL: { x: 42, y: 18, w: 2, h: 12 },
  legL: { x: 2, y: 18, w: 2, h: 12 },
};

export const MOBS: Record<MobId, MobMap> = {
  zombie: {
    id: "zombie",
    name: "좀비",
    texture: "entity/zombie/zombie",
    size: [64, 64],
    parts: humanoidParts({
      head: { x: 8, y: 8, w: 8, h: 8 },
      hat: { x: 40, y: 8, w: 8, h: 8 },
      body: { x: 20, y: 20, w: 8, h: 12 },
      bodyOver: { x: 20, y: 36, w: 8, h: 12 },
      armL: { x: 44, y: 20, w: 4, h: 12 },
      armLOver: { x: 44, y: 36, w: 4, h: 12 },
      legL: { x: 4, y: 20, w: 4, h: 12 },
      legLOver: { x: 4, y: 36, w: 4, h: 12 },
      // 좀비 텍스처는 64×64지만 왼팔·왼다리 자리가 비어 있다 → 오른쪽을 뒤집어 쓴다 (게임도 같은 방식)
    }),
  },
  skeleton: {
    id: "skeleton",
    name: "스켈레톤",
    texture: "entity/skeleton/skeleton",
    size: [64, 32],
    parts: humanoidParts(skeletonFaces),
  },
  creeper: { id: "creeper", name: "크리퍼", texture: "entity/creeper/creeper", size: [64, 32], parts: creeperParts() },
  spider: { id: "spider", name: "거미", texture: "entity/spider/spider", size: [64, 32], parts: spiderParts() },
  wither_skeleton: {
    id: "wither_skeleton",
    name: "위더 스켈레톤",
    texture: "entity/skeleton/wither_skeleton",
    size: [64, 32],
    parts: humanoidParts(skeletonFaces),
  },
};

/** 일반 몬스터에 돌려 쓰는 몹 (보스는 위더 스켈레톤) */
export const MONSTER_MOBS: MobId[] = ["zombie", "skeleton", "creeper", "spider"];
export const BOSS_MOB: MobId = "wither_skeleton";
