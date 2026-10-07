"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Stars } from "@/game/stars";
import {
  DEFAULT_SETTINGS,
  loadProgress,
  loadSettings,
  recordClear,
  saveProgress,
  saveSettings,
  type Progress,
  type Settings,
} from "@/lib/prefs";
import { parseCustomSprites, type CustomSprites } from "@/lib/schema";
import { playSfx, type Sfx } from "@/lib/sound";
import { MemoryStore, openStorage, type KeyValueStore, type StorageError } from "@/lib/storage";
import { DEFAULT_MONSTERS } from "@/sprites/defaults";
import { cachedMobs, fetchMobs, type MobSprites } from "@/sprites/mcLoader";

/**
 * 앱 전체가 함께 쓰는 데이터: 꾸민 그림(IndexedDB), 진행·설정(localStorage), 마크 몹 그림, 효과음.
 */

const SPRITES_KEY = "sprites";

export type MobState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; sprites: MobSprites }
  | { status: "error"; message: string };

type GameDataApi = {
  ready: boolean;
  /** 저장소를 못 열어 이번 실행 동안만 기억하는 경우 원인 */
  storageError: StorageError | null;
  custom: CustomSprites;
  /** 저장 성공 여부 (실패하면 화면에서 알린다) */
  saveCustom: (next: CustomSprites) => Promise<boolean>;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  progress: Progress;
  addClear: (stageId: string, stars: Stars, penalty: number) => void;
  resetProgress: () => void;
  mobs: MobState;
  loadMobs: () => void;
  sfx: (kind: Sfx) => void;
};

const Ctx = createContext<GameDataApi | null>(null);

const EMPTY_CUSTOM: CustomSprites = { hero: null, boss: null, monsters: DEFAULT_MONSTERS.map(() => null) };

export function GameDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const store = useRef<KeyValueStore>(new MemoryStore());
  const [storageError, setStorageError] = useState<StorageError | null>(null);
  const [custom, setCustom] = useState<CustomSprites>(EMPTY_CUSTOM);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<Progress>({});
  const [mobs, setMobs] = useState<MobState>({ status: "idle" });

  useEffect(() => {
    setSettings(loadSettings());
    setProgress(loadProgress());
    let alive = true;
    (async () => {
      const opened = await openStorage();
      store.current = opened.store;
      if (opened.error) setStorageError(opened.error);
      try {
        const raw = await opened.store.get(SPRITES_KEY);
        if (alive) setCustom(parseCustomSprites(raw, DEFAULT_MONSTERS.length));
      } catch {
        // 읽기 실패: 기본 그림으로 계속
      }
      const cached = await cachedMobs(opened.store);
      if (alive && cached) setMobs({ status: "ready", sprites: cached });
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 모션 줄이기 설정을 문서에 반영 (CSS가 애니메이션을 끈다)
  useEffect(() => {
    document.documentElement.dataset.motion = settings.reduceMotion ? "reduce" : "";
  }, [settings.reduceMotion]);

  const saveCustom = useCallback(async (next: CustomSprites) => {
    setCustom(next);
    try {
      await store.current.set(SPRITES_KEY, next);
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const addClear = useCallback((stageId: string, stars: Stars, penalty: number) => {
    setProgress((prev) => {
      const next = recordClear(prev, stageId, stars, penalty);
      if (next !== prev) saveProgress(next);
      return next;
    });
  }, []);

  const resetProgress = useCallback(() => {
    setProgress({});
    saveProgress({});
  }, []);

  const loading = useRef(false);
  const loadMobs = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    setMobs({ status: "loading" });
    fetchMobs(store.current)
      .then((sprites) => setMobs({ status: "ready", sprites }))
      .catch(() =>
        setMobs({
          status: "error",
          message: "마인크래프트 리소스를 받아오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
        }),
      )
      .finally(() => {
        loading.current = false;
      });
  }, []);

  // 마크모드가 켜져 있는데 그림이 없으면 받아온다
  useEffect(() => {
    if (ready && settings.mcMode && mobs.status === "idle") loadMobs();
  }, [ready, settings.mcMode, mobs.status, loadMobs]);

  const soundOn = settings.sound;
  const sfx = useCallback((kind: Sfx) => {
    if (soundOn) playSfx(kind);
  }, [soundOn]);

  const api = useMemo<GameDataApi>(
    () => ({ ready, storageError, custom, saveCustom, settings, updateSettings, progress, addClear, resetProgress, mobs, loadMobs, sfx }),
    [ready, storageError, custom, saveCustom, settings, updateSettings, progress, addClear, resetProgress, mobs, loadMobs, sfx],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useGameData(): GameDataApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGameData는 GameDataProvider 안에서만");
  return v;
}
