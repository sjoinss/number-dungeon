"use client";

import type { Stage } from "@/game/types";
import { heroSprite, monsterSprites } from "@/sprites/assign";
import { DEFAULT_BOSS } from "@/sprites/defaults";
import { useGameData } from "../GameData";
import { NumberChip } from "../NumberChip";
import { SpriteImg } from "../SpriteImg";
import { Button } from "../ui/Button";
import { InlineMessage } from "../ui/InlineMessage";
import { useFocusOnMount } from "../useFocusOnMount";
import styles from "./TitleScreen.module.css";

type Props = {
  continueStage: Stage;
  started: boolean;
  onPlay: () => void;
  onStages: () => void;
  onCustom: () => void;
  onSettings: () => void;
};

/** 타이틀: 로고 + 규칙을 한눈에 보여주는 작은 그림 + 주요 버튼 (가장 중요한 "시작"이 맨 위·가장 크게) */
export function TitleScreen({ continueStage, started, onPlay, onStages, onCustom, onSettings }: Props) {
  const { custom, ready, storageError } = useGameData();
  const titleRef = useFocusOnMount<HTMLHeadingElement>();
  const monster = monsterSprites(custom)[0];
  return (
    <main className={styles.screen}>
      <div className={styles.inner}>
        <h1 ref={titleRef} tabIndex={-1} className={styles.logo}>
          숫자 던전
        </h1>
        <p className={styles.tagline}>나보다 작은 숫자를 흡수해서 보스를 잡아요</p>

        <div className={styles.scene} aria-hidden="true">
          <figure className={styles.actor}>
            <NumberChip value={5} tone="hero" size="lg" />
            <SpriteImg sprite={heroSprite(custom)} className={styles.sprite} />
          </figure>
          <span className={styles.arrow}>›</span>
          <figure className={styles.actor}>
            <NumberChip value={3} />
            <SpriteImg sprite={monster} className={styles.sprite} />
          </figure>
          <figure className={styles.actor}>
            <NumberChip value="?" tone="boss" />
            <SpriteImg sprite={custom.boss ?? DEFAULT_BOSS} className={styles.sprite} />
          </figure>
        </div>

        <nav className={styles.menu} aria-label="메인 메뉴">
          <Button variant="primary" size="lg" block icon="play" onClick={onPlay} disabled={!ready}>
            {started ? `이어하기 · ${continueStage.title}` : "시작하기"}
          </Button>
          <Button block icon="star" onClick={onStages}>
            스테이지 선택
          </Button>
          <div className={styles.row}>
            <Button block variant="ghost" icon="pencil" onClick={onCustom}>
              꾸미기
            </Button>
            <Button block variant="ghost" icon="gear" onClick={onSettings}>
              설정
            </Button>
          </div>
        </nav>

        {storageError && (
          <InlineMessage tone="warning" title="그림을 저장할 수 없어요">
            이 브라우저에서 저장소를 쓸 수 없어(시크릿 모드 등) 꾸민 그림은 창을 닫으면 사라져요.
          </InlineMessage>
        )}
      </div>
    </main>
  );
}
