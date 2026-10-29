import { BACKGROUND } from "./backgroundAssets";

/**
 * 결과판(`StageCompletePopup`)의 **색 한 벌**.
 *
 * 스토리·던전·레이드·원정이 같은 판(표제 → 편성 SD·MVP → 기여도 → 보상 줄)을 쓰므로, 어느
 * 콘텐츠의 결과인지는 짜임이 아니라 색이 말한다 — 던전 입구가 같은 판에 색만 갈아 끼우는 것과
 * 같은 규칙이다(`dungeonTheme.ts`). 테마가 없는 판은 공용 금빛 그대로다.
 *
 * `accent`가 몸판 강조선·구분선·별 표식, `accentText`가 표제·MVP 글자, `deepText`가 MVP 글자의
 * 두꺼운 획, `fill`이 몸판 면, `backdropKey`가 판 실루엣대로 깔리는 원화다.
 */
export interface StageCompleteTheme {
  /** 비우면 공용 금빛이다 — 스토리처럼 뒷배경만 바꾸는 판. */
  accent?: number;
  accentText?: string;
  deepText?: string;
  fill?: number;
  backdropKey?: string;
  /** 원화를 얼마나 남기나 — SD·보상이 먼저 읽혀야 해 옅게 둔다. */
  backdropAlpha?: number;
  /** 원화 위에 덮는 공용 청흑색 페이드의 세기. */
  backdropOverlay?: number;
}

/** 원화는 같은 세기로 옅게 깐다 — 판마다 진하기가 다르면 같은 판이 어디서는 원화가 먼저 읽힌다. */
const BACKDROP = { backdropAlpha: 0.34, backdropOverlay: 0.66 } as const;

/**
 * 원정 — 수장된 제2·제3지부를 오르는 콘텐츠라 **심해의 청록**이다. 몸판도 금빛 판의 남색보다
 * 한 톤 깊은 바닷빛이고, 뒤에는 원정 필드 원화가 옅게 비친다.
 */
export const EXPEDITION_RESULT_THEME: StageCompleteTheme = {
  accent: 0x56c8d4,
  accentText: "#8ee6ef",
  deepText: "#06262e",
  fill: 0x07131a,
  backdropKey: BACKGROUND.expeditionField,
  ...BACKDROP,
};

/** 스토리 — 색은 공용 금빛 그대로 두고, 그 관문이 선 장의 전장 원화만 뒤에 깐다. */
export function storyResultTheme(fieldKey: string): StageCompleteTheme {
  return { backdropKey: fieldKey, ...BACKDROP };
}

/** 고대 지층 — 금빛 스토리와 갈리도록 한 톤 붉은 **구리빛**, 뒤에는 지층 전장. */
export const ANCIENT_RESULT_THEME: StageCompleteTheme = {
  accent: 0xe0975a, accentText: "#f4bb87", deepText: "#2e1708", fill: 0x150e0b,
  backdropKey: BACKGROUND.ancientField, ...BACKDROP,
};

/** 치즈케이크 대작전 — 입구와 같은 치즈빛(`DUNGEON_THEME.cake`). */
export const CAKE_RESULT_THEME: StageCompleteTheme = {
  accent: 0xffc83d, accentText: "#ffd766", deepText: "#2b1f06", fill: 0x17120a,
  backdropKey: BACKGROUND.cakeField, ...BACKDROP,
};

/** 현상수배 — 입구와 같은 푸른 소라빛(`DUNGEON_THEME.bounty`). */
export const BOUNTY_RESULT_THEME: StageCompleteTheme = {
  accent: 0x7ccbf2, accentText: "#a3ddff", deepText: "#0a2232", fill: 0x081520,
  backdropKey: BACKGROUND.bountyField, ...BACKDROP,
};

/**
 * 레이드 — **보스마다** 그 속성의 색이다(수쿠스이노 풀 · 타보아 불 · 코아틀 바람, `ELEMENT_TINT`와 같은 계열).
 * 세 보스가 한 전장 원화를 쓰므로 어느 보스의 판이었는지는 색이 말한다. 풀 밖의 보스는 공용 레이드 빛이다.
 */
const RAID_BOSS_TONE: Readonly<Record<string, Pick<StageCompleteTheme, "accent" | "accentText" | "deepText" | "fill">>> = {
  sukusuino: { accent: 0x63c172, accentText: "#9fe0a8", deepText: "#0d2612", fill: 0x0a1510 },
  taboa: { accent: 0xef5b45, accentText: "#ff9886", deepText: "#2e0e08", fill: 0x170b0a },
  quetzalcoatlus: { accent: 0x86dcc8, accentText: "#b8f0e3", deepText: "#0b2a24", fill: 0x09161a },
};

export function raidResultTheme(bossRelicId: string | undefined): StageCompleteTheme {
  const tone = (bossRelicId && RAID_BOSS_TONE[bossRelicId]) || { accent: 0xc58bff, accentText: "#dcb8ff", deepText: "#1f0e2e", fill: 0x120c18 };
  return { ...tone, backdropKey: BACKGROUND.raidField, ...BACKDROP };
}

/**
 * 점수·순위 블록의 자리(판 가운데가 0, 판 높이 1360).
 *
 * 순위는 기여도 버튼(50) 아래 경험치 블록 자리(172 언저리)에, 점수는 보상 줄(320, 액자 132) 아래에,
 * 보조 조작은 그 밑 판 밑변(680) 위에 선다. 원정 폰토스 정산은 연구원 경험치가 오르지 않는 판이라
 * 그 자리를 주간 순위가 쓴다.
 */
export const RESULT_SCORE_BLOCK = {
  rank: { labelY: 136, labelSize: 22, valueY: 186, valueSize: 48 },
  score: { labelY: 428, labelSize: 24, valueY: 490, valueSize: 66 },
  extras: { y: 612, width: 300, height: 80, gap: 24, font: 26 },
} as const;
