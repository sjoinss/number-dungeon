import { applyEffect, beats, monsterPowerAt } from "./rules";
import { greedyWins, solve } from "./solver";
import type { Effect, MonsterRoom, Room, Stage } from "./types";

/**
 * 역방향 생성기 (기획서 9.2).
 * 1) 격자 위에 방을 무작위로 잇는다(격자에서 이웃한 칸끼리만 → 연결선이 겹치지 않음).
 * 2) "이 순서로 잡으면 깬다"는 계획을 따라가며 그 순서에 맞는 숫자를 정한다 (계획에 쓰인 문은 그때 숫자 + 조금으로 상한을 정함).
 * 3) 계획에 안 쓰인 방은 미끼(높은 숫자, 독, 작은 함정)로 채운다.
 * 4) 솔버로 검증: 클리어 가능(모든 상자 결과에서) + 해답 수 상한 + (원하면) 탐욕 전략 실패. 통과한 것만 돌려준다.
 */

export type Rng = () => number;

/** 시드 고정 난수 (mulberry32) */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng() * list.length)];

export type GenOptions = {
  id: string;
  title: string;
  cols: number;
  rows: number;
  /** 시작·보스 포함 방 수 */
  size: number;
  gates: number;
  chests: number;
  items: number;
  traps: number;
  /** 몬스터 중 독(보상이 음수) 수 */
  poison: number;
  /** 시간 변화 몬스터 수 */
  grow: number;
  hidden: number;
  /** 이동 제한을 둘지 (계획 이동 수 + 여유) */
  moveLimit: boolean;
  undoLimit: number | null;
  heroStart: number;
  /** 고리(같은 곳으로 가는 다른 길)를 더할 확률 */
  loops: number;
  requireGreedyFail: boolean;
  maxSolutions: number;
  tries: number;
};

export const DEFAULT_GEN: Omit<GenOptions, "id" | "title"> = {
  cols: 4,
  rows: 5,
  size: 11,
  gates: 1,
  chests: 0,
  items: 1,
  traps: 1,
  poison: 1,
  grow: 0,
  hidden: 0,
  moveLimit: false,
  undoLimit: 3,
  heroStart: 5,
  loops: 0.25,
  requireGreedyFail: true,
  maxSolutions: 12,
  tries: 400,
};

type Cell = { id: string; col: number; row: number; links: Set<string> };

function makeLayout(rng: Rng, o: GenOptions): { cells: Cell[]; start: Cell; boss: Cell } | null {
  const key = (c: number, r: number) => `${c},${r}`;
  const grid = new Map<string, Cell>();
  const startCol = randInt(rng, 0, o.cols - 1);
  const start: Cell = { id: "r0", col: startCol, row: o.rows - 1, links: new Set() };
  grid.set(key(start.col, start.row), start);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let n = 1;
  for (let guard = 0; n < o.size && guard < 500; guard++) {
    const from = pick(rng, [...grid.values()]);
    const [dc, dr] = pick(rng, dirs);
    const c = from.col + dc;
    const r = from.row + dr;
    if (c < 0 || r < 0 || c >= o.cols || r >= o.rows || grid.has(key(c, r))) continue;
    const cell: Cell = { id: `r${n++}`, col: c, row: r, links: new Set([from.id]) };
    from.links.add(cell.id);
    grid.set(key(c, r), cell);
  }
  if (n < o.size) return null;
  const cells = [...grid.values()];
  const byId = new Map(cells.map((c) => [c.id, c]));
  // 시작에서의 거리
  const dist = new Map<string, number>([[start.id, 0]]);
  const q = [start];
  while (q.length) {
    const u = q.shift()!;
    for (const l of u.links) if (!dist.has(l)) dist.set(l, dist.get(u.id)! + 1), q.push(byId.get(l)!);
  }
  // 보스: 가장 위 줄 중 가장 먼 막다른 방
  const topRow = Math.min(...cells.map((c) => c.row));
  const candidates = cells.filter((c) => c.row <= topRow + 1 && c !== start && c.links.size === 1);
  if (!candidates.length) return null;
  const boss = candidates.sort((a, b) => dist.get(b.id)! - dist.get(a.id)! || a.row - b.row)[0];
  if (dist.get(boss.id)! < 3) return null;
  // 고리 추가 (보스는 막다른 방으로 둔다)
  for (const a of cells) {
    for (const [dc, dr] of dirs.slice(0, 3)) {
      const b = grid.get(key(a.col + dc, a.row + dr));
      if (!b || a.links.has(b.id) || a === boss || b === boss) continue;
      if (rng() < o.loops) a.links.add(b.id), b.links.add(a.id);
    }
  }
  return { cells, start, boss };
}

