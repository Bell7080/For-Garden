/**
 * 던전 입구의 **색 한 벌**. 두 던전이 같은 판을 쓰므로 무엇이 다른 곳인지는 색이 말한다 —
 * 치즈케이크 대작전은 치즈빛, 현상수배는 푸른 소라빛이다.
 *
 * `accent`가 고른 칸·윗선·화살표·라운드 표, `accentText`가 그 위에 서는 글자, `deep`이 테마 색 위에
 * 얹는 어두운 글자와 무대 띠다. Phaser를 모르는 순수 표라 테스트도 같은 값을 읽는다.
 */
export interface DungeonTheme {
  accent: number;
  accentText: string;
  deep: number;
  deepText: string;
}

export type DungeonThemeId = "cake" | "bounty";

export const DUNGEON_THEME: Readonly<Record<DungeonThemeId, DungeonTheme>> = {
  cake: { accent: 0xffc83d, accentText: "#ffd766", deep: 0x2b1f06, deepText: "#2b1f06" },
  bounty: { accent: 0x7ccbf2, accentText: "#a3ddff", deep: 0x0a2232, deepText: "#0a2232" },
};
