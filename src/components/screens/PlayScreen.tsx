"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canUndo,
  movesLeft,
  newSession,
  pendingChest,
  roomById,
  sessionMove,
  sessionPick,
  sessionRestart,
  sessionUndo,
  type Session,
} from "@/game/attempt";
import { eventMessage } from "@/game/messages";
import { penaltyOf, starsFor } from "@/game/stars";
import type { Room, Stage } from "@/game/types";
import type { Sfx } from "@/lib/sound";
import { bossSprite, heroSprite, monsterSprites, slotFor } from "@/sprites/assign";
import { TILE_ART } from "@/sprites/defaults";
import { Board } from "../Board";
import { useGameData } from "../GameData";
import { SettingsPanel } from "../SettingsPanel";
import { SpriteImg } from "../SpriteImg";
import { Stars } from "../Stars";
import { Button, IconButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";
import { useFocusOnMount } from "../useFocusOnMount";
import styles from "./PlayScreen.module.css";

type Props = {
  stage: Stage;
  daily: boolean;
  nextStage: Stage | null;
  onNext: (stage: Stage) => void;
  onExit: () => void;
};

const SFX_FOR: Partial<Record<Session["attempt"]["event"]["kind"], Sfx>> = {
  move: "move",
  gatePass: "move",
  chestArrive: "move",
  defeat: "win",
  poisoned: "trap",
  lose: "lose",
  boss: "clear",
  trap: "trap",
  item: "item",
  chestPick: "chest",
  gateBlocked: "blocked",
  needChest: "blocked",
  outOfMoves: "lose",
  undo: "undo",
  noUndo: "blocked",
};

/**
 * 플레이 화면 (기획서 7.2). 위: 스테이지·시도·되돌리기·이동 / 가운데: 보드 / 아래: 되돌리기·처음부터.
 * 결과(성공·실패)는 모달 대신 아래쪽 시트로, 실패하면 "처음부터" 버튼에 바로 포커스.
 * 데스크톱은 보드를 크게, 상태·규칙은 옆 칸.
 */
export function PlayScreen({ stage, daily, nextStage, onNext, onExit }: Props) {
  const { custom, sfx, addClear, progress } = useGameData();
  const toast = useToast();
  const [session, setSession] = useState<Session>(() => newSession(stage));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const titleRef = useFocusOnMount<HTMLHeadingElement>();
  const a = session.attempt;

  // 몬스터 외형: 꾸민/기본 몬스터 중 몬스터 id로 고정
  const monsters = useMemo(() => monsterSprites(custom), [custom]);
  const spriteFor = useCallback(
    (room: Room) => (room.type === "boss" ? bossSprite(custom) : monsters[slotFor(stage.id, room.id, monsters.length)]),
    [monsters, custom, stage.id],
  );

  const message = notice ?? eventMessage(a).text;
  const tone = notice ? "warning" : eventMessage(a).tone;

  // 행동 결과: 효과음, 실패 흔들림, 클리어 기록
  const lastEvent = useRef(a.event);
  useEffect(() => {
    if (lastEvent.current === a.event) return;
    lastEvent.current = a.event;
    const kind = SFX_FOR[a.event.kind];
    if (kind) sfx(a.status === "won" ? "clear" : kind);
    if (a.status === "lost") {
      setShake(true);
      const t = setTimeout(() => setShake(false), 400);
      return () => clearTimeout(t);
    }
  }, [a.event, a.status, sfx]);

  const penalty = penaltyOf(session.restarts, session.undosUsed);
  const stars = starsFor(penalty);
  const recorded = useRef(false);
  useEffect(() => {
    if (a.status === "won" && !recorded.current) {
      recorded.current = true;
      addClear(stage.id, stars, penalty);
    }
  }, [a.status, addClear, stage.id, stars, penalty]);

  const onRoom = (id: string) => {
    setNotice(null);
    if (a.status !== "playing") return;
    if (id === a.snap.at) return;
    const here = roomById(a, a.snap.at);
    if (!here.links.includes(id)) {
      setNotice("이어진 방으로만 갈 수 있어요. 초록색으로 칠해진 방을 골라 주세요.");
      sfx("blocked");
      return;
    }
    setSession((s) => sessionMove(s, id));
  };

  const doUndo = useCallback(() => {
    setNotice(null);
    setSession((s) => sessionUndo(s));
  }, []);

  const doRestart = useCallback(() => {
    setNotice(null);
    recorded.current = false;
    setSession((s) => sessionRestart(s));
  }, []);

  const pick = (i: number) => {
    setSession((s) => sessionPick(s, i));
  };

  // 단축키: Z(또는 Ctrl+Z) 되돌리기, R 처음부터. 입력란·대화창에서는 쓰지 않는다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || e.altKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, dialog")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        if (session.attempt.status === "playing") doUndo();
      } else if (k === "r" && !e.ctrlKey) {
        e.preventDefault();
        doRestart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, doUndo, doRestart, session.attempt.status]);

  // 상자 결과는 알림으로도 (아래 글줄을 놓쳐도 보이게)
  useEffect(() => {
    if (a.event.kind === "chestPick") toast.show(eventMessage(a).text, eventMessage(a).tone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.event]);

  const chestRoom = pendingChest(a);
  const left = movesLeft(a);
  const undoText = a.undosLeft === null ? "무제한" : `${a.undosLeft}/${stage.undoLimit}`;
  const best = progress[stage.id];

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <IconButton icon="back" label="스테이지 선택으로" onClick={onExit} />
        <h1 ref={titleRef} tabIndex={-1} className={styles.title}>
          {daily ? stage.title : `${stageNumber(stage)}. ${stage.title}`}
        </h1>
        <IconButton icon="gear" label="설정 (소리·모션)" onClick={() => setSettingsOpen(true)} />
      </header>

      <div className={styles.layout}>
        <section className={styles.boardArea} aria-label="던전">
          <dl className={styles.stats}>
            <div>
              <dt>시도</dt>
              <dd>{session.tries}번째</dd>
            </div>
            <div>
              <dt>되돌리기</dt>
              <dd>{undoText}</dd>
            </div>
            {left !== null && (
              <div className={left <= 2 ? styles.low : undefined}>
                <dt>남은 이동</dt>
                <dd>{left}</dd>
              </div>
            )}
            <div className={styles.power}>
              <dt>내 숫자</dt>
              <dd>{a.snap.power}</dd>
            </div>
          </dl>

          <Board attempt={a} heroSprite={heroSprite(custom)} monsterSprite={spriteFor} onRoom={onRoom} shake={shake} />

          <p className={`${styles.message} ${styles[`tone_${tone}`]}`} role="status" aria-live="polite">
            <span aria-hidden="true">{SYMBOL[tone]}</span> {message}
          </p>
        </section>

        <section className={styles.side} aria-label="행동">
          {a.status === "playing" && chestRoom && (
            <ChestPicker count={a.chestLayout[chestRoom].length} onPick={pick} />
          )}

          {a.status === "lost" && (
            <ResultSheet
              title="졌어요! 처음부터 다시 해요"
              tone="error"
              lines={[
                eventMessage(a).text,
                a.revealed.some((id) => {
                  const r = roomById(a, id);
                  return (r.type === "monster" || r.type === "boss") && r.hidden;
                })
                  ? "숨은 숫자가 지도에 공개됐어요. 다시 시작하면 다시 가려져요."
                  : "",
                Object.keys(a.chestLayout).length > 0 ? "상자 내용물은 다시 섞여요." : "",
              ]}
            >
              <Button variant="primary" size="lg" block icon="restart" onClick={doRestart} data-autofocus>
                처음부터 다시 (R)
              </Button>
            </ResultSheet>
          )}

          {a.status === "won" && (
            <ResultSheet
              title="클리어!"
              tone="success"
              lines={[`재시작 ${session.restarts}번 · 되돌리기 ${session.undosUsed}번`, best && best.stars > stars ? `최고 기록은 별 ${best.stars}개예요.` : ""]}
              stars={stars}
            >
              {nextStage && (
                <Button variant="primary" size="lg" block icon="play" onClick={() => onNext(nextStage)} data-autofocus>
                  다음 스테이지
                </Button>
              )}
              <div className={styles.row}>
                <Button block icon="restart" onClick={doRestart} data-autofocus={!nextStage || undefined}>
                  다시 하기
                </Button>
                <Button block variant="ghost" icon="star" onClick={onExit}>
                  스테이지 선택
                </Button>
              </div>
            </ResultSheet>
          )}

          {a.status === "playing" && (
            <div className={styles.controls}>
              <Button icon="undo" block onClick={doUndo} disabled={!canUndo(a)} aria-describedby="undo-help">
                되돌리기 ({a.undosLeft === null ? "무제한" : a.undosLeft})
              </Button>
              <Button variant="ghost" icon="restart" block onClick={doRestart}>
                처음부터
              </Button>
              <p id="undo-help" className={styles.sub}>
                {canUndo(a)
                  ? "Z: 되돌리기 · R: 처음부터"
                  : stage.undoLimit === 0
                    ? "이 스테이지는 되돌리기를 쓸 수 없어요."
                    : a.undosLeft === 0
                      ? "이번 시도의 되돌리기를 다 썼어요."
                      : Object.keys(a.snap.picked).length > 0 && a.undoStack.length === 0
                        ? "상자를 고른 뒤라 그 전으로는 되돌릴 수 없어요."
                        : "아직 되돌릴 행동이 없어요."}
              </p>
            </div>
          )}

          <details className={styles.rules}>
            <summary>규칙 보기</summary>
            <ul>
              <li>초록색으로 칠해진 방이 지금 갈 수 있는 방이에요.</li>
              <li>나보다 작은 숫자의 몬스터와 부딪히면 이기고 그 숫자를 흡수해요. 같거나 크면 져요.</li>
              <li>지면 스테이지를 처음부터 다시 해요. 되돌리기는 시도마다 다시 채워져요.</li>
              <li>문: 적힌 숫자 이하일 때만 지나가요. 물약은 숫자를 늘리고 함정은 줄여요.</li>
              <li>상자: 하나만 열 수 있고, 연 뒤에는 되돌릴 수 없어요. 내용물은 시도마다 섞여요.</li>
              <li>독 몬스터는 이겨도 숫자가 줄어요. 시계 표시 몬스터는 움직일 때마다 커져요.</li>
              <li>별: 재시작·되돌리기 없이 깨면 3개, 합쳐서 3번 이하면 2개.</li>
            </ul>
          </details>
        </section>
      </div>

      <Dialog open={settingsOpen} title="설정" onClose={() => setSettingsOpen(false)}>
        <SettingsPanel headingLevel={3} />
      </Dialog>
    </div>
  );
}

