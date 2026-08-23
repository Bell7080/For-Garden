/**
 * 정보창이 표시하고 변경할 수 있는 범위를 호출자가 명시하는 권한 문맥이다.
 *
 * 적은 여기에 없다. 적은 성장 입력이 아예 없는 별도 화면(`ui/EnemyStatusWindow.ts`)이 맡으므로,
 * 이 창을 "적 문맥"으로 여는 길을 남겨 두면 급여·유대 판을 숨기는 것만으로 적을 보여 주는
 * 예전 임시 화면이 되살아난다.
 */
export type InfoContext = "owner" | "friend";
export interface InfoCapabilities {
  mutateProgress: boolean;
  showGrowth: boolean;
  showBond: boolean;
}

/** 문맥 판정은 UI와 테스트가 공유하는 순수 화이트리스트다. */
export function capabilitiesFor(context: InfoContext): Readonly<InfoCapabilities> {
  if (context === "owner") return { mutateProgress: true, showGrowth: true, showBond: true };
  return { mutateProgress: false, showGrowth: true, showBond: false };
}
