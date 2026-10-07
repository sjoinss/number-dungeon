/**
 * 스테이지 데이터 (기획서 14장). 스테이지는 데이터로만 정의하고, 규칙은 rules.ts(순수 함수)에서 다룬다.
 * 방(타일)은 links로 이어진 그래프다. 한 방에 한 가지 요소만 있다.
 */

/** 효과 문자열: "+5"(더하기) · "-3"(빼기) · "x2"(곱하기) · "/2"(나누기, 버림) · "empty"(빈 상자) */
export type Effect = string;

type RoomBase = {
  id: string;
  /** 보드 위 자리 [열, 행] — 0행이 맨 위 */
  pos: [number, number];
  /** 이어진 방 id. 한쪽에만 적어도 양쪽으로 이어진다(normalizeStage) */
  links: string[];
};

/** 시간 변화: 이동 every번마다 숫자가 by씩 커진다 */
export type Grow = { every: number; by: number };

export type StartRoom = RoomBase & { type: "start" };
export type EmptyRoom = RoomBase & { type: "empty" };
export type MonsterRoom = RoomBase & {
  type: "monster";
  power: number;
  /** 이기면 더해지는 양. 없으면 power와 같다. 음수면 독 */
  reward?: number;
  /** 숫자를 ?로 가린다 (지면 그 시도 동안 공개) */
  hidden?: boolean;
  grow?: Grow;
};
export type BossRoom = RoomBase & { type: "boss"; power: number; hidden?: boolean };
export type ChestRoom = RoomBase & {
  type: "chest";
  /** 내용물 목록(멀티셋). 시도마다 섞어서 상자에 하나씩 넣는다. 상자 개수 = 목록 길이 */
  contents: Effect[];
};
export type TrapRoom = RoomBase & { type: "trap"; effect: Effect };
export type ItemRoom = RoomBase & { type: "item"; effect: Effect };
export type GateRoom = RoomBase & { type: "gate"; maxPower: number };

export type Room = StartRoom | EmptyRoom | MonsterRoom | BossRoom | ChestRoom | TrapRoom | ItemRoom | GateRoom;
export type RoomType = Room["type"];

export type Stage = {
  id: string;
  title: string;
  /** 스테이지 선택·시작 때 보여주는 한 줄 설명 (새 규칙 소개) */
  intro?: string;
  heroStart: number;
  /** 시도당 되돌리기 횟수. null = 무제한 (튜토리얼) */
  undoLimit: number | null;
  /** 이동 횟수 제한 (없으면 무제한) */
  moveLimit?: number;
  rooms: Room[];
};
