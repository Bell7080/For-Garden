/**
 * 전투 점수 숫자가 목표값을 따라가는 한 프레임의 순수 표시 모델이다.
 * 실제 정산값은 바꾸지 않고, 큰 점수 증가일수록 숫자가 더 크게 부풀도록 시각값만 계산한다.
 */
export function stepBattleScoreMotion(shown: number, target: number, elapsedMs: number): { shown: number; punch: number } {
  const safeShown = Number.isFinite(shown) ? Math.max(0, shown) : 0;
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const delta = Math.max(0, safeTarget - safeShown);
  if (delta === 0) return { shown: safeTarget, punch: 0 };

  // 짧은 프레임에서도 최소 1점은 움직이고, 긴 프레임은 지수 보간으로 같은 체감 속도를 유지한다.
  const ratio = 1 - Math.exp(-Math.max(0, elapsedMs) / 150);
  const next = Math.min(safeTarget, safeShown + Math.max(1, Math.ceil(delta * ratio)));
  // 로그 크기는 수십 점과 수만 점 사이를 모두 읽히게 하되 레이아웃을 침범하지 않게 상한을 둔다.
  const punch = Math.min(0.28, Math.log10(1 + delta) * 0.055);
  return { shown: next, punch };
}
