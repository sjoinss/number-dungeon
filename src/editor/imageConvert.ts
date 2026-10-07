import type { PixelSprite } from "../lib/schema";

/**
 * 이미지 → 도트 칸 (순수 함수). 기획서 10.3: 원본을 그대로 쓰지 않고 정해진 크기로 다시 그려 저장한다.
 * 비율을 지켜 size×size 칸 안에 맞추고(가운데·아래 정렬), 칸마다 덮는 원본 픽셀의 평균색을 쓴다.
 * 칸의 절반 이상이 불투명해야 칠한 칸이 된다.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ACCEPT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const ACCEPT_ATTR = ACCEPT_TYPES.join(",");

export type Check = { ok: true } | { ok: false; message: string };

export function checkFile(type: string, bytes: number): Check {
  if (!(ACCEPT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, message: "PNG, JPEG, WebP, GIF 이미지만 쓸 수 있어요. 다른 형식은 그림판 등에서 PNG로 저장한 뒤 다시 골라 주세요." };
  }
  if (bytes > MAX_IMAGE_BYTES) {
    return { ok: false, message: "파일이 너무 큽니다. 2MB 이하 이미지를 선택해 주세요." };
  }
  return { ok: true };
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");

export function rgbaToSprite(rgba: Uint8ClampedArray, w: number, h: number, size: number): PixelSprite {
  const scale = Math.min(size / w, size / h);
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  const ox = Math.floor((size - dw) / 2);
  // 캐릭터는 바닥에 서 있게 아래 정렬
  const oy = size - dh;
  const pixels = new Array<string>(size * size).fill("");
  for (let ty = 0; ty < dh; ty++) {
    const y0 = Math.floor((ty * h) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * h) / dh));
    for (let tx = 0; tx < dw; tx++) {
      const x0 = Math.floor((tx * w) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * w) / dw));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          const alpha = rgba[i + 3] / 255;
          r += rgba[i] * alpha;
          g += rgba[i + 1] * alpha;
          b += rgba[i + 2] * alpha;
          a += alpha;
          n++;
        }
      }
      if (a / n < 0.5) continue;
      pixels[(oy + ty) * size + ox + tx] = `#${hex2(r / a)}${hex2(g / a)}${hex2(b / a)}`;
    }
  }
  return { kind: "pixel", width: size, height: size, pixels };
}

/** 네 모서리가 같은 색(불투명)이면 그 색을 배경으로 보고 테두리에서 이어진 부분을 지운다 */
export function removeCornerBackground(s: PixelSprite): PixelSprite {
  const { width: w, height: h } = s;
  const corners = [s.pixels[0], s.pixels[w - 1], s.pixels[(h - 1) * w], s.pixels[h * w - 1]];
  const bg = corners[0];
  if (!bg || corners.some((c) => c !== bg)) return s;
  const pixels = s.pixels.slice();
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (pixels[i] !== bg) continue;
    pixels[i] = "";
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return { ...s, pixels };
}
