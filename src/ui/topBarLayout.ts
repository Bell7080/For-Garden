/** 1080px 기준에서 프로필과 세 칸 재화 묶음 사이에 실제 여백을 남기는 순수 배치표다. */
export const TOP_BAR_LAYOUT = {
  clusterCenter: 0.64,
  /** 스테미나 한 칸만 서는 줄은 오른쪽 끝(설정 아이콘 왼쪽)에 붙어 가운데 제목과 겹치지 않는다. */
  staminaClusterCenter: 910 / 1080,
  profile: { left: 28, avatarSize: 84, contentGap: 16, maxRight: 390, nameMaxCharacters: 10,
    /** 이름과 수식어 사이, 수식어와 레벨 사이 간격(px). 넘칠 때 수식어가 지키는 최소 몫(첫 줄 폭 비율). */
    nameModifierGap: 8, levelGap: 10, modifierMinShare: 0.38 },
} as const;

/** 사용자 입력 이름은 예약 폭을 넘기기 전에 유니코드 단위로 줄여 재화 영역을 침범하지 않는다. */
export function compactTopBarName(value: string): string {
  const characters = Array.from(value.trim());
  const limit = TOP_BAR_LAYOUT.profile.nameMaxCharacters;
  return characters.length <= limit ? characters.join("") : `${characters.slice(0, limit - 1).join("")}…`;
}
