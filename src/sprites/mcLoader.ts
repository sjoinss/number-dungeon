import { loadCrossOriginImage } from "../editor/imageLoad";
import { isPixelSprite, type PixelSprite } from "../lib/schema";
import type { KeyValueStore } from "../lib/storage";
import { compose } from "./chibi";
import { MOBS, TEXTURE_MIRRORS, type MobId } from "./mobs";

/**
 * 마크모드 몹 그림 불러오기 (브라우저 전용).
 * 미러를 차례로 시도해 텍스처를 받고 → 꼬마 도트로 바꾼 결과만 이 기기 IndexedDB에 둔다 (다음부터는 바로).
 * 텍스처 파일 자체는 저장소·배포물에 넣지 않는다.
 */

export type MobSprites = Record<MobId, PixelSprite>;

const CACHE_KEY = "mc.mobs.v1";

export async function cachedMobs(store: KeyValueStore): Promise<MobSprites | null> {
  try {
    const raw = await store.get<Record<string, unknown>>(CACHE_KEY);
    if (!raw) return null;
    const ids = Object.keys(MOBS) as MobId[];
    if (!ids.every((id) => isPixelSprite(raw[id]))) return null;
    return raw as MobSprites;
  } catch {
    return null;
  }
}

async function loadTexture(path: string) {
  for (const mirror of TEXTURE_MIRRORS) {
    try {
      return await loadCrossOriginImage(mirror(path));
    } catch {
      // 다음 미러로
    }
  }
  throw new Error(path);
}

export async function fetchMobs(store: KeyValueStore): Promise<MobSprites> {
  const entries = await Promise.all(
    (Object.keys(MOBS) as MobId[]).map(async (id) => {
      const mob = MOBS[id];
      const tex = await loadTexture(mob.texture);
      if (tex.width !== mob.size[0] || tex.height !== mob.size[1]) throw new Error(`${id} 크기가 다름`);
      return [id, compose(tex, mob.parts)] as const;
    }),
  );
  const result = Object.fromEntries(entries) as MobSprites;
  try {
    await store.set(CACHE_KEY, result);
  } catch {
    // 저장 못 해도 이번 실행에는 쓴다
  }
  return result;
}

export async function clearMobCache(store: KeyValueStore) {
  await store.delete(CACHE_KEY);
}
