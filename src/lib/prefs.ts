import type { Stars } from "../game/stars";

/**
 * 진행 상황(클리어·별)과 설정은 localStorage (기획서 10.4). 그림은 IndexedDB(storage.ts).
 * 시크릿 모드 등으로 localStorage를 못 쓰면 이번 실행 동안만 기억한다.
 */

const PROGRESS_KEY = "number-dungeon.progress";
const SETTINGS_KEY = "number-dungeon.settings";

export type StageRecord = { stars: Stars; bestPenalty: number };
export type Progress = Record<string, StageRecord>;

export type Settings = {
  /** 마크모드: 몬스터를 마인크래프트 몹 외형으로 */
  mcMode: boolean;
  sound: boolean;
  /** 모션 줄이기 (운영체제 설정과 별개로 게임에서 켤 수 있음) */
  reduceMotion: boolean;
};

export const DEFAULT_SETTINGS: Settings = { mcMode: false, sound: true, reduceMotion: false };

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** 저장에 실패하면 false (화면에서 알린다) */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadProgress(): Progress {
  const raw = read(PROGRESS_KEY);
  const out: Progress = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as Partial<StageRecord>;
    if ((r?.stars === 1 || r?.stars === 2 || r?.stars === 3) && typeof r.bestPenalty === "number") {
      out[id] = { stars: r.stars, bestPenalty: r.bestPenalty };
    }
  }
  return out;
}

export function saveProgress(p: Progress) {
  return write(PROGRESS_KEY, p);
}

/** 클리어 기록: 더 좋은 기록만 남긴다 */
export function recordClear(p: Progress, id: string, stars: Stars, penalty: number): Progress {
  const old = p[id];
  if (old && old.stars >= stars && old.bestPenalty <= penalty) return p;
  return { ...p, [id]: { stars: Math.max(old?.stars ?? 1, stars) as Stars, bestPenalty: Math.min(old?.bestPenalty ?? Infinity, penalty) } };
}

export function loadSettings(): Settings {
  const raw = read(SETTINGS_KEY);
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  return {
    mcMode: typeof r.mcMode === "boolean" ? r.mcMode : DEFAULT_SETTINGS.mcMode,
    sound: typeof r.sound === "boolean" ? r.sound : DEFAULT_SETTINGS.sound,
    reduceMotion: typeof r.reduceMotion === "boolean" ? r.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
  };
}

export function saveSettings(s: Settings) {
  return write(SETTINGS_KEY, s);
}
