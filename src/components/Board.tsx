"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { currentPower, isCleared, type Attempt } from "@/game/attempt";
import { roomSpeech } from "@/game/messages";
import { effectLabel, parseEffect, rewardOf } from "@/game/rules";
import type { Room } from "@/game/types";
import type { PixelSprite } from "@/lib/schema";
import { TILE_ART } from "@/sprites/defaults";
import { NumberChip } from "./NumberChip";
import { SpriteImg } from "./SpriteImg";
import styles from "./Board.module.css";

type Props = {
  attempt: Attempt;
  heroSprite: PixelSprite;
  monsterSprite: (room: Room) => PixelSprite;
  /** 방을 눌렀을 때 (이어진 방이 아니어도 부른다 — 안내는 화면이 한다) */
  onRoom: (id: string) => void;
  /** 진 직후 흔들림 */
  shake: boolean;
};

/**
 * 방 그래프 보드 (기획서 7.2). 방은 격자 위 버튼, 연결선은 그 아래 SVG.
 * 키보드: 방향키로 방 사이를 옮겨 다니고(로빙 tabindex), Enter/Space로 이동. Home은 주인공이 있는 방.
 * 이어진 방은 실선 + 점선 테두리 + "갈 수 있음"으로, 색만으로 구분하지 않는다.
 */
