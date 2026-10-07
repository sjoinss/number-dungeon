import { test } from "node:test";
import assert from "node:assert/strict";
import { newAttempt, moveTo, pickChest, type Attempt } from "../src/game/attempt";
import { generateStage, seeded } from "../src/game/generator";
import { STAGES } from "../src/game/levels";
import { normalizeStage } from "../src/game/rules";
import { greedyWins, solve } from "../src/game/solver";
import type { Stage } from "../src/game/types";

/** 기획서 8장 구간: 앞 3개는 초반(탐욕 허용), 그 뒤는 탐욕 전략으로 풀리면 안 된다 */
const EARLY = 3;

test("스테이지 12개, id가 겹치지 않는다", () => {
  assert.equal(STAGES.length, 12);
  assert.equal(new Set(STAGES.map((s) => s.id)).size, STAGES.length);
});

for (const [i, stage] of STAGES.entries()) {
  test(`${stage.id} ${stage.title}: 모든 상자 결과에서 클리어 가능`, () => {
    const res = solve(stage);
    assert.ok(res.solvable, `${stage.id}는 풀 수 없음`);
    assert.ok(res.plan.length > 0);
  });

  test(`${stage.id}: 보드 자리가 겹치지 않고, 연결선은 이웃 칸(대각선 포함)끼리이며 서로 엇갈리지 않는다`, () => {
    const s = normalizeStage(stage);
    const seen = new Set<string>();
    for (const r of s.rooms) {
      const k = r.pos.join(",");
      assert.ok(!seen.has(k), `${stage.id}: ${k} 자리 겹침`);
      seen.add(k);
      for (const l of r.links) {
        const o = s.rooms.find((x) => x.id === l)!;
        const dx = o.pos[0] - r.pos[0];
        const dy = o.pos[1] - r.pos[1];
        assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1, `${stage.id}: ${r.id}-${l} 연결선이 이웃 칸이 아님`);
        if (dx !== 0 && dy !== 0) {
          // 같은 2×2 칸에서 반대 대각선과 엇갈리면 안 된다
          const a = s.rooms.find((x) => x.pos[0] === r.pos[0] + dx && x.pos[1] === r.pos[1]);
          const b = s.rooms.find((x) => x.pos[0] === r.pos[0] && x.pos[1] === r.pos[1] + dy);
          assert.ok(!(a && b && a.links.includes(b.id)), `${stage.id}: ${r.id}-${l} 대각선이 엇갈림`);
        }
      }
    }
  });

  if (i >= EARLY) {
    test(`${stage.id}: 탐욕 전략(낮은 숫자부터)으로는 풀리지 않는다`, () => {
      assert.equal(greedyWins(stage), false);
    });
  }
}

test("구간별 규칙 도입: 튜토리얼은 되돌리기 무제한, 마지막은 0회", () => {
  assert.equal(STAGES[0].undoLimit, null);
  assert.equal(STAGES[1].undoLimit, null);
  assert.equal(STAGES[STAGES.length - 1].undoLimit, 0);
});

/**
 * 솔버의 해답을 실제 게임 규칙(attempt.ts)으로 따라가 보스를 잡는지 — 솔버와 게임 규칙이 같은지 확인.
 * 지금 상태를 새 스테이지로 바꿔 매번 다시 푼다 (이동 수를 0부터 다시 세므로 시간 변화 몬스터 스테이지는 뺀다)
 */
function playPlan(stage: Stage, rngSeed: number): Attempt {
  const rng = seeded(rngSeed);
  let a = newAttempt(stage, rng);
  const s = normalizeStage(stage);
  // 매 단계 솔버로 다시 계획 (상자 결과가 시도마다 다르므로)
  for (let guard = 0; guard < 40 && a.status === "playing"; guard++) {
    const now: Stage = {
      ...s,
      heroStart: a.snap.power,
      ...(s.moveLimit !== undefined ? { moveLimit: s.moveLimit - a.snap.moves } : {}),
      rooms: s.rooms.map((r) => {
        if (r.id === a.snap.at) return { ...r, type: "start" } as Stage["rooms"][number];
        if (a.snap.cleared.includes(r.id)) return { ...r, type: "empty" } as Stage["rooms"][number];
        if (r.type === "start") return { ...r, type: "empty" } as Stage["rooms"][number];
        return r;
      }),
    };
    const target = solve(now).plan[0];
    if (!target) break;
    // 목표까지 치운 방을 따라 가장 짧은 길로 이동
    const path = shortestPath(a, target);
    for (const step of path) {
      a = moveTo(a, step);
      if (a.status !== "playing") break;
      if (a.event.kind === "chestArrive") a = pickChest(a, Math.floor(rng() * a.chestLayout[step].length));
    }
  }
  return a;
}

function shortestPath(a: Attempt, target: string): string[] {
  const s = a.stage;
  const prev = new Map<string, string>([[a.snap.at, ""]]);
  const q = [a.snap.at];
  while (q.length) {
    const u = q.shift()!;
    if (u === target) break;
    for (const v of s.rooms.find((r) => r.id === u)!.links) {
      if (prev.has(v)) continue;
      const room = s.rooms.find((r) => r.id === v)!;
      const passable =
        v === target ||
        a.snap.cleared.includes(v) ||
        room.type === "start" ||
        room.type === "empty" ||
        (room.type === "gate" && a.snap.power <= room.maxPower);
      if (!passable) continue;
      prev.set(v, u);
      q.push(v);
    }
  }
  const path: string[] = [];
  for (let c = target; c && c !== a.snap.at; c = prev.get(c)!) path.unshift(c);
  return path;
}

test("솔버의 해답을 게임 규칙으로 따라가면 (상자를 아무거나 골라도) 보스를 잡는다", () => {
  for (const stage of STAGES) {
    if (stage.rooms.some((r) => r.type === "monster" && r.grow)) continue;
    for (const seed of [1, 2, 3, 4, 5]) {
      const a = playPlan(stage, seed);
      assert.equal(a.status, "won", `${stage.id} seed ${seed}: ${a.event.kind}`);
    }
  }
});

test("생성기: 같은 시드면 같은 스테이지, 결과는 검증을 통과한다", () => {
  const opts = { id: "g", title: "g", tries: 60 };
  const a = generateStage(123, opts);
  const b = generateStage(123, opts);
  assert.ok(a && b);
  assert.deepEqual(a.stage, b.stage);
  assert.ok(solve(a.stage).solvable);
  assert.equal(greedyWins(a.stage), false);
});
