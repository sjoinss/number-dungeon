"use client";

import { useEffect, useState } from "react";
import type { PixelSprite } from "@/lib/schema";
import { spriteUrl } from "@/sprites/draw";
import styles from "./SpriteImg.module.css";

type Props = {
  sprite: PixelSprite;
  /** 비우면 장식용(alt="") — 의미는 옆 글자나 버튼 이름으로 전달한다 */
  alt?: string;
  className?: string;
};

/** 도트 그림을 선명하게 키워 보여준다 (image-rendering: pixelated). data URL은 브라우저에서만 만든다 */
export function SpriteImg({ sprite, alt = "", className }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    setSrc(spriteUrl(sprite));
  }, [sprite]);
  if (!src) return <span className={`${styles.sprite} ${className ?? ""}`} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`${styles.sprite} ${className ?? ""}`} draggable={false} />;
}
