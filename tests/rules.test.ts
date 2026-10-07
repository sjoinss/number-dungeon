import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canUndo,
  newAttempt,
  newSession,
  moveTo,
  pickChest,
  sessionMove,
  sessionRestart,
  sessionUndo,
  undo,
  type Attempt,
} from "../src/game/attempt";
import { TIE_RESULT, applyEffect, beats, effectLabel, monsterPowerAt } from "../src/game/rules";
import { penaltyOf, starsFor } from "../src/game/stars";
import type { Stage } from "../src/game/types";

const R = (id: string, type: string, links: string[], extra: Record<string, unknown> = {}) =>
  ({ id, type, pos: [0, 0], links, ...extra }) as Stage["rooms"][number];

const basic: Stage = {
  id: "t",
  title: "t",
  heroStart: 5,
  undoLimit: 3,
  rooms: [
    R("s", "start", ["a", "b", "g", "c", "t"]),
    R("a", "monster", ["boss"], { power: 4 }),
    R("b", "monster", [], { power: 5 }),
    R("g", "gate", [], { maxPower: 6 }),
    R("c", "chest", [], { contents: ["+5", "x2", "empty"] }),
    R("t", "trap", [], { effect: "/2" }),
    R("boss", "boss", [], { power: 8 }),
  ],
};

const fixedRng = () => 0.3;

test("판정: 큰 숫자가 이기고, 동점은 기본 패배", () => {
  assert.equal(TIE_RESULT, "lose");
  assert.equal(beats(5, 4), true);
  assert.equal(beats(5, 5), false);
  assert.equal(beats(4, 5), false);
});

test("효과 계산과 표시", () => {
  assert.equal(applyEffect(7, "/2"), 3);
  assert.equal(applyEffect(7, "x2"), 14);
  assert.equal(applyEffect(7, "-3"), 4);
  assert.equal(applyEffect(7, "empty"), 7);
  assert.equal(effectLabel("x2"), "×2");
  assert.equal(effectLabel("-3"), "−3");
});

test("시간 변화 몬스터는 이동 every번마다 by씩 커진다", () => {
  const m = { id: "m", type: "monster" as const, pos: [0, 0] as [number, number], links: [], power: 3, grow: { every: 2, by: 5 } };
  assert.equal(monsterPowerAt(m, 0), 3);
  assert.equal(monsterPowerAt(m, 1), 3);
  assert.equal(monsterPowerAt(m, 2), 8);
});

test("이기면 흡수하고 방이 비워진다", () => {
  const a = moveTo(newAttempt(basic, fixedRng), "a");
  assert.equal(a.status, "playing");
  assert.equal(a.snap.power, 9);
  assert.equal(a.snap.at, "a");
  assert.deepEqual(a.snap.cleared, ["a"]);
});

test("같거나 큰 몬스터에 부딪히면 즉시 패배, 숨은 숫자는 그 시도 동안 공개", () => {
  const a = moveTo(newAttempt(basic, fixedRng), "b");
  assert.equal(a.status, "lost");
  assert.deepEqual(a.revealed, ["b"]);
  // 진 뒤에는 아무것도 되지 않는다 (실패는 되돌리기 대상이 아님)
  assert.equal(canUndo(a), false);
  assert.equal(moveTo(a, "a"), a);
});

test("상한 문: 넘으면 단순 막힘(상태 그대로), 이하면 통과", () => {
  const big = moveTo(newAttempt(basic, fixedRng), "a"); // 9
  const blocked = moveTo(big, "s");
  const tryGate = moveTo(blocked, "g");
  assert.equal(tryGate.event.kind, "gateBlocked");
  assert.equal(tryGate.snap, blocked.snap);
  assert.equal(tryGate.status, "playing");
  const ok = moveTo(newAttempt(basic, fixedRng), "g");
  assert.equal(ok.snap.at, "g");
});

test("되돌리기: 시도당 undoLimit번, 재시작하면 다시 채워진다", () => {
  let s = newSession(basic, fixedRng);
  s = sessionMove(s, "a"); // 9
  s = sessionMove(s, "s");
  s = sessionMove(s, "t"); // 4
  s = sessionMove(s, "s");
  for (let i = 0; i < 3; i++) s = sessionUndo(s);
  assert.equal(s.attempt.undosLeft, 0);
  assert.equal(s.undosUsed, 3);
  assert.equal(canUndo(s.attempt), false);
  const same = sessionUndo(s);
  assert.equal(same.undosUsed, 3);
  assert.equal(same.attempt.event.kind, "noUndo");
  s = sessionRestart(s, fixedRng);
  assert.equal(s.attempt.undosLeft, 3);
  assert.equal(s.restarts, 1);
  assert.equal(s.tries, 2);
  assert.equal(s.attempt.snap.power, 5);
});

test("상자: 고르기 전엔 떠날 수 없고, 고르면 되돌리기 기록을 비운다", () => {
  let a: Attempt = newAttempt(basic, fixedRng);
  a = moveTo(a, "c");
  assert.equal(moveTo(a, "s").event.kind, "needChest");
  // 상자 방에 들어온 이동은 아직 되돌릴 수 있다
  assert.equal(canUndo(a), true);
  const effect = a.chestLayout.c[1];
  a = pickChest(a, 1);
  assert.equal(a.snap.power, applyEffect(5, effect));
  assert.equal(a.undoStack.length, 0);
  assert.equal(canUndo(a), false);
  // 되돌려도 상자 선택 이전으로 못 간다
  assert.equal(undo(a).snap, a.snap);
  // 같은 상자를 다시 고를 수 없다
  assert.equal(pickChest(a, 0), a);
});

test("재시작하면 상자를 다시 섞는다 (배정은 시도 안에서 고정)", () => {
  const seen = new Set<string>();
  let n = 0;
  const rng = () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
  let s = newSession(basic, rng);
  for (let i = 0; i < 30; i++) {
    seen.add(s.attempt.chestLayout.c.join(","));
    const before = s.attempt.chestLayout;
    s = sessionMove(s, "a");
    assert.equal(s.attempt.chestLayout, before);
    s = sessionRestart(s, rng);
  }
  assert.ok(seen.size > 1);
});

test("함정으로 숫자가 1 밑으로 가면 패배", () => {
  const st: Stage = { ...basic, heroStart: 1, rooms: basic.rooms.map((r) => (r.id === "t" ? { ...r, effect: "-3" } : r)) as Stage["rooms"] };
  assert.equal(moveTo(newAttempt(st, fixedRng), "t").status, "lost");
});

test("이동 제한을 다 쓰면 패배, 보스를 잡는 마지막 이동은 승리", () => {
  const st: Stage = { ...basic, moveLimit: 2 };
  let a = moveTo(newAttempt(st, fixedRng), "a");
  a = moveTo(a, "boss");
  assert.equal(a.status, "won");
  let b = moveTo(newAttempt(st, fixedRng), "g");
  b = moveTo(b, "s");
  assert.equal(b.status, "lost");
  assert.equal(b.event.kind, "outOfMoves");
});

test("별: 페널티 0 → 3성, 1~3 → 2성, 그 외 1성", () => {
  assert.equal(starsFor(penaltyOf(0, 0)), 3);
  assert.equal(starsFor(penaltyOf(1, 0)), 2);
  assert.equal(starsFor(penaltyOf(1, 2)), 2);
  assert.equal(starsFor(penaltyOf(2, 2)), 1);
});
