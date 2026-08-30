/** 1080×1920 기준 팝업 안에서 제목 chrome과 본문이 겹치지 않게 고정한 순수 배치표다. */
export const PLAYER_PROFILE_LAYOUT = {
  popup: { width: 820, height: 900 },
  header: { top: -238, bottom: -72, avatarX: -270, avatarY: -188, avatarSize: 132, textLeft: -176, textRight: 330 },
  experience: { x: 77, y: -105, width: 506, height: 18, valueY: -73 },
  modifiers: { y: -30, width: 192, height: 52, gap: 18 },
  stats: { firstY: 72, secondY: 242, leftX: -190, rightX: 190, width: 350, height: 146 },
  rows: { firstY: 350, gap: 88 },
} as const;

/** 긴 사용자 문자열은 실제 Text bounds가 예약 영역을 넘기 전에 유니코드 단위로 줄인다. */
export function compactProfileText(value: string, maxCharacters: number): string {
  const characters = Array.from(value.trim());
  return characters.length <= maxCharacters ? characters.join("") : `${characters.slice(0, Math.max(1, maxCharacters - 1)).join("")}…`;
}