export function Board({ attempt: a, heroSprite, monsterSprite, onRoom, shake }: Props) {
  // 쓰지 않는 바깥 줄·칸은 잘라서 보드를 꽉 채운다 (생성된 스테이지는 격자 가장자리가 빌 수 있다)
  const minCol = Math.min(...a.stage.rooms.map((r) => r.pos[0]));
  const minRow = Math.min(...a.stage.rooms.map((r) => r.pos[1]));
  const rooms = useMemo(
    () => a.stage.rooms.map((r) => ({ ...r, pos: [r.pos[0] - minCol, r.pos[1] - minRow] as [number, number] }) as Room),
    [a.stage.rooms, minCol, minRow],
  );
  const cols = Math.max(...rooms.map((r) => r.pos[0])) + 1;
  const rows = Math.max(...rooms.map((r) => r.pos[1])) + 1;
  const here = rooms.find((r) => r.id === a.snap.at)!;
  const playing = a.status === "playing";
  const adjacent = new Set(playing ? here.links : []);

  const [focusId, setFocusId] = useState(a.snap.at);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  // 주인공이 움직이면 로빙 포커스 기준도 따라간다 (지금 포커스가 보드 밖이면 옮기지만 포커스를 빼앗지는 않는다)
  useEffect(() => {
    if (!refs.current.get(focusId)?.contains(document.activeElement)) setFocusId(a.snap.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.snap.at]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    let next: Room | undefined;
    if (e.key === "Home") next = here;
    else if (dirs[e.key]) {
      const from = rooms.find((r) => r.id === focusId) ?? here;
      next = nearestInDirection(rooms, from, dirs[e.key]);
    } else return;
    e.preventDefault();
    if (!next) return;
    setFocusId(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div
      className={`${styles.board} ${shake ? styles.shake : ""}`}
      style={{ ["--cols" as string]: cols, ["--rows" as string]: rows }}
    >
      <svg className={styles.paths} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" aria-hidden="true">
        {rooms.flatMap((r) =>
          r.links
            .filter((l) => l > r.id)
            .map((l) => {
              const o = rooms.find((x) => x.id === l)!;
              const open = (r.id === here.id && adjacent.has(l)) || (o.id === here.id && adjacent.has(r.id));
              return (
                <line
                  key={`${r.id}-${l}`}
                  x1={r.pos[0] + 0.5}
                  y1={r.pos[1] + 0.5}
                  x2={o.pos[0] + 0.5}
                  y2={o.pos[1] + 0.5}
                  className={open ? styles.pathOpen : styles.path}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }),
        )}
      </svg>

      <div className={styles.grid} role="group" aria-label="던전 지도. 방향키로 방을 고르고 Enter로 이동" onKeyDown={onKeyDown}>
        {rooms.map((room) => {
          const isHere = room.id === here.id;
          const isAdj = adjacent.has(room.id);
          const hidden = (room.type === "monster" || room.type === "boss") && !!room.hidden && !a.revealed.includes(room.id);
          const power = currentPower(a, room);
          const cleared = isCleared(a, room.id);
          return (
            <button
              key={room.id}
              ref={(el) => {
                if (el) refs.current.set(room.id, el);
                else refs.current.delete(room.id);
              }}
              type="button"
              className={[
                styles.room,
                styles[`type_${room.type}`],
                cleared && styles.cleared,
                isHere && styles.here,
                isAdj && styles.adjacent,
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ gridColumn: room.pos[0] + 1, gridRow: room.pos[1] + 1 }}
              tabIndex={room.id === focusId ? 0 : -1}
              aria-disabled={!isAdj || undefined}
              aria-label={roomSpeech(a, room, { here: isHere, adjacent: isAdj, hidden, power })}
              onFocus={() => setFocusId(room.id)}
              onClick={() => onRoom(room.id)}
            >
              {!isHere && <RoomContent attempt={a} room={room} hidden={hidden} power={power} cleared={cleared} sprite={monsterSprite} />}
            </button>
          );
        })}
      </div>

      {/* 주인공: 방 위에 따로 얹어 이동할 때 미끄러지게 (스크린리더는 방 이름으로 위치를 듣는다) */}
      <div
        className={styles.hero}
        style={{ left: `${(here.pos[0] / cols) * 100}%`, top: `${(here.pos[1] / rows) * 100}%` }}
        aria-hidden="true"
      >
        <NumberChip key={a.snap.power} value={a.snap.power} tone="hero" size="lg" className={styles.heroChip} />
        <SpriteImg sprite={heroSprite} className={`${styles.sprite} ${a.status === "lost" ? styles.down : ""}`} />
      </div>
    </div>
  );
}

/** 그 방향에서 가장 가까운 방 (정면에 가까울수록 우선) */
function nearestInDirection(rooms: Room[], from: Room, [dx, dy]: [number, number]): Room | undefined {
  let best: Room | undefined;
  let bestScore = Infinity;
  for (const r of rooms) {
    if (r === from) continue;
    const vx = r.pos[0] - from.pos[0];
    const vy = r.pos[1] - from.pos[1];
    const along = vx * dx + vy * dy;
    if (along <= 0) continue;
    const across = Math.abs(vx * dy) + Math.abs(vy * dx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

type ContentProps = {
  attempt: Attempt;
  room: Room;
  hidden: boolean;
  power: number | null;
  cleared: boolean;
  sprite: (room: Room) => PixelSprite;
};

/** 방 안 그림: 숫자 칩(위 층) + 그림. 비운 방은 아무것도 없다 */
function RoomContent({ attempt: a, room, hidden, power, cleared, sprite }: ContentProps) {
  if (room.type === "chest") {
    const picked = a.snap.picked[room.id];
    if (picked !== undefined) {
      return (
        <>
          <span className={styles.tag}>{effectLabel(a.chestLayout[room.id][picked])}</span>
          <SpriteImg sprite={TILE_ART.chestOpen} className={styles.sprite} />
        </>
      );
    }
    return (
      <>
        <span className={styles.tag}>상자 {room.contents.length}</span>
        <SpriteImg sprite={TILE_ART.chest} className={styles.sprite} />
      </>
    );
  }
  if (cleared || room.type === "start" || room.type === "empty") {
    return room.type === "start" ? <span className={styles.floorText}>시작</span> : null;
  }
  switch (room.type) {
    case "monster": {
      const r = rewardOf(room);
      return (
        <>
          <NumberChip value={hidden ? "?" : power!} />
          <SpriteImg sprite={sprite(room)} className={styles.sprite} />
          {!hidden && r < 0 && <span className={`${styles.badge} ${styles.poison}`}>독 {r}</span>}
          {!hidden && r > 0 && r !== room.power && !room.grow && <span className={styles.badge}>+{r}</span>}
          {room.grow && (
            <span className={`${styles.badge} ${styles.grow}`}>
              {room.grow.every}걸음 +{room.grow.by}
            </span>
          )}
        </>
      );
    }
    case "boss":
      return (
        <>
          <NumberChip value={hidden ? "?" : power!} tone="boss" />
          <SpriteImg sprite={sprite(room)} className={`${styles.sprite} ${styles.bossSprite}`} />
          <span className={`${styles.badge} ${styles.bossBadge}`}>보스</span>
        </>
      );
    case "trap":
      return (
        <>
          <span className={`${styles.tag} ${styles.bad}`}>{effectLabel(room.effect)}</span>
          <SpriteImg sprite={TILE_ART.trap} className={styles.sprite} />
        </>
      );
    case "item":
      return (
        <>
          <span className={styles.tag}>{effectLabel(room.effect)}</span>
          <SpriteImg sprite={parseEffect(room.effect).op === "mul" ? TILE_ART.potionBig : TILE_ART.potion} className={styles.sprite} />
        </>
      );
    case "gate":
      return (
        <>
          <span className={styles.tag}>{room.maxPower} 이하</span>
          <SpriteImg sprite={TILE_ART.gate} className={styles.sprite} />
        </>
      );
  }
}
