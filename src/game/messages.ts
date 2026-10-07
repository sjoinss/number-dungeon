import type { Attempt, GameEvent } from "./attempt";
import { effectLabel, effectSpeech, rewardOf } from "./rules";
import type { Room } from "./types";

/**
 * 화면 글자와 스크린리더 안내 (기획서 13: 결과를 aria-live와 글자로 함께).
 * 승패 힌트는 주지 않는다 — 결과는 부딪힌 뒤에만 알려준다.
 */

export type Tone = "info" | "success" | "warning" | "error";
export type Message = { text: string; tone: Tone };

/** 숫자를 읽는 소리에 받침이 있는지 (끝자리 0·1·3·6·7·8: 영/십·일·삼·육·칠·팔) */
const 받침 = (n: number | string) => "013678".includes(String(n).slice(-1));
const 이가 = (n: number | string) => (받침(n) ? "이" : "가");
const 을를 = (n: number | string) => (받침(n) ? "을" : "를");

export function eventMessage(a: Attempt, e: GameEvent = a.event): Message {
  switch (e.kind) {
    case "start":
      return { text: a.stage.intro ?? "보스를 잡으면 클리어!", tone: "info" };
    case "move":
      return { text: "이동했어요.", tone: "info" };
    case "defeat":
      return { text: `${e.monster}${을를(e.monster)} 물리쳤어요! 숫자 ${e.from} → ${e.to}`, tone: "success" };
    case "poisoned":
      return e.to < 1
        ? { text: `독 몬스터를 이겼지만 숫자가 ${e.to}${이가(e.to)} 되어 쓰러졌어요.`, tone: "error" }
        : { text: `독 몬스터였어요! 숫자 ${e.from} → ${e.to}`, tone: "warning" };
    case "lose": {
      const why = e.hero === e.monster ? "숫자가 같으면 져요." : `${e.hero}${이가(e.hero)} ${e.monster}보다 작아요.`;
      return { text: `졌어요! ${e.boss ? "보스" : "몬스터"}의 숫자는 ${e.monster}. ${why}`, tone: "error" };
    }
    case "boss":
      return { text: `보스 ${e.monster}${을를(e.monster)} 물리쳤어요! 클리어!`, tone: "success" };
    case "trap":
      return e.to < 1
        ? { text: `함정 ${effectLabel(e.effect)}! 숫자가 ${e.to}${이가(e.to)} 되어 쓰러졌어요.`, tone: "error" }
        : { text: `함정 ${effectLabel(e.effect)}! 숫자 ${e.from} → ${e.to}`, tone: "warning" };
    case "item":
      return { text: `물약 ${effectLabel(e.effect)}! 숫자 ${e.from} → ${e.to}`, tone: "success" };
    case "gateBlocked":
      return { text: `이 문은 숫자 ${e.max} 이하만 지나갈 수 있어요. 지금은 ${e.hero}.`, tone: "warning" };
    case "gatePass":
      return { text: `문을 지나갔어요 (${e.max} 이하 통과).`, tone: "info" };
    case "chestArrive":
      return { text: `상자 ${e.count}개 중 하나만 열 수 있어요. 고르면 되돌릴 수 없어요.`, tone: "info" };
    case "needChest":
      return { text: "먼저 상자를 하나 골라 주세요.", tone: "warning" };
    case "chestPick": {
      const what = e.effect === "empty" ? "빈 상자였어요." : `${effectLabel(e.effect)}!`;
      return { text: `상자 ${e.index + 1}: ${what} 숫자 ${e.from} → ${e.to}`, tone: e.to < e.from ? "warning" : e.to === e.from ? "info" : "success" };
    }
    case "outOfMoves":
      return { text: "이동 횟수를 다 썼어요.", tone: "error" };
    case "undo":
      return { text: e.left === null ? "한 걸음 되돌렸어요." : `한 걸음 되돌렸어요. 남은 되돌리기 ${e.left}번.`, tone: "info" };
    case "noUndo":
      return { text: a.undoStack.length === 0 ? "되돌릴 행동이 없어요." : "이번 시도의 되돌리기를 다 썼어요.", tone: "warning" };
  }
}

/** 방 버튼의 이름 (스크린리더). 보이는 정보만 말하고 이길지 질지는 말하지 않는다 */
export function roomSpeech(a: Attempt, room: Room, opts: { here: boolean; adjacent: boolean; hidden: boolean; power: number | null }): string {
  const parts: string[] = [];
  const cleared = a.snap.cleared.includes(room.id);
  if (opts.here) parts.push(`지금 있는 곳, 내 숫자 ${a.snap.power}`);
  if (cleared && room.type !== "chest") parts.push("비운 방");
  else
    switch (room.type) {
      case "start":
        parts.push("시작 방");
        break;
      case "empty":
        parts.push("빈 방");
        break;
      case "monster": {
        const n = opts.hidden ? "숫자 모름" : `숫자 ${opts.power}`;
        const r = rewardOf(room);
        const reward = !opts.hidden && r !== room.power && !room.grow ? (r < 0 ? `, 독: 이기면 ${-r} 줄어듦` : `, 이기면 ${r} 늘어남`) : "";
        const grow = room.grow ? `, ${room.grow.every}걸음마다 ${room.grow.by}씩 커짐` : "";
        parts.push(`몬스터 ${n}${reward}${grow}`);
        break;
      }
      case "boss":
        parts.push(`보스 ${opts.hidden ? "숫자 모름" : `숫자 ${opts.power}`}`);
        break;
      case "chest": {
        const picked = a.snap.picked[room.id];
        parts.push(picked === undefined ? `상자 ${room.contents.length}개` : `연 상자: ${effectSpeech(a.chestLayout[room.id][picked])}`);
        break;
      }
      case "trap":
        parts.push(`함정: ${effectSpeech(room.effect)}`);
        break;
      case "item":
        parts.push(`물약: ${effectSpeech(room.effect)}`);
        break;
      case "gate":
        parts.push(`문: 숫자 ${room.maxPower} 이하만 통과`);
        break;
    }
  if (!opts.here) parts.push(opts.adjacent ? "갈 수 있음" : "이어지지 않음");
  return parts.join(", ");
}

