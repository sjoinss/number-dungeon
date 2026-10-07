import { checkFile } from "./imageConvert";

/**
 * 파일 → RGBA 픽셀 (브라우저 전용). 확인 순서: 형식·크기 → 디코딩 → 너무 큰 해상도.
 * 오류 문장은 무엇이 문제이고 어떻게 하면 되는지까지 말한다 (기획서 10.3).
 */

export type Decoded = { rgba: Uint8ClampedArray; width: number; height: number };
export type LoadResult = { ok: true; value: Decoded } | { ok: false; message: string };

const MAX_SIDE = 4096;

export async function loadImageFile(file: File): Promise<LoadResult> {
  const check = checkFile(file.type, file.size);
  if (!check.ok) return check;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, message: "이미지를 열 수 없어요. 파일이 손상되었을 수 있어요. 다른 파일을 골라 주세요." };
  }
  if (bitmap.width > MAX_SIDE || bitmap.height > MAX_SIDE) {
    bitmap.close();
    return { ok: false, message: `이미지가 너무 커요(${MAX_SIDE}px 이하). 크기를 줄인 뒤 다시 골라 주세요.` };
  }
  return { ok: true, value: bitmapToRgba(bitmap) };
}

export function bitmapToRgba(src: ImageBitmap | HTMLImageElement): Decoded {
  const width = src.width;
  const height = src.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("캔버스를 쓸 수 없음");
  ctx.drawImage(src, 0, 0);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  if ("close" in src) src.close();
  return { rgba, width, height };
}

/** 다른 사이트 이미지(CORS 허용)를 픽셀로. 실패하면 예외 */
export function loadCrossOriginImage(url: string, timeoutMs = 8000): Promise<Decoded> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => {
      img.src = "";
      reject(new Error("timeout"));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      try {
        resolve(bitmapToRgba(img));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load"));
    };
    img.src = url;
  });
}