const SYMBOL = { info: "ℹ", success: "✓", warning: "⚠", error: "✕" } as const;

function stageNumber(stage: Stage) {
  const m = /^s(\d+)$/.exec(stage.id);
  return m ? Number(m[1]) : "";
}

function ChestPicker({ count, onPick }: { count: number; onPick: (i: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <fieldset className={styles.chests}>
      <legend>상자를 하나 고르세요</legend>
      <p className={styles.sub}>하나만 열 수 있고, 고르면 되돌릴 수 없어요.</p>
      <div className={styles.chestRow}>
        {Array.from({ length: count }, (_, i) => (
          <button key={i} ref={i === 0 ? ref : undefined} type="button" className={styles.chest} onClick={() => onPick(i)}>
            <SpriteImg sprite={TILE_ART.chest} className={styles.chestImg} />
            상자 {i + 1}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type SheetProps = {
  title: string;
  tone: "success" | "error";
  lines: string[];
  stars?: number;
  children: React.ReactNode;
};

/** 결과 시트: 제목 + 설명 + 바로 누를 수 있는 버튼. 나타나면 첫 버튼으로 포커스 */
function ResultSheet({ title, tone, lines, stars, children }: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);
  return (
    <section ref={ref} className={`${styles.sheet} ${styles[`sheet_${tone}`]}`} aria-labelledby="result-title">
      <h2 id="result-title" className={styles.sheetTitle}>
        <span aria-hidden="true">{tone === "success" ? "✓ " : "✕ "}</span>
        {title}
      </h2>
      {stars !== undefined && <Stars count={stars} size={28} />}
      {lines.filter(Boolean).map((l, i) => (
        <p key={i}>{l}</p>
      ))}
      <div className={styles.sheetActions}>{children}</div>
    </section>
  );
}
