import { MIN_POWER, applyEffect, beats, monsterPowerAt, normalizeStage, rewardOf, startRoom } from "./rules";
import type { Effect, Room, Stage } from "./types";

/**
 * 솔버 (기획서 9.1).
 * 상태 = (현재 방, 숫자, 치운 방 집합, 이동 횟수). 치운 방을 지나다니는 것은 "갈 수 있는 곳 찾기"로 묶어서
 * 행동 하나 = "아직 안 치운 방 하나와 부딪히기"로 본다 → 행동마다 치운 방이 늘어나 순환이 없다(DFS + 메모).
 * 이동은 늘 가장 짧은 길로 간다 (이동이 많아서 좋아지는 경우가 없다: 시간 변화 몬스터는 커지기만 하고 이동 제한은 줄기만 한다).
 *
 * 상자: 플레이어는 내용물을 모른 채 고른다 → 상자 방은 "가능한 모든 결과에서 깰 수 있어야" 하는 AND 노드.
 * 이것으로 "어느 상자를 골라도 클리어 가능"과 "모든 배정 경우"를 함께 확인한다.
 */

type Ctx = {
  stage: Stage;
  rooms: Room[];
  index: Map<string, number>;
  adj: number[][];
  /** 이동 횟수가 결과에 영향을 주는지 (이동 제한·시간 변화 몬스터) */
  movesMatter: boolean;
};

type State = { at: number; power: number; cleared: number; moves: number };

export type Action = { room: string; dist: number };

function makeCtx(raw: Stage): Ctx {
  const stage = normalizeStage(raw);
  const rooms = stage.rooms;
  if (rooms.length > 30) throw new Error("솔버는 방 30개까지");
  const index = new Map(rooms.map((r, i) => [r.id, i]));
  const adj = rooms.map((r) => r.links.map((l) => index.get(l)!));
  const movesMatter = stage.moveLimit !== undefined || rooms.some((r) => r.type === "monster" && r.grow);
  return { stage, rooms, index, adj, movesMatter };
}

function initial(ctx: Ctx): State {
  return { at: ctx.index.get(startRoom(ctx.stage).id)!, power: ctx.stage.heroStart, cleared: 0, moves: 0 };
}

const bit = (i: number) => 1 << i;

function passable(ctx: Ctx, s: State, i: number) {
  const r = ctx.rooms[i];
  if (s.cleared & bit(i)) return true;
  if (r.type === "start" || r.type === "empty") return true;
  if (r.type === "gate") return s.power <= r.maxPower;
  return false;
}

/** 치운 방·빈 방·지날 수 있는 문을 거쳐 닿는 "아직 안 치운 방"들과 그 거리 */
export function frontierOf(ctx: Ctx, s: State): { i: number; dist: number }[] {
  const dist = new Array<number>(ctx.rooms.length).fill(-1);
  dist[s.at] = 0;
  const queue = [s.at];
  const out: { i: number; dist: number }[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    for (const v of ctx.adj[u]) {
      if (dist[v] >= 0) continue;
      dist[v] = dist[u] + 1;
      if (passable(ctx, s, v)) queue.push(v);
      else if (ctx.rooms[v].type !== "gate") out.push({ i: v, dist: dist[v] });
    }
  }
  return out;
}

/** 결과 하나: 이긴 상태 / 진 상태 / 계속 */
type Outcome = { kind: "won" } | { kind: "lost" } | { kind: "next"; state: State };

function afterMoves(ctx: Ctx, st: State): Outcome {
  if (ctx.stage.moveLimit !== undefined && st.moves >= ctx.stage.moveLimit) return { kind: "lost" };
  return { kind: "next", state: st };
}

/** 방 i와 부딪힌 결과들. 상자는 결과가 여러 개(모두 깰 수 있어야 함) */
function outcomes(ctx: Ctx, s: State, i: number, dist: number): Outcome[] {
  const r = ctx.rooms[i];
  const moves = s.moves + dist;
  if (ctx.stage.moveLimit !== undefined && moves > ctx.stage.moveLimit) return [{ kind: "lost" }];
  const cleared = s.cleared | bit(i);
  switch (r.type) {
    case "monster": {
      // 마지막 한 걸음 전의 이동 횟수로 숫자를 본다 (화면에 보이는 숫자와 같게)
      if (!beats(s.power, monsterPowerAt(r, moves - 1))) return [{ kind: "lost" }];
      const power = s.power + rewardOf(r);
      if (power < MIN_POWER) return [{ kind: "lost" }];
      return [afterMoves(ctx, { at: i, power, cleared, moves })];
    }
    case "boss":
      return [beats(s.power, r.power) ? { kind: "won" } : { kind: "lost" }];
    case "trap":
    case "item": {
      const power = applyEffect(s.power, r.effect);
      if (power < MIN_POWER) return [{ kind: "lost" }];
      return [afterMoves(ctx, { at: i, power, cleared, moves })];
    }
    case "chest": {
      // 도착한 걸음으로 이동 제한에 걸리면 고르기 전에 끝난다
      if (ctx.stage.moveLimit !== undefined && moves >= ctx.stage.moveLimit) return [{ kind: "lost" }];
      return [...new Set(r.contents)].map((e: Effect) => {
        const power = applyEffect(s.power, e);
        if (power < MIN_POWER) return { kind: "lost" } as const;
        return { kind: "next", state: { at: i, power, cleared, moves } } as const;
      });
    }
    default:
      return [{ kind: "lost" }];
  }
}

function keyOf(ctx: Ctx, s: State) {
  return `${s.at}|${s.power}|${s.cleared}|${ctx.movesMatter ? s.moves : 0}`;
}

