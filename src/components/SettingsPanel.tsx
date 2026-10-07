"use client";

import { useGameData } from "./GameData";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { InlineMessage } from "./ui/InlineMessage";
import { Switch } from "./ui/Switch";
import styles from "./SettingsPanel.module.css";

/** 마크모드·소리·모션 스위치 (설정 화면과 플레이 중 설정 창이 함께 쓴다) */
export function SettingsPanel({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const { settings, updateSettings, mobs, loadMobs } = useGameData();
  const H = `h${headingLevel}` as const;
  return (
    <div className={styles.panel}>
      <section className={styles.section} aria-labelledby="set-mc">
        <H id="set-mc" className={styles.title}>
          마크모드
        </H>
        <Switch
          label="몬스터를 마인크래프트 몹으로"
          description="좀비·스켈레톤·크리퍼·거미, 보스는 위더 스켈레톤. 숫자와 규칙은 그대로예요."
          checked={settings.mcMode}
          onChange={(v) => updateSettings({ mcMode: v })}
        />
        {settings.mcMode && mobs.status === "loading" && (
          <p className={styles.loading} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            마인크래프트 리소스를 불러오는 중…
          </p>
        )}
        {settings.mcMode && mobs.status === "ready" && (
          <InlineMessage tone="success">마크 몹 그림을 쓰고 있어요.</InlineMessage>
        )}
        {settings.mcMode && mobs.status === "error" && (
          <EmptyState
            headingLevel={headingLevel === 2 ? 3 : 4}
            title="마인크래프트 리소스를 불러오면 사용할 수 있어요"
            description={`${mobs.message} 불러오기 전까지는 기본 몬스터로 보여요.`}
            action={
              <Button variant="primary" icon="download" onClick={loadMobs}>
                다시 불러오기
              </Button>
            }
          />
        )}
        {settings.mcMode && mobs.status === "idle" && (
          <EmptyState
            headingLevel={headingLevel === 2 ? 3 : 4}
            title="마인크래프트 리소스를 불러오면 사용할 수 있어요"
            action={
              <Button variant="primary" icon="download" onClick={loadMobs}>
                불러오기
              </Button>
            }
          />
        )}
        <p className={styles.help}>
          텍스처는 이 게임에 들어 있지 않아요. 켜면 공개 에셋 미러에서 받아 이 기기에만 저장하고, 어디로도 보내지 않아요.
        </p>
      </section>

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
