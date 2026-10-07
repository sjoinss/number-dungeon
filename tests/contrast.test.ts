import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 색 대비 검수 (WCAG 2.2 AA). tokens.css를 직접 읽어 확인한다 (점프점프의 대비 테스트를 그대로 가져옴).
 * 글자는 4.5:1, 포커스 링처럼 꼭 보여야 하는 UI 표시는 3:1.
 */

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function block(selector: string) {
  const i = css.indexOf(selector + " {");
  if (i < 0) throw new Error(`${selector} 없음`);
  return css.slice(i, css.indexOf("\n}", i));
}

function vars(text: string) {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const ROOT = vars(block(":root"));
const THEMES: Record<string, Record<string, string>> = { 기본: ROOT };

function resolve(t: Record<string, string>, name: string): string {
  let v = t[name];
  for (let i = 0; i < 5 && v?.startsWith("var("); i++) v = t[v.slice(4, -1).trim()];
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name} = ${v} (#rrggbb가 아님)`);
  return v;
}

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [글자색, 그 글자가 실제로 올라가는 배경들] */
const TEXT_PAIRS: [string, string[]][] = [
  [
    "--color-ink",
    [
      "--color-background",
      "--color-surface",
      "--color-surface-alt",
      "--color-primary",
      "--color-primary-soft",
      "--color-secondary",
      "--color-secondary-soft",
      "--color-mint",
      "--color-butter",
      "--color-sky",
      "--color-cream",
      "--color-danger-fill",
      "--color-desk-bg",
      "--color-desk-bg-2",
      // 보드: 방 칸·숫자 칩 위 숫자
      "--board-floor",
      "--room-fill",
      "--room-cleared",
      "--room-current",
      "--chip-fill",
      "--chip-hero",
    ],
  ],
  ["--color-muted", ["--color-background", "--color-surface", "--color-surface-alt", "--color-primary-soft", "--color-secondary-soft"]],
  ["--color-primary-strong", ["--color-background", "--color-surface", "--color-secondary-soft", "--color-primary-soft"]],
  ["--color-success", ["--color-success-soft", "--color-surface"]],
  ["--color-warning", ["--color-warning-soft", "--color-surface"]],
  ["--color-error", ["--color-error-soft", "--color-surface"]],
];

/** 꼭 보여야 하는 UI 표시 (3:1) */
const UI_PAIRS: [string, string[]][] = [
  ["--color-focus", ["--color-background", "--color-surface", "--color-surface-alt", "--color-primary-soft", "--board-floor", "--room-fill"]],
  // 갈 수 있는 길(진한 선)은 바닥과 구분되어야 한다
  ["--board-path-open", ["--board-floor", "--board-floor-tile"]],
];

for (const [theme, t] of Object.entries(THEMES)) {
  test(`대비 · ${theme}: 글자 4.5:1 이상`, () => {
    const bad: string[] = [];
    for (const [fg, bgs] of TEXT_PAIRS)
      for (const bg of bgs) {
        const r = contrast(resolve(t, fg), resolve(t, bg));
        if (r < 4.5) bad.push(`${fg} / ${bg} = ${r.toFixed(2)}`);
      }
    assert.deepEqual(bad, []);
  });

  test(`대비 · ${theme}: 포커스 표시 3:1 이상`, () => {
    const bad: string[] = [];
    for (const [fg, bgs] of UI_PAIRS)
      for (const bg of bgs) {
        const r = contrast(resolve(t, fg), resolve(t, bg));
        if (r < 3) bad.push(`${fg} / ${bg} = ${r.toFixed(2)}`);
      }
    assert.deepEqual(bad, []);
  });
}

/** 반투명 색(rgba)을 바탕색 위에 깐 결과 */
function blend(rgba: string, bgHex: string) {
  const m = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(rgba);
  if (!m) throw new Error(`${rgba}는 rgba()가 아님`);
  const a = Number(m[4]);
  const bg = [1, 3, 5].map((i) => parseInt(bgHex.slice(i, i + 2), 16));
  return "#" + [1, 2, 3].map((k, i) => Math.round(Number(m[k]) * a + bg[i] * (1 - a)).toString(16).padStart(2, "0")).join("");
}

test("대비 · 갈 수 있는 방(반투명 민트)을 깐 모든 방 바탕 위 글자 4.5:1 이상, 안 깐 방과 구분됨", () => {
  const bad: string[] = [];
  for (const tint of ["--room-reachable", "--room-reachable-hover"]) {
    for (const base of ["--room-fill", "--room-cleared", "--room-current", "--color-primary-soft", "--color-cream"]) {
      const bg = resolve(ROOT, base);
      const mixed = blend(ROOT[tint], bg);
      const r = contrast(resolve(ROOT, "--color-ink"), mixed);
      if (r < 4.5) bad.push(`${tint} on ${base} = ${r.toFixed(2)}`);
      // 칠한 방이 원래 바탕과 눈에 띄게 달라야 한다 (밝기 차이)
      if (contrast(mixed, bg) < 1.15) bad.push(`${tint} on ${base}: 바탕과 구분이 약함 ${contrast(mixed, bg).toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, []);
});
