import type { Effect, MonsterRoom, Room, Stage } from "./types";

/**
 * 판정 규칙 (기획서 3장). 모두 순수 함수 — 화면과 솔버가 같은 함수를 쓴다.
 */

/** 동점일 때 결과. 기본은 패배 (기획서 17-1) */
export const TIE_RESULT: "win" | "lose" = "lose";

/** 주인공이 이 숫자를 이기는가 */
export function beats(hero: number, monster: number): boolean {
  if (hero === monster) return TIE_RESULT === "win";
  return hero > monster;
}

export type ParsedEffect = { op: "add" | "mul" | "div" | "none"; n: number };

export function parseEffect(e: Effect): ParsedEffect {
  if (e === "empty") return { op: "none", n: 0 };
  const m = /^([+\-x/])(\d+)$/.exec(e);
  if (!m) throw new Error(`알 수 없는 효과: ${e}`);
  const n = Number(m[2]);
  if (m[1] === "+") return { op: "add", n };
  if (m[1] === "-") return { op: "add", n: -n };
  if (m[1] === "x") return { op: "mul", n };
  return { op: "div", n };
}

export function applyEffect(power: number, e: Effect): number {
  const p = parseEffect(e);
  if (p.op === "add") return power + p.n;
  if (p.op === "mul") return power * p.n;
  if (p.op === "div") return Math.floor(power / p.n);
  return power;
}

/** 화면에 쓰는 효과 글자: "+5", "−3", "×2", "÷2", "빈 상자" */
export function effectLabel(e: Effect): string {
  const p = parseEffect(e);
  if (p.op === "none") return "빈 상자";
  if (p.op === "add") return p.n >= 0 ? `+${p.n}` : `−${-p.n}`;
  if (p.op === "mul") return `×${p.n}`;
  return `÷${p.n}`;
}

/** 스크린리더용 효과 설명 */
export function effectSpeech(e: Effect): string {
  const p = parseEffect(e);
  if (p.op === "none") return "아무것도 없음";
  if (p.op === "add") return p.n >= 0 ? `${p.n} 더하기` : `${-p.n} 빼기`;
  if (p.op === "mul") return `${p.n}배`;
  return `${p.n}로 나누기`;
}

export function rewardOf(m: MonsterRoom): number {
  return m.reward ?? m.power;
}

/** 이동 moves번을 한 뒤 그 몬스터의 숫자 (시간 변화 몬스터) */
export function monsterPowerAt(m: MonsterRoom, moves: number): number {
  if (!m.grow) return m.power;
  return m.power + m.grow.by * Math.floor(moves / m.grow.every);
}

/** 숫자가 이보다 작아지면 진다 (함정·독으로 0 이하) */
export const MIN_POWER = 1;

/** 한쪽에만 적은 연결도 양쪽으로 잇는다. 없는 방을 가리키면 오류 */
export function normalizeStage(stage: Stage): Stage {
  const byId = new Map(stage.rooms.map((r) => [r.id, r]));
  const links = new Map(stage.rooms.map((r) => [r.id, new Set<string>()]));
  for (const r of stage.rooms) {
    for (const l of r.links) {
      if (!byId.has(l)) throw new Error(`${stage.id}: ${r.id} → 없는 방 ${l}`);
      if (l === r.id) throw new Error(`${stage.id}: ${r.id}가 자기 자신과 이어짐`);
      links.get(r.id)!.add(l);
      links.get(l)!.add(r.id);
    }
  }
  return { ...stage, rooms: stage.rooms.map((r) => ({ ...r, links: [...links.get(r.id)!].sort() }) as Room) };
}

export function startRoom(stage: Stage): Room {
  const s = stage.rooms.find((r) => r.type === "start");
  if (!s) throw new Error(`${stage.id}: 시작 방 없음`);
  return s;
}

/** 지나다닐 때 아무 일도 없는 방인지 (치운 방 포함) */
export function isPassive(room: Room, cleared: ReadonlySet<string>): boolean {
  return room.type === "start" || room.type === "empty" || room.type === "gate" || cleared.has(room.id);
}