type Kind = "monster" | "gate" | "chest" | "item" | "trap";

const CHEST_SETS: Effect[][] = [
  ["+4", "x2", "empty"],
  ["+6", "+3", "empty"],
  ["x2", "+5", "-2"],
  ["+8", "empty", "empty"],
];

/** 계획 따라 숫자 정하기 + 미끼 채우기 → 스테이지 (검증 전) */
function build(rng: Rng, o: GenOptions): Stage | null {
  const layout = makeLayout(rng, o);
  if (!layout) return null;
  const { cells, start, boss } = layout;
  const others = cells.filter((c) => c !== start && c !== boss);
  const kinds: Kind[] = [];
  for (let i = 0; i < o.gates; i++) kinds.push("gate");
  for (let i = 0; i < o.chests; i++) kinds.push("chest");
  for (let i = 0; i < o.items; i++) kinds.push("item");
  for (let i = 0; i < o.traps; i++) kinds.push("trap");
  while (kinds.length < others.length) kinds.push("monster");
  if (kinds.length > others.length) return null;
  // 섞어서 배정 (문은 시작 바로 옆이 아니게)
  const order = others.slice().sort(() => rng() - 0.5);
  const kindOf = new Map<string, Kind>();
  order.forEach((c, i) => kindOf.set(c.id, kinds[i]));
  if ([...start.links].some((l) => kindOf.get(l) === "gate")) return null;

  const byId = new Map(cells.map((c) => [c.id, c]));
  const rooms = new Map<string, Room>();
  const base = (c: Cell) => ({ id: c.id, pos: [c.col, c.row] as [number, number], links: [...c.links].sort() });
  const gateMax = new Map<string, number>();

  // 계획 시뮬레이션
  let h = o.heroStart;
  let at = start.id;
  let moves = 0;
  const cleared = new Set<string>([start.id]);
  const growLeft = { n: o.grow };
  const hiddenLeft = { n: o.hidden };
  const frontier = () => {
    const dist = new Map<string, number>([[at, 0]]);
    const q = [at];
    const out: { id: string; d: number }[] = [];
    while (q.length) {
      const u = q.shift()!;
      for (const v of byId.get(u)!.links) {
        if (dist.has(v)) continue;
        dist.set(v, dist.get(u)! + 1);
        const k = kindOf.get(v);
        const passable = cleared.has(v) || (k === "gate" && (gateMax.get(v) ?? Infinity) >= h);
        if (passable) q.push(v);
        else if (k !== "gate") out.push({ id: v, d: dist.get(v)! });
      }
    }
    return { out, dist };
  };
  // 길 위의 문에 상한을 정한다 (처음 지날 때의 숫자 + 0~2)
  const markGates = (target: string, dist: Map<string, number>) => {
    let cur = target;
    while (cur !== at) {
      const d = dist.get(cur)!;
      const prev = [...byId.get(cur)!.links].find((l) => dist.get(l) === d - 1 && (cleared.has(l) || kindOf.get(l) === "gate" || l === at));
      if (!prev) break;
      if (kindOf.get(prev) === "gate" && !gateMax.has(prev)) gateMax.set(prev, h + randInt(rng, 0, 2));
      cur = prev;
    }
  };

  const planSteps = Math.max(3, Math.round(others.length * 0.6));
  let steps = 0;
  while (steps < planSteps) {
    const { out, dist } = frontier();
    const choices = out.filter((f) => f.id !== boss.id && !rooms.has(f.id));
    if (!choices.length) break;
    const t = pick(rng, choices);
    markGates(t.id, dist);
    const cell = byId.get(t.id)!;
    const k = kindOf.get(t.id)!;
    const enc = moves + t.d - 1;
    if (k === "monster") {
      if (h < 2) return null;
      const p = randInt(rng, Math.max(1, Math.round(h * 0.3)), h - 1);
      const m: MonsterRoom = { ...base(cell), type: "monster", power: p };
      if (growLeft.n > 0 && enc > 0) {
        growLeft.n--;
        const grow = { every: randInt(rng, 2, 3), by: randInt(rng, 2, 4) };
        const basePower = p - grow.by * Math.floor(enc / grow.every);
        if (basePower < 1) return null;
        Object.assign(m, { power: basePower, reward: p, grow });
      }
      if (hiddenLeft.n > 0 && rng() < 0.5) hiddenLeft.n--, (m.hidden = true);
      rooms.set(t.id, m);
      h += m.reward ?? m.power;
    } else if (k === "item") {
      const e = rng() < 0.35 ? "x2" : `+${randInt(rng, 2, Math.max(3, Math.round(h / 2)))}`;
      rooms.set(t.id, { ...base(cell), type: "item", effect: e });
      h = applyEffect(h, e);
    } else if (k === "trap") {
      const e = rng() < 0.5 ? "/2" : `-${randInt(rng, 1, Math.max(1, Math.round(h / 3)))}`;
      if (applyEffect(h, e) < 1) return null;
      rooms.set(t.id, { ...base(cell), type: "trap", effect: e });
      h = applyEffect(h, e);
    } else if (k === "chest") {
      const contents = pick(rng, CHEST_SETS);
      rooms.set(t.id, { ...base(cell), type: "chest", contents });
      // 계획은 가장 나쁜 결과로 이어간다
      h = Math.min(...contents.map((e) => applyEffect(h, e)));
      if (h < 1) return null;
    }
    cleared.add(t.id);
    at = t.id;
    moves += t.d;
    steps++;
  }
  // 보스에 닿아야 한다
  const { out, dist } = frontier();
  const bossStep = out.find((f) => f.id === boss.id);
  if (!bossStep) return null;
  markGates(boss.id, dist);
  moves += bossStep.d;
  const bossPower = h - randInt(rng, 1, Math.max(1, Math.round(h * 0.15)));
  // 보스가 너무 쉬우면 버린다 (시작 숫자의 2.5배 이상)
  if (bossPower < o.heroStart * 2.5) return null;
  rooms.set(boss.id, { ...base(boss), type: "boss", power: bossPower });

  // 미끼 채우기
  let poisonLeft = o.poison;
  for (const c of others) {
    if (rooms.has(c.id)) continue;
    const k = kindOf.get(c.id)!;
    if (k === "gate") {
      rooms.set(c.id, { ...base(c), type: "gate", maxPower: gateMax.get(c.id) ?? randInt(rng, o.heroStart + 2, Math.max(o.heroStart + 3, h)) });
    } else if (k === "monster") {
      if (poisonLeft > 0) {
        poisonLeft--;
        rooms.set(c.id, { ...base(c), type: "monster", power: randInt(rng, 1, 3), reward: -randInt(rng, 2, Math.max(3, Math.round(o.heroStart * 0.8))) });
      } else {
        rooms.set(c.id, { ...base(c), type: "monster", power: randInt(rng, Math.round(o.heroStart * 1.2), Math.round(h * 0.9)) });
      }
    } else if (k === "item") {
      rooms.set(c.id, { ...base(c), type: "item", effect: `+${randInt(rng, 2, 6)}` });
    } else if (k === "trap") {
      rooms.set(c.id, { ...base(c), type: "trap", effect: pick(rng, ["/2", "-3", "-5"]) });
    } else {
      rooms.set(c.id, { ...base(c), type: "chest", contents: pick(rng, CHEST_SETS) });
    }
  }
  rooms.set(start.id, { ...base(start), type: "start" });
  if (poisonLeft > 0 && o.poison > 0) return null;
  return {
    id: o.id,
    title: o.title,
    heroStart: o.heroStart,
    undoLimit: o.undoLimit,
    ...(o.moveLimit ? { moveLimit: moves + randInt(rng, 0, 2) } : {}),
    rooms: cells.map((c) => rooms.get(c.id)!),
  };
}

export type GenResult = { stage: Stage; seed: number; solutions: number; tries: number };

/** 조건을 통과하는 스테이지를 찾는다. 못 찾으면 null */
export function generateStage(seed: number, options: Partial<GenOptions> & Pick<GenOptions, "id" | "title">): GenResult | null {
  const o: GenOptions = { ...DEFAULT_GEN, ...options };
  const rng = seeded(seed);
  for (let t = 1; t <= o.tries; t++) {
    const stage = build(rng, o);
    if (!stage) continue;
    const res = solve(stage);
    if (!res.solvable || res.solutions > o.maxSolutions) continue;
    if (o.requireGreedyFail && greedyWins(stage)) continue;
    return { stage, seed, solutions: res.solutions, tries: t };
  }
  return null;
}

/** 날짜 → 시드 (매일 도전) */
export function dateSeed(d: Date) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// 테스트에서 쓰는 보조
export { beats, monsterPowerAt };
