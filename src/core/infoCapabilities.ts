/** 정보창이 표시하고 변경할 수 있는 범위를 호출자가 명시하는 권한 문맥이다. */
export type InfoContext = "owner" | "friend" | "enemy";
export interface InfoCapabilities {
  mutateProgress: boolean;
  showGrowth: boolean;
  showBond: boolean;
  showRuntimeCombat: boolean;
}

/** 문맥 판정은 UI와 테스트가 공유하는 순수 화이트리스트다. */
export function capabilitiesFor(context: InfoContext): Readonly<InfoCapabilities> {
  if (context === "owner") return { mutateProgress: true, showGrowth: true, showBond: true, showRuntimeCombat: false };
  if (context === "friend") return { mutateProgress: false, showGrowth: true, showBond: false, showRuntimeCombat: false };
  return { mutateProgress: false, showGrowth: false, showBond: false, showRuntimeCombat: true };
}
