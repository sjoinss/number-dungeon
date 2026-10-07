import styles from "./NumberChip.module.css";

type Props = {
  value: string | number;
  /** hero: 주인공(노란 큰 칩) · boss: 보스(분홍) · plain: 몬스터 */
  tone?: "hero" | "boss" | "plain";
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * 머리 위 숫자 칩 (기획서 7.3): 그림과 다른 층에, 늘 그림 위에 그린다.
 * 크림색 바탕 + 잉크 외곽선이라 어떤 그림 위에서도 읽힌다. 화면에 보이는 그대로 읽히므로 따로 이름을 주지 않는다.
 */
export function NumberChip({ value, tone = "plain", size = "md", className }: Props) {
  return <span className={[styles.chip, styles[tone], styles[size], className].filter(Boolean).join(" ")}>{value}</span>;
}
