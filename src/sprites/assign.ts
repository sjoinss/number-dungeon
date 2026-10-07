import type { CustomSprites, PixelSprite } from "../lib/schema";
import { DEFAULT_BOSS, DEFAULT_HERO, DEFAULT_MONSTERS } from "./defaults";
import { BOSS_MOB, MONSTER_MOBS, type MobId } from "./mobs";

/**
 * 몬스터 외형 배정 (기획서 10.1): 몬스터 id로 고정 — 같은 몬스터는 재시작해도, 숫자가 바뀌어도 같은 외형.
 * 외형과 숫자(power)는 서로 상관없다 (마크모드를 켜고 꺼도 규칙·숫자는 같다).
 */

/** 문자열 → 0 이상의 정수 (FNV-1a) */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function slotFor(stageId: string, roomId: string, slots: number): number {
  return hashId(`${stageId}/${roomId}`) % slots;
}

/** 꾸미기 칸 목록 → 실제로 쓸 몬스터 그림들 (빈 기본 칸은 기본 그림) */
export function monsterSprites(custom: CustomSprites): PixelSprite[] {
  return custom.monsters.map((m, i) => m ?? DEFAULT_MONSTERS[i % DEFAULT_MONSTERS.length]);
}

export function heroSprite(custom: CustomSprites): PixelSprite {
  return custom.hero ?? DEFAULT_HERO;
}

export function bossSprite(custom: CustomSprites): PixelSprite {
  return custom.boss ?? DEFAULT_BOSS;
}

export function mobFor(stageId: string, roomId: string, isBoss: boolean): MobId {
  return isBoss ? BOSS_MOB : MONSTER_MOBS[slotFor(stageId, roomId, MONSTER_MOBS.length)];
}
