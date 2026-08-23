/**
 * 정보창이 표시하고 변경할 수 있는 범위를 호출자가 명시하는 권한 문맥이다.
 *
 * 화면을 새로 만들지 않고 같은 정보창에서 **빼는 것**으로 문맥을 가른다. 적·친구에게 급여와
 * 유대가 없다고 전용 화면을 따로 세우면, 정보창이 좋아질 때 그 화면만 옛 모습으로 남는다.
 */
export type InfoContext = "owner" | "friend" | "enemy";
export interface InfoCapabilities {
  /** 급여·돌파·룬·즐겨찾기처럼 플레이어 저장을 바꾸는 입력. */
  mutateProgress: boolean;
  showGrowth: boolean;
  showBond: boolean;
  /** 전투 중인 적에게만 있는 현재 체력·게이지·상태이상 줄. */
  showRuntimeCombat: boolean;
}

/** 문맥 판정은 UI와 테스트가 공유하는 순수 화이트리스트다. */
export function capabilitiesFor(context: InfoContext): Readonly<InfoCapabilities> {
  if (context === "owner") return { mutateProgress: true, showGrowth: true, showBond: true, showRuntimeCombat: false };
  if (context === "friend") return { mutateProgress: false, showGrowth: true, showBond: false, showRuntimeCombat: false };
  return { mutateProgress: false, showGrowth: true, showBond: false, showRuntimeCombat: true };
}
