import { PixelIcon } from "./ui/PixelIcon";
import styles from "./Stars.module.css";

/** 별 n개 (색과 함께 빈 별은 윤곽만 — 색만으로 구분하지 않고, 스크린리더는 글자로 읽는다) */
export function Stars({ count, size = 16 }: { count: number; size?: number }) {
  return (
    <span className={styles.stars}>
      <span className="visually-hidden">별 {count}개</span>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= count ? styles.on : styles.off} aria-hidden="true">
          <PixelIcon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}
