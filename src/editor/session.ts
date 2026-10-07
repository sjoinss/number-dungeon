import type { PixelSprite } from "../lib/schema";
import { blankSprite, floodFill, flipHorizontal, getPixel, lineCells, paintCells, resizeSprite, shift, withMirror } from "./grid";
import { createHistory, pushHistory, redo, replacePresent, undo, type History } from "./history";

/**
 * 도트 에디터 상태 (순수 reducer). 점프점프 에디터의 도구·되돌리기 방식을 그림 한 장 편집용으로 줄였다.
 * 붓질 한 번(누름 → 끌기 → 뗌)이 되돌리기 한 칸이다.
 */

export type Tool = "pen" | "eraser" | "fill" | "eyedropper" | "move";
export type PointerPhase = "start" | "move" | "end" | "cancel";

export type EditorState = {
  history: History<PixelSprite>;
  /** 마지막으로 저장한 그림 (바뀌었는지 비교) */
  saved: PixelSprite;
  tool: Tool;
  color: string;
  symmetry: boolean;
  grid: boolean;
  stroke: { base: PixelSprite; origin: [number, number]; last: [number, number] } | null;
};

export type EditorAction =
  | { type: "pointer"; phase: PointerPhase; x: number; y: number }
  | { type: "tool"; tool: Tool }
  | { type: "color"; color: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "symmetry" }
  | { type: "grid" }
  | { type: "flip" }
  | { type: "clear" }
  /** 불러온 그림으로 바꾸기 (되돌릴 수 있음) */
  | { type: "replace"; sprite: PixelSprite }
  | { type: "resize"; size: number }
  /** 다른 칸을 열 때: 기록을 새로 시작 */
  | { type: "open"; sprite: PixelSprite }
  | { type: "saved" };

export function createEditor(sprite: PixelSprite, color = "#3d2c5e"): EditorState {
  return { history: createHistory(sprite), saved: sprite, tool: "pen", color, symmetry: false, grid: true, stroke: null };
}

export function current(s: EditorState) {
  return s.history.present;
}

export function isDirty(s: EditorState) {
  const a = s.history.present;
  const b = s.saved;
  return a !== b && (a.width !== b.width || a.pixels.some((p, i) => p !== b.pixels[i]));
}

function paintAt(s: EditorState, sprite: PixelSprite, cells: [number, number][]) {
  const color = s.tool === "eraser" ? "" : s.color;
  return paintCells(sprite, s.symmetry ? withMirror(sprite, cells) : cells, color);
}

function pointer(s: EditorState, a: Extract<EditorAction, { type: "pointer" }>): EditorState {
  const present = s.history.present;
  const at: [number, number] = [a.x, a.y];
  if (a.phase === "start") {
    if (s.tool === "eyedropper") {
      const c = getPixel(present, a.x, a.y);
      return c ? { ...s, color: c, tool: "pen" } : s;
    }
    if (s.tool === "fill") {
      const next = floodFill(present, a.x, a.y, s.color);
      return next === present ? s : { ...s, history: pushHistory(s.history, next) };
    }
    // 붓질마다 기록 한 칸 (바뀐 게 없으면 뗄 때 다시 뺀다). 같은 객체면 push가 무시되므로 복사본을 넣는다
    const painted = s.tool === "move" ? present : paintAt(s, present, [at]);
    const next = painted === present ? { ...present } : painted;
    return { ...s, history: pushHistory(s.history, next), stroke: { base: present, origin: at, last: at } };
  }
  if (!s.stroke) return s;
  if (a.phase === "move") {
    if (s.tool === "move") {
      const moved = shift(s.stroke.base, a.x - s.stroke.origin[0], a.y - s.stroke.origin[1]);
      return { ...s, history: replacePresent(s.history, moved), stroke: { ...s.stroke, last: at } };
    }
    const line = lineCells(s.stroke.last[0], s.stroke.last[1], a.x, a.y);
    return { ...s, history: replacePresent(s.history, paintAt(s, present, line)), stroke: { ...s.stroke, last: at } };
  }
  if (a.phase === "cancel") {
    // 핀치 등으로 취소: 붓질 전으로
    return { ...s, history: undo(s.history), stroke: null };
  }
  // end: 아무것도 안 바뀐 붓질은 기록에서 뺀다
  const changed = s.history.present.pixels.some((p, i) => p !== s.stroke!.base.pixels[i]);
  return { ...s, history: changed ? s.history : undo(s.history), stroke: null };
}

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  const present = s.history.present;
  switch (a.type) {
    case "pointer":
      return pointer(s, a);
    case "tool":
      return { ...s, tool: a.tool };
    case "color":
      return { ...s, color: a.color, tool: s.tool === "eraser" || s.tool === "eyedropper" ? "pen" : s.tool };
    case "undo":
      return { ...s, history: undo(s.history) };
    case "redo":
      return { ...s, history: redo(s.history) };
    case "symmetry":
      return { ...s, symmetry: !s.symmetry };
    case "grid":
      return { ...s, grid: !s.grid };
    case "flip":
      return { ...s, history: pushHistory(s.history, flipHorizontal(present)) };
    case "clear":
      return { ...s, history: pushHistory(s.history, blankSprite(present.width, present.height)) };
    case "replace":
      return { ...s, history: pushHistory(s.history, a.sprite) };
    case "resize":
      return a.size === present.width ? s : { ...s, history: pushHistory(s.history, resizeSprite(present, a.size, a.size)) };
    case "open":
      return { ...createEditor(a.sprite, s.color), grid: s.grid };
    case "saved":
      return { ...s, saved: present };
  }
}
