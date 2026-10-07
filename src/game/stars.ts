/**
 * 별 점수 (기획서 6장). 페널티 = 재시작 횟수 + 되돌리기 사용 횟수.
 * 기준값은 여기서만 바꾼다.
 */
export const STAR_RULES = {
  /** 페널티가 이 값 이하면 3성 */
  three: 0,
  /** 이 값 이하면 2성, 넘으면 1성 */
  two: 3,
} as const;

export type Stars = 1 | 2 | 3;

export function penaltyOf(restarts: number, undosUsed: number) {
  return restarts + undosUsed;
}

export function starsFor(penalty: number): Stars {
  if (penalty <= STAR_RULES.three) return 3;
  if (penalty <= STAR_RULES.two) return 2;
  return 1;
}
