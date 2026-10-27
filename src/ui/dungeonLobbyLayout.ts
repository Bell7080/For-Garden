import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "./popupGeometry";

/**
 * 던전 입구(현상수배·치즈케이크 대작전)의 **세로 좌표 소유자**.
 *
 * 화면은 위에서부터 **전장 무대 → 난이도 줄 → 요약 판 → 조작** 넷이다. 예전에는 단계마다 한 줄씩
 * 쌓은 목록이었는데, 단계가 열 개로 늘자 목록이 화면을 다 먹었고 무엇과 싸우는지는 얼굴 동그라미
 * 셋으로만 읽혔다. 수집형 RPG 던전 입구가 흔히 쓰는 모양 — **고른 단계의 적이 전장에 서 있는 큰
 * 무대 하나 + 아래의 번호 줄** — 로 바꿔, 번호를 누르거나 무대를 좌우로 밀어 단계를 넘긴다.
 *
 * **아래 세 줄은 단계 수와 무관하게 같은 자리에 선다.** 두 던전이 한 표를 읽어 같은 손짓이 같은
 * 자리에 선다. Phaser를 모르는 순수 표다 — 화면과 회귀 테스트가 같은 값을 읽는다.
 */
export const DUNGEON_LOBBY = {
  title: { x: 72, y: 190 },
  /**
   * 고른 단계의 적이 서는 무대. 결투 방어팀 미리보기처럼 **그 콘텐츠의 전장 원화** 위에 SD가 선다.
   * 좌표는 무대 중심 기준이다.
   */
  stage: {
    y: 650, width: 960, height: 780, bevel: 44,
    /** 위쪽 이름 띠의 높이 — 원화 위에서 단계 이름이 읽히도록 짙게 누른다. */
    band: 132,
    /** SD가 발을 딛는 줄(무대 중심에서 아래로). */
    ground: 232,
    /** 정예 하나의 SD 높이. 물량형 대표 얼굴은 `crowdSd`로 조금 작게 선다. */
    sd: 270, crowdSd: 222,
    /** 정예 셋의 가로 간격 · 가운데가 한 걸음 앞으로 나서는 거리(편성의 2번 자리). */
    slotX: 292, frontLift: 40,
    /** 물량형 다섯의 가로 간격 · 홀짝으로 엇갈려 서는 깊이. */
    crowdX: 156, crowdLift: 52,
    /** 좌우 넘김 화살표 — 무대 가장자리 안쪽에 선다. */
    arrow: { inset: 36, size: 64 },
    /** 이만큼 밀어야 단계가 넘어간다. */
    swipe: 70,
  },
  /** 난이도 번호 줄. 고른 칸은 한 뼘 커지고 테마 색으로 찬다. */
  strip: { titleY: 1100, y: 1190, chipWidth: 80, chipHeight: 96, gap: 10, selectedScale: 1.12 },
  /**
   * 고른 단계의 **적 전투력 · 보상** 판. 두 이름표는 판 윗변에 걸터앉는 제목표다(`addSectionTitle`).
   */
  summary: {
    y: 1372, width: 920, height: 136, titleGap: 24,
    /** 적 속성 뱃지 — 적 전투력 줄의 오른쪽 끝(가르는 선 앞)에서 왼쪽으로 늘어선다. */
    element: { size: 38, step: 42, rightInset: 24 },
  },
  action: { y: 1590, width: 400, height: 116, gap: 32 },
} as const;

/** 무대의 위아래 끝. */
export function dungeonStageBounds(): { top: number; bottom: number } {
  const { y, height } = DUNGEON_LOBBY.stage;
  return { top: y - height / 2, bottom: y + height / 2 };
}

/** 난이도 칸 `index`의 중심 x — `count`칸이 화면 가운데를 기준으로 선다. */
export function dungeonStripChipX(index: number, count: number): number {
  const { chipWidth, gap } = DUNGEON_LOBBY.strip;
  const span = count * chipWidth + Math.max(0, count - 1) * gap;
  return BASE_WIDTH / 2 - span / 2 + chipWidth / 2 + index * (chipWidth + gap);
}

/** 난이도 줄의 위아래 끝(고른 칸이 커진 몫까지). */
export function dungeonStripBounds(): { top: number; bottom: number } {
  const { y, chipHeight, selectedScale } = DUNGEON_LOBBY.strip;
  return { top: y - (chipHeight * selectedScale) / 2, bottom: y + (chipHeight * selectedScale) / 2 };
}

/**
 * 무대 위 적 `index`의 자리(무대 중심 기준). 정예 셋은 가운데가 한 걸음 앞으로, 물량형 다섯은
 * 홀짝으로 엇갈려 선다 — 한 줄로 늘어서면 떼가 아니라 줄 선 다섯으로 읽힌다.
 */
export function dungeonLineupSpot(index: number, count: number): { x: number; ground: number; crowd: boolean } {
  const S = DUNGEON_LOBBY.stage;
  const crowd = count > 3;
  const step = crowd ? S.crowdX : S.slotX;
  const x = (index - (count - 1) / 2) * step;
  if (crowd) return { x, ground: S.ground - (index % 2 === 1 ? S.crowdLift : 0), crowd };
  const center = (count - 1) / 2;
  return { x, ground: S.ground + (index === center ? S.frontLift : 0), crowd };
}

/** 요약 판의 윗변. */
export function dungeonSummaryTop(): number {
  return DUNGEON_LOBBY.summary.y - DUNGEON_LOBBY.summary.height / 2;
}

/** 요약 판의 제목표가 솟는 끝. 제목표(글자 34 → 높이 52)가 윗변 4px 위에 걸터앉는다. */
export function dungeonSummaryTitleTop(): number {
  return dungeonSummaryTop() - 4 - Math.round(34 * 1.52) / 2;
}

/** 조작 버튼 `index`의 중심 x(0 = 출격, 1 = 소탕). */
export function dungeonActionButtonX(index: number): number {
  const { width, gap } = DUNGEON_LOBBY.action;
  const span = 2 * width + gap;
  return BASE_WIDTH / 2 - span / 2 + width / 2 + index * (width + gap);
}

/** 조작 줄 밑변이 우하단 뒤로가기 윗변보다 위인가. */
export function dungeonActionFitsAboveBackButton(): boolean {
  const bottom = DUNGEON_LOBBY.action.y + DUNGEON_LOBBY.action.height / 2;
  return bottom <= BACK_SLOT.y - BACK_BUTTON_SIZE / 2 && bottom <= BASE_HEIGHT;
}
