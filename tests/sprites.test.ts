import { test } from "node:test";
import assert from "node:assert/strict";
import { blankSprite } from "../src/editor/grid";
import { checkFile, removeCornerBackground, rgbaToSprite } from "../src/editor/imageConvert";
import { createEditor, current, editorReducer, isDirty, type EditorAction, type EditorState } from "../src/editor/session";
import { newAttempt } from "../src/game/attempt";
import { STAGES } from "../src/game/levels";
import { roomSpeech } from "../src/game/messages";
import { parseCustomSprites } from "../src/lib/schema";
import { slotFor } from "../src/sprites/assign";
import { CHIBI, CHIBI_HEAD_RATIO, compose, humanoidParts, skinToChibi, type Texture } from "../src/sprites/chibi";
import { DEFAULT_HERO, DEFAULT_MONSTERS } from "../src/sprites/defaults";

const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);

test("에디터: 붓질 한 번 = 되돌리기 한 칸, 대칭·채우기·지우개", () => {
  let s = createEditor(blankSprite(16, 16), "#ff0000");
  s = run(s, { type: "pointer", phase: "start", x: 0, y: 0 }, { type: "pointer", phase: "move", x: 3, y: 0 }, { type: "pointer", phase: "end", x: 3, y: 0 });
  assert.deepEqual(current(s).pixels.slice(0, 5), ["#ff0000", "#ff0000", "#ff0000", "#ff0000", ""]);
  assert.equal(s.history.past.length, 1);
  assert.ok(isDirty(s));
  s = run(s, { type: "undo" });
  assert.ok(current(s).pixels.every((p) => p === ""));
  // 대칭
  s = run(s, { type: "symmetry" }, { type: "pointer", phase: "start", x: 0, y: 1 }, { type: "pointer", phase: "end", x: 0, y: 1 });
  assert.equal(current(s).pixels[16 + 15], "#ff0000");
  // 바뀐 게 없는 붓질은 기록에서 빠진다 (앞 기록을 지우지 않는다)
  const before = s.history.past.length;
  s = run(s, { type: "pointer", phase: "start", x: 0, y: 1 }, { type: "pointer", phase: "end", x: 0, y: 1 });
  assert.equal(s.history.past.length, before);
  // 핀치(취소)는 붓질 전으로
  s = run(s, { type: "pointer", phase: "start", x: 5, y: 5 }, { type: "pointer", phase: "cancel", x: 5, y: 5 });
  assert.equal(current(s).pixels[5 * 16 + 5], "");
  // 크기 바꾸기
  s = run(s, { type: "resize", size: 32 });
  assert.equal(current(s).width, 32);
});

test("치비: 머리 비율은 기획서 권장(55~62%) 안, 결과는 32×32", () => {
  assert.ok(CHIBI_HEAD_RATIO >= 0.55 && CHIBI_HEAD_RATIO <= 0.62, String(CHIBI_HEAD_RATIO));
  // 부위마다 다른 색으로 칠한 가짜 스킨
  const rgba = new Uint8ClampedArray(64 * 64 * 4);
  const fill = (x: number, y: number, w: number, h: number, c: number[]) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) rgba.set([...c, 255], (yy * 64 + xx) * 4);
  };
  fill(8, 8, 8, 8, [255, 0, 0]); // 머리
  fill(20, 20, 8, 12, [0, 255, 0]); // 몸
  fill(4, 20, 4, 12, [0, 0, 255]); // 다리
  const tex: Texture = { rgba, width: 64, height: 64 };
  const s = skinToChibi(tex);
  assert.equal(s.width, CHIBI.size);
  assert.equal(s.pixels[10 * 32 + 16], "#ff0000"); // 머리 가운데
  assert.equal(s.pixels[31 * 32 + 13], "#0000ff"); // 맨 아래 줄은 다리
  assert.equal(compose(tex, humanoidParts({ head: { x: 8, y: 8, w: 8, h: 8 }, body: { x: 20, y: 20, w: 8, h: 12 }, armL: { x: 44, y: 20, w: 4, h: 12 }, legL: { x: 4, y: 20, w: 4, h: 12 } })).pixels.length, 1024);
});

test("이미지 → 도트: 비율 유지·아래 정렬, 반투명 절반 미만은 투명", () => {
  // 2×1 이미지: 왼쪽 빨강, 오른쪽 투명
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
  const s = rgbaToSprite(rgba, 2, 1, 16);
  assert.equal(s.width, 16);
  assert.equal(s.pixels[15 * 16 + 0], "#ff0000");
  assert.equal(s.pixels[15 * 16 + 15], "");
  assert.equal(s.pixels[0], "");
  const bg = { ...blankSprite(16, 16), pixels: new Array(256).fill("#ffffff") };
  bg.pixels[8 * 16 + 8] = "#000000";
  const cut = removeCornerBackground(bg);
  assert.equal(cut.pixels[0], "");
  assert.equal(cut.pixels[8 * 16 + 8], "#000000");
  assert.equal(checkFile("image/svg+xml", 10).ok, false);
  const big = checkFile("image/png", 3 * 1024 * 1024);
  assert.ok(!big.ok && big.message.includes("2MB"));
});

test("저장 데이터: 이상한 값은 기본으로, 기본 몬스터 칸 수는 유지", () => {
  const c = parseCustomSprites({ hero: { kind: "pixel", width: 16, height: 16, pixels: ["<script>"] }, monsters: [null, DEFAULT_HERO, "x"] }, DEFAULT_MONSTERS.length);
  assert.equal(c.hero, null);
  assert.equal(c.monsters.length, DEFAULT_MONSTERS.length);
  assert.deepEqual(c.monsters[1], DEFAULT_HERO);
  assert.deepEqual(parseCustomSprites(undefined, 6).monsters, [null, null, null, null, null, null]);
});

test("몬스터 외형은 몬스터 id로 고정", () => {
  assert.equal(slotFor("s01", "b", 6), slotFor("s01", "b", 6));
  const seen = new Set(STAGES.flatMap((s) => s.rooms.map((r) => slotFor(s.id, r.id, 6))));
  assert.ok(seen.size > 3);
});

test("방 안내는 보이는 정보만 — 이길 수 있는지는 말하지 않는다", () => {
  const a = newAttempt(STAGES[0]);
  for (const room of a.stage.rooms) {
    const text = roomSpeech(a, room, { here: false, adjacent: true, hidden: false, power: 3 });
    assert.ok(!/이길 수|질 수|안전|위험/.test(text), text);
  }
});
