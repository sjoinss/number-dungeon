import {
  MIN_POWER,
  applyEffect,
  beats,
  monsterPowerAt,
  normalizeStage,
  rewardOf,
  startRoom,
} from "./rules";
import type { Effect, Room, Stage } from "./types";

/**
 * 한 번의 시도(재시작하면 새 시도)와 플레이 기록. 모두 순수 함수 — 새 상태를 돌려준다.
 * 기획서 5장: 되돌리기는 시도당 undoLimit번 (이동·흡수·함정·아이템), 실패는 되돌릴 수 없고 곧 재시작,
 * 상자를 고르는 순간 되돌리기 기록을 비운다(상자 선택 이전으로는 못 돌아감).
 */

/** 되돌리기로 돌아갈 수 있는 판 상태 */
export type Snapshot = {
  at: string;
  power: number;
  /** 치운 방 (몬스터 처치·함정/아이템 사용·상자 고름) */
  cleared: readonly string[];
  moves: number;
  /** 상자 방 id → 고른 상자 번호 */
  picked: Readonly<Record<string, number>>;
};

export type Status = "playing" | "lost" | "won";

export type GameEvent =
  | { kind: "start" }
  | { kind: "move"; to: string }
  | { kind: "defeat"; room: string; monster: number; from: number; to: number }
  | { kind: "poisoned"; room: string; monster: number; from: number; to: number }
  | { kind: "lose"; room: string; monster: number; hero: number; boss: boolean }
  | { kind: "boss"; room: string; monster: number; from: number }
  | { kind: "trap"; room: string; effect: Effect; from: number; to: number }
  | { kind: "item"; room: string; effect: Effect; from: number; to: number }
  | { kind: "gateBlocked"; room: string; max: number; hero: number }
  | { kind: "gatePass"; room: string; max: number }
  | { kind: "chestArrive"; room: string; count: number }
  | { kind: "chestPick"; room: string; index: number; effect: Effect; from: number; to: number }
  | { kind: "needChest"; room: string }
  | { kind: "outOfMoves" }
  | { kind: "undo"; left: number | null }
  | { kind: "noUndo" };

export type Attempt = {
  stage: Stage;
  /** 상자 방 id → 이번 시도의 상자 배정 (시작할 때 섞어서 확정) */
  chestLayout: Readonly<Record<string, readonly Effect[]>>;
  snap: Snapshot;
  undoStack: readonly Snapshot[];
  undosLeft: number | null;
  status: Status;
  /** 진 경우: 숨은 숫자를 이번 시도 동안 공개 */
  revealed: readonly string[];
  event: GameEvent;
};

/** 스테이지를 처음 들어와서 끝낼 때까지 (재시작 횟수·되돌리기 사용은 별점에 쓰인다) */
export type Session = {
  attempt: Attempt;
  /** 지금 몇 번째 시도인지 (1부터) */
  tries: number;
  restarts: number;
  undosUsed: number;
};

export type Rng = () => number;

export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newAttempt(raw: Stage, rng: Rng = Math.random): Attempt {
  const stage = normalizeStage(raw);
  const chestLayout: Record<string, Effect[]> = {};
  for (const r of stage.rooms) if (r.type === "chest") chestLayout[r.id] = shuffle(r.contents, rng);
  return {
    stage,
    chestLayout,
    snap: { at: startRoom(stage).id, power: stage.heroStart, cleared: [], moves: 0, picked: {} },
    undoStack: [],
    undosLeft: stage.undoLimit,
    status: "playing",
    revealed: [],
    event: { kind: "start" },
  };
}

export function newSession(stage: Stage, rng: Rng = Math.random): Session {
  return { attempt: newAttempt(stage, rng), tries: 1, restarts: 0, undosUsed: 0 };
}

export function roomById(a: Attempt, id: string): Room {
  const r = a.stage.rooms.find((x) => x.id === id);
  if (!r) throw new Error(`없는 방 ${id}`);
  return r;
}

export function isCleared(a: Attempt, id: string) {
  return a.snap.cleared.includes(id);
}

/** 상자 방에 서 있는데 아직 고르지 않았으면 그 방 id */
export function pendingChest(a: Attempt): string | null {
  const here = roomById(a, a.snap.at);
  return here.type === "chest" && a.snap.picked[here.id] === undefined ? here.id : null;
}

/** 지금 이 방의 숫자 (시간 변화 반영). 몬스터·보스가 아니면 null */
export function currentPower(a: Attempt, room: Room): number | null {
  if (room.type === "monster") return monsterPowerAt(room, a.snap.moves);
  if (room.type === "boss") return room.power;
  return null;
}

export function canUndo(a: Attempt) {
  return a.status === "playing" && a.undoStack.length > 0 && (a.undosLeft === null || a.undosLeft > 0);
}

export function movesLeft(a: Attempt): number | null {
  return a.stage.moveLimit === undefined ? null : a.stage.moveLimit - a.snap.moves;
}

function withSnap(a: Attempt, snap: Snapshot, event: GameEvent, status: Status = a.status): Attempt {
  return { ...a, snap, undoStack: [...a.undoStack, a.snap], event, status };
}

