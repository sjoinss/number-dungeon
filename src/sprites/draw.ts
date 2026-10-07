import type { PixelSprite } from "../lib/schema";

/**
 * 도트 그림 → 캔버스 / data URL (브라우저 전용). 같은 그림 객체는 한 번만 만든다.
 * 화면에서는 작은 원본을 CSS로 키우고 image-rendering: pixelated 로 선명하게 보여준다.
 */

const canvasCache = new WeakMap<PixelSprite, HTMLCanvasElement>();
const urlCache = new WeakMap<PixelSprite, string>();

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

export function spriteCanvas(sprite: PixelSprite): HTMLCanvasElement {
  const hit = canvasCache.get(sprite);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(sprite.width, sprite.height);
    sprite.pixels.forEach((color, i) => {
      const rgb = color ? hexToRgb(color) : null;
      if (!rgb) return;
      img.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
    });
    ctx.putImageData(img, 0, 0);
  }
  canvasCache.set(sprite, canvas);
  return canvas;
}

export function spriteUrl(sprite: PixelSprite): string {
  const hit = urlCache.get(sprite);
  if (hit) return hit;
  const url = spriteCanvas(sprite).toDataURL("image/png");
  urlCache.set(sprite, url);
  return url;
}

/** 에디터 캔버스용 (점프점프 DotCanvas가 쓰는 함수 이름 그대로) */
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: PixelSprite, x: number, y: number, width: number, height: number) {
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteCanvas(sprite), Math.round(x), Math.round(y), width, height);
  ctx.imageSmoothingEnabled = prev;
}
