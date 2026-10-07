"use client";

import { useGameData } from "./GameData";
import { Switch } from "./ui/Switch";
import styles from "./SettingsPanel.module.css";

/** 소리·모션 스위치 (설정 화면과 플레이 중 설정 창이 함께 쓴다) */
export function SettingsPanel({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const { settings, updateSettings } = useGameData();
  const H = `h${headingLevel}` as const;
  return (
    <div className={styles.panel}>
      <section className={styles.section} aria-labelledby="set-etc">
        <H id="set-etc" className={styles.title}>
          소리·화면
        </H>
        <Switch label="효과음" checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
        <Switch
          label="모션 줄이기"
          description="움직임과 흔들림을 끕니다. 기기 설정에서 동작 줄이기를 켜도 줄어요."
          checked={settings.reduceMotion}
          onChange={(v) => updateSettings({ reduceMotion: v })}
        />
      </section>
    </div>
  );
}
