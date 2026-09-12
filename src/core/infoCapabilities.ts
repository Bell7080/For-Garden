/**
 * 정보창이 표시하고 변경할 수 있는 범위를 호출자가 명시하는 권한 문맥이다.
 *
 * 화면을 새로 만들지 않고 같은 정보창에서 **빼는 것**으로 문맥을 가른다. 친구에게 급여와
 * 유대가 없다고 전용 화면을 따로 세우면, 정보창이 좋아질 때 그 화면만 옛 모습으로 남는다.
 *
 * **적만 예외로 팝업 한 장을 쓴다**(`src/ui/EnemyInfoPopup.ts`). 적에게는 유대·급여·룬이 함께
 * 빠져 남는 것이 절반뿐이라, 이 화면에 세우면 판 넷 중 둘이 비어 초라하게 읽혔다. 스킬 본문은
 * 여전히 같은 조립기(`buildSkillViewModel`)를 지나므로 두 곳이 갈리지 않는다.
 */
export type InfoContext = "owner" | "friend";
export interface InfoCapabilities {
  /** 급여·돌파·룬·즐겨찾기처럼 플레이어 저장을 바꾸는 입력. */
  mutateProgress: boolean;
  showGrowth: boolean;
  showBond: boolean;
  /** 보유/공개된 렐릭에 귀속된 소환수 성장 정보를 표시할 수 있는가. */
  showSummons: boolean;
}

/** 문맥 판정은 UI와 테스트가 공유하는 순수 화이트리스트다. */
export function capabilitiesFor(context: InfoContext): Readonly<InfoCapabilities> {
  if (context === "owner") return { mutateProgress: true, showGrowth: true, showBond: true, showSummons: true };
  return { mutateProgress: false, showGrowth: true, showBond: false, showSummons: true };
}
