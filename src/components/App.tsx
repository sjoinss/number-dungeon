"use client";

import { useEffect, useState } from "react";
import { dateSeed, generateStage } from "@/game/generator";
import { STAGES, stageIndex } from "@/game/levels";
import type { Stage } from "@/game/types";
import { GameDataProvider, useGameData } from "./GameData";
import { CustomizeScreen } from "./screens/CustomizeScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StageSelectScreen } from "./screens/StageSelectScreen";
import { TitleScreen } from "./screens/TitleScreen";
import { ToastProvider } from "./ui/Toast";
import styles from "./App.module.css";

export function App() {
  return (
    <ToastProvider>
      <GameDataProvider>
        <Screens />
      </GameDataProvider>
    </ToastProvider>
  );
}

type Screen =
  | { name: "title" }
  | { name: "stages" }
  | { name: "play"; stage: Stage; daily?: boolean }
  | { name: "custom" }
  | { name: "settings" };

/** 매일 도전: 날짜 시드로 생성기가 만든 스테이지 (모든 사람이 그날 같은 판) */
function dailyStage(now = new Date()): Stage | null {
  const seed = dateSeed(now);
  const res = generateStage(seed, {
    id: `daily-${seed}`,
    title: "오늘의 도전",
    gates: 1,
    items: 1,
    traps: 1,
    poison: 1,
    chests: 1,
    size: 12,
    undoLimit: 3,
    tries: 300,
  });
  if (!res) return null;
  return { ...res.stage, intro: "날마다 바뀌는 판이에요. 오늘의 판은 모두 같아요." };
}

function Screens() {
  const [screen, setScreen] = useState<Screen>({ name: "title" });
  const { progress } = useGameData();
  // 날짜는 브라우저에서 정한다 (정적 빌드 때 날짜로 굳지 않게)
  const [daily, setDaily] = useState<Stage | null>(null);
  useEffect(() => setDaily(dailyStage()), []);

  // 이어하기: 아직 못 깬 첫 스테이지 (모두 깼으면 마지막)
  const nextStage = STAGES.find((s) => !progress[s.id]) ?? STAGES[STAGES.length - 1];

  const play = (stage: Stage, isDaily = false) => setScreen({ name: "play", stage, daily: isDaily });

  return (
    <div className={styles.app}>
      {screen.name === "title" && (
        <TitleScreen
          continueStage={nextStage}
          started={Object.keys(progress).length > 0}
          onPlay={() => play(nextStage)}
          onStages={() => setScreen({ name: "stages" })}
          onCustom={() => setScreen({ name: "custom" })}
          onSettings={() => setScreen({ name: "settings" })}
        />
      )}
      {screen.name === "stages" && (
        <StageSelectScreen
          daily={daily}
          onBack={() => setScreen({ name: "title" })}
          onPlay={(s, isDaily) => play(s, isDaily)}
        />
      )}
      {screen.name === "play" && (
        <PlayScreen
          key={screen.stage.id}
          stage={screen.stage}
          daily={screen.daily ?? false}
          nextStage={screen.daily ? null : STAGES[stageIndex(screen.stage.id) + 1] ?? null}
          onNext={(s) => play(s)}
          onExit={() => setScreen({ name: "stages" })}
        />
      )}
      {screen.name === "custom" && <CustomizeScreen onBack={() => setScreen({ name: "title" })} />}
      {screen.name === "settings" && <SettingsScreen onBack={() => setScreen({ name: "title" })} />}
    </div>
  );
}
