"use client";

import { STAGES } from "@/game/levels";
import type { Stage } from "@/game/types";
import { useGameData } from "../GameData";
import { Stars } from "../Stars";
import { PixelIcon } from "../ui/PixelIcon";
import { ScreenLayout } from "./ScreenLayout";
import styles from "./StageSelectScreen.module.css";

type Props = {
  daily: Stage | null;
  onBack: () => void;
  onPlay: (stage: Stage, daily: boolean) => void;
};

/** 스테이지 선택: 번호·이름·별·잠금. 앞 스테이지를 깨면 다음이 열린다 */
export function StageSelectScreen({ daily, onBack, onPlay }: Props) {
  const { progress } = useGameData();
  const cleared = STAGES.filter((s) => progress[s.id]).length;
  const totalStars = STAGES.reduce((n, s) => n + (progress[s.id]?.stars ?? 0), 0);

  return (
    <ScreenLayout title="스테이지 선택" onBack={onBack} backLabel="처음 화면으로">
      <div className={styles.wrap}>
        <p className={styles.summary}>
          {cleared} / {STAGES.length} 클리어 · 별 {totalStars} / {STAGES.length * 3}
        </p>

        <ol className={styles.grid}>
          {STAGES.map((s, i) => {
            const rec = progress[s.id];
            const locked = i > 0 && !progress[STAGES[i - 1].id];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`${styles.card} ${rec ? styles.done : ""}`}
                  disabled={locked}
                  aria-describedby={locked ? "lock-help" : undefined}
                  onClick={() => onPlay(s, false)}
                >
                  <span className={styles.num}>{i + 1}</span>
                  <span className={styles.name}>{s.title}</span>
                  {locked ? (
                    <span className={styles.lock}>
                      <PixelIcon name="lock" size={14} />
                      잠김
                    </span>
                  ) : rec ? (
                    <Stars count={rec.stars} />
                  ) : (
                    <span className={styles.new}>도전 전</span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <p id="lock-help" className={styles.help}>
          잠긴 스테이지는 바로 앞 스테이지를 깨면 열려요. 별은 재시작과 되돌리기를 적게 쓸수록 많이 받아요.
        </p>

        {daily && (
          <section className={styles.daily} aria-labelledby="daily-title">
            <div>
              <h2 id="daily-title" className={styles.dailyTitle}>
                <PixelIcon name="calendar" size={18} /> 오늘의 도전
              </h2>
              <p className={styles.help}>날마다 새로 만들어지는 판이에요.</p>
            </div>
            <div className={styles.dailyRight}>
              {progress[daily.id] && <Stars count={progress[daily.id].stars} />}
              <button type="button" className={styles.dailyButton} onClick={() => onPlay(daily, true)}>
                도전하기
              </button>
            </div>
          </section>
        )}
      </div>
    </ScreenLayout>
  );
}