/** 이동이 끝난 뒤: 이동 횟수를 다 썼는데 못 깼으면 실패 */
function afterMove(a: Attempt): Attempt {
  if (a.status === "playing" && a.stage.moveLimit !== undefined && a.snap.moves >= a.stage.moveLimit) {
    return { ...a, status: "lost", event: { kind: "outOfMoves" } };
  }
  return a;
}

/**
 * 이어진 방으로 이동(= 그 방의 요소와 부딪힘).
 * 이어지지 않은 방, 이미 끝난 판은 그대로 돌려준다.
 */
export function moveTo(a: Attempt, target: string): Attempt {
  if (a.status !== "playing") return a;
  const here = roomById(a, a.snap.at);
  if (!here.links.includes(target)) return a;
  const pending = pendingChest(a);
  if (pending) return { ...a, event: { kind: "needChest", room: pending } };

  const room = roomById(a, target);
  const s = a.snap;
  const moved: Snapshot = { ...s, at: target, moves: s.moves + 1 };
  const cleared = isCleared(a, target);

  if (cleared || room.type === "start" || room.type === "empty") {
    return afterMove(withSnap(a, moved, { kind: "move", to: target }));
  }

  switch (room.type) {
    case "gate": {
      if (s.power > room.maxPower) {
        // 단순 막힘 (기획서 17-2 기본값): 상태는 그대로, 안내만
        return { ...a, event: { kind: "gateBlocked", room: target, max: room.maxPower, hero: s.power } };
      }
      return afterMove(withSnap(a, moved, { kind: "gatePass", room: target, max: room.maxPower }));
    }
    case "monster": {
      const monster = monsterPowerAt(room, s.moves);
      if (!beats(s.power, monster)) {
        return { ...a, status: "lost", revealed: [...a.revealed, target], event: { kind: "lose", room: target, monster, hero: s.power, boss: false } };
      }
      const to = s.power + rewardOf(room);
      const next: Snapshot = { ...moved, power: to, cleared: [...s.cleared, target] };
      if (to < MIN_POWER) {
        return { ...a, snap: next, status: "lost", event: { kind: "poisoned", room: target, monster, from: s.power, to } };
      }
      const kind = rewardOf(room) < 0 ? "poisoned" : "defeat";
      return afterMove(withSnap(a, next, { kind, room: target, monster, from: s.power, to }));
    }
    case "boss": {
      if (!beats(s.power, room.power)) {
        return { ...a, status: "lost", revealed: [...a.revealed, target], event: { kind: "lose", room: target, monster: room.power, hero: s.power, boss: true } };
      }
      const next: Snapshot = { ...moved, cleared: [...s.cleared, target] };
      return { ...withSnap(a, next, { kind: "boss", room: target, monster: room.power, from: s.power }), status: "won" };
    }
    case "trap":
    case "item": {
      const to = applyEffect(s.power, room.effect);
      const next: Snapshot = { ...moved, power: to, cleared: [...s.cleared, target] };
      const event: GameEvent = { kind: room.type, room: target, effect: room.effect, from: s.power, to };
      if (to < MIN_POWER) return { ...a, snap: next, status: "lost", event };
      return afterMove(withSnap(a, next, event));
    }
    case "chest":
      return afterMove(withSnap(a, moved, { kind: "chestArrive", room: target, count: room.contents.length }));
  }
}

/** 상자 하나 고르기. 되돌릴 수 없으므로 되돌리기 기록을 비운다 */
export function pickChest(a: Attempt, index: number): Attempt {
  if (a.status !== "playing") return a;
  const roomId = pendingChest(a);
  if (!roomId) return a;
  const layout = a.chestLayout[roomId];
  if (index < 0 || index >= layout.length) return a;
  const effect = layout[index];
  const s = a.snap;
  const to = applyEffect(s.power, effect);
  const snap: Snapshot = { ...s, power: to, cleared: [...s.cleared, roomId], picked: { ...s.picked, [roomId]: index } };
  const event: GameEvent = { kind: "chestPick", room: roomId, index, effect, from: s.power, to };
  return { ...a, snap, undoStack: [], event, status: to < MIN_POWER ? "lost" : a.status };
}

export function undo(a: Attempt): Attempt {
  if (!canUndo(a)) return { ...a, event: { kind: "noUndo" } };
  const prev = a.undoStack[a.undoStack.length - 1];
  const undosLeft = a.undosLeft === null ? null : a.undosLeft - 1;
  return { ...a, snap: prev, undoStack: a.undoStack.slice(0, -1), undosLeft, event: { kind: "undo", left: undosLeft } };
}

// ── 세션 (별점용 기록) ──

export function sessionMove(s: Session, target: string): Session {
  return { ...s, attempt: moveTo(s.attempt, target) };
}

export function sessionPick(s: Session, index: number): Session {
  return { ...s, attempt: pickChest(s.attempt, index) };
}

export function sessionUndo(s: Session): Session {
  const used = canUndo(s.attempt);
  return { ...s, attempt: undo(s.attempt), undosUsed: s.undosUsed + (used ? 1 : 0) };
}

/** 처음부터 다시: 상자를 다시 섞고, 숨은 숫자를 다시 가린다. 되돌리기 횟수도 다시 채워진다 */
export function sessionRestart(s: Session, rng: Rng = Math.random): Session {
  return { attempt: newAttempt(s.attempt.stage, rng), tries: s.tries + 1, restarts: s.restarts + 1, undosUsed: s.undosUsed };
}