export type SolveResult = {
  solvable: boolean;
  /** 깨는 행동 순서의 수 (상자는 가장 나쁜 결과 기준). 너무 많으면 limit에서 멈춘다 */
  solutions: number;
  /** 가장 짧은 해답 (행동 수 기준). 상자 결과는 목록의 첫 번째를 가정 */
  plan: string[];
  /** 살펴본 상태 수 */
  states: number;
};

const COUNT_LIMIT = 1_000_000;

export function solve(raw: Stage): SolveResult {
  const ctx = makeCtx(raw);
  // 상태 → [해답 수, 가장 짧은 행동 수, 다음 행동]
  const memo = new Map<string, { count: number; len: number; next: number }>();

  const visit = (s: State): { count: number; len: number; next: number } => {
    const key = keyOf(ctx, s);
    const hit = memo.get(key);
    if (hit) return hit;
    let count = 0;
    let len = Infinity;
    let next = -1;
    for (const { i, dist } of frontierOf(ctx, s)) {
      const outs = outcomes(ctx, s, i, dist);
      let c = Infinity;
      let l = 0;
      for (const o of outs) {
        if (o.kind === "lost") {
          c = 0;
          break;
        }
        if (o.kind === "won") {
          c = Math.min(c, 1);
          l = Math.max(l, 1);
          continue;
        }
        const sub = visit(o.state);
        c = Math.min(c, sub.count);
        l = Math.max(l, sub.len + 1);
        if (c === 0) break;
      }
      if (c > 0 && c !== Infinity) {
        count = Math.min(COUNT_LIMIT, count + c);
        if (l < len) {
          len = l;
          next = i;
        }
      }
    }
    const res = { count, len, next };
    memo.set(key, res);
    return res;
  };

  const start = initial(ctx);
  const top = visit(start);

  // 가장 짧은 해답 따라가기 (상자는 첫 번째 결과)
  const plan: string[] = [];
  let s: State | null = top.count > 0 ? start : null;
  while (s) {
    const m = memo.get(keyOf(ctx, s));
    if (!m || m.next < 0) break;
    const step = frontierOf(ctx, s).find((f) => f.i === m.next)!;
    plan.push(ctx.rooms[m.next].id);
    const outs = outcomes(ctx, s, m.next, step.dist);
    const o = outs.find((x) => x.kind === "next");
    s = o && o.kind === "next" ? o.state : null;
  }

  return { solvable: top.count > 0, solutions: top.count, plan, states: memo.size };
}

/**
 * 탐욕 전략 (기획서 8.3): 이길 수 있는 보스가 닿으면 잡고, 아니면 닿는 몬스터 중 "이길 수 있는 가장 낮은 숫자"부터 잡는다.
 * 잡을 몬스터가 없으면 아이템 → 상자 → 함정 순으로 줍는다. 상자는 결과마다 따로 해 보고, 하나라도 깨면 "탐욕으로 풀림".
 */
export function greedyWins(raw: Stage): boolean {
  const ctx = makeCtx(raw);
  const run = (s0: State, combo: Map<string, Effect>): boolean => {
    let s = s0;
    for (let guard = 0; guard < 100; guard++) {
      const front = frontierOf(ctx, s);
      const at = (f: { i: number; dist: number }) => ctx.rooms[f.i];
      const boss = front.find((f) => {
        const r = at(f);
        return r.type === "boss" && beats(s.power, r.power);
      });
      const monsters = front
        .filter((f) => {
          const r = at(f);
          return r.type === "monster" && beats(s.power, monsterPowerAt(r, s.moves + f.dist - 1));
        })
        .sort((a, b) => {
          const ra = at(a) as Extract<Room, { type: "monster" }>;
          const rb = at(b) as Extract<Room, { type: "monster" }>;
          return monsterPowerAt(ra, s.moves + a.dist - 1) - monsterPowerAt(rb, s.moves + b.dist - 1) || a.i - b.i;
        });
      const pickType = (t: Room["type"]) => front.find((f) => at(f).type === t);
      const choice = boss ?? monsters[0] ?? pickType("item") ?? pickType("chest") ?? pickType("trap");
      if (!choice) return false;
      const r = at(choice);
      let outs = outcomes(ctx, s, choice.i, choice.dist);
      if (r.type === "chest") {
        // 이 실행에서 가정한 상자 결과 하나만
        const want = combo.get(r.id) ?? r.contents[0];
        const idx = [...new Set(r.contents)].indexOf(want);
        outs = [outs[idx]];
      }
      const o = outs[0];
      if (o.kind === "won") return true;
      if (o.kind === "lost") return false;
      s = o.state;
    }
    return false;
  };
  // 상자마다 가능한 결과 조합을 모두 시도 (상자 수가 적어 충분히 작다)
  const chests = ctx.rooms.filter((r): r is Extract<Room, { type: "chest" }> => r.type === "chest");
  const combos: Map<string, Effect>[] = [new Map()];
  for (const c of chests) {
    const next: Map<string, Effect>[] = [];
    for (const m of combos) for (const e of new Set(c.contents)) next.push(new Map(m).set(c.id, e));
    combos.splice(0, combos.length, ...next);
  }
  return combos.some((m) => run(initial(ctx), m));
}

/** 테스트·도구용: 시작 상태에서 닿는 방 id들 */
export function reachableFromStart(raw: Stage): string[] {
  const ctx = makeCtx(raw);
  return frontierOf(ctx, initial(ctx)).map((f) => ctx.rooms[f.i].id);
}
