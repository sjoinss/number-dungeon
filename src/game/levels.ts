import raw from "./levels.json";
import { parseEffect } from "./rules";
import type { Room, Stage } from "./types";

/**
 * 고정 스테이지 (levels.json — scripts/build-levels.cjs로 만들고 검수한 것).
 * JSON은 타입이 넓어서 여기서 모양을 확인한 뒤 Stage로 쓴다. 잘못된 데이터는 빌드·테스트에서 바로 드러나게 오류를 낸다.
 */

const ROOM_TYPES = new Set<Room["type"]>(["start", "empty", "monster", "boss", "chest", "trap", "item", "gate"]);

function fail(msg: string): never {
  throw new Error(`levels.json: ${msg}`);
}

export function parseStage(v: unknown): Stage {
  const s = v as Stage;
  if (!s || typeof s.id !== "string" || typeof s.title !== "string") fail("id/title");
  if (!Number.isInteger(s.heroStart) || s.heroStart < 1) fail(`${s.id} heroStart`);
  if (s.undoLimit !== null && !(Number.isInteger(s.undoLimit) && s.undoLimit >= 0)) fail(`${s.id} undoLimit`);
  if (!Array.isArray(s.rooms) || s.rooms.length < 2) fail(`${s.id} rooms`);
  for (const r of s.rooms) {
    if (!ROOM_TYPES.has(r.type)) fail(`${s.id}/${r.id} type`);
    if (!Array.isArray(r.pos) || r.pos.length !== 2) fail(`${s.id}/${r.id} pos`);
    if (r.type === "trap" || r.type === "item") parseEffect(r.effect);
    if (r.type === "chest") r.contents.forEach(parseEffect);
  }
  if (s.rooms.filter((r) => r.type === "start").length !== 1) fail(`${s.id} 시작 방은 하나`);
  if (s.rooms.filter((r) => r.type === "boss").length !== 1) fail(`${s.id} 보스 방은 하나`);
  return s;
}

export const STAGES: Stage[] = (raw as unknown[]).map(parseStage);

export function stageIndex(id: string) {
  return STAGES.findIndex((s) => s.id === id);
}
