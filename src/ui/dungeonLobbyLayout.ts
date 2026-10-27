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
    /** 정예 하나의 SD 높이. */
    sd: 270,
    /** 정예 셋의 가로 간격 · 가운데가 한 걸음 앞으로 나서는 거리(편성의 2번 자리). */
    slotX: 292, frontLift: 40,
    /**
     * 물량형(대작전)은 **몰려오는 수 그대로** 바글바글 선다 — 앞줄 다섯(이름줄·표식을 단 대표 얼굴)
     * 뒤로 나머지가 두 줄로 엇갈려 쌓인다. 뒷줄일수록 작고 높이 선다(멀리 선 것으로 읽힌다).
     */
    crowd: {
      front: { count: 5, step: 156, ground: 232, sd: 206 },
      rows: [
        { step: 150, ground: 128, sd: 178 },
        { step: 146, ground: 40, sd: 156 },
      ],
    },
    /**
     * 좌우 넘김 화살표 — 무대 **바깥** 여백에 선다(`outset`은 무대 가장자리에서 화살표 중심까지).
     * 무대 안쪽에 두던 때는 양 끝 적의 직군 아이콘·돌파 등급에 걸쳤다.
     */
    arrow: { outset: 30, size: 64 },
    /** 이만큼 밀어야 단계가 넘어간다. */
    swipe: 70,
    /** 이만큼 안에서 뗀 손은 밀기가 아니라 누름이다 — 그 적의 정보창을 연다. 사이 구간은 아무 일도 없다. */
    tapSlop: 24,
  },
  /** 난이도 번호 줄. 고른 칸은 한 뼘 커지고 테마 색으로 찬다. */
  strip: { titleY: 1100, y: 1190, chipWidth: 80, chipHeight: 96, gap: 10, selectedScale: 1.12 },
  /**
   * 고른 단계의 **적 전투력 · 보상** 카드 둘. 판 하나에 제목표를 걸쳐 두던 때는 두 정보가 한 덩어리로
   * 읽혔다 — 지금은 카드가 갈리고, 머리 띠가 테마 색으로 물들어 어느 입구인지를 함께 말한다.
   */
  summary: {
    y: 1357, height: 170, header: 44, bevel: 22, gap: 20,
    /** 왼쪽 적 전투력 카드 · 오른쪽 보상 카드의 폭. 둘과 틈의 합이 화면 가운데에 선다. */
    powerWidth: 620, rewardWidth: 300,
    /** 적 속성 뱃지 — 전투력 카드 오른쪽 끝에서 왼쪽으로 늘어선다. */
    element: { size: 42, step: 46, rightInset: 30 },
    reward: { icon: 88 },
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

/** 무대 위 적 한 몸의 자리(무대 중심 기준) · SD 높이 · 이름줄과 표식을 다는지. */
export interface DungeonLineupSpot {
  x: number;
  ground: number;
  height: number;
  crowd: boolean;
  /** 이름줄·속성·전투력을 다는 대표 얼굴인가. 물량형은 앞줄만 단다. */
  labeled: boolean;
}

/**
 * 무대 위 적 `index`의 자리. 정예 셋은 가운데가 한 걸음 앞으로 선다. 물량형은 앞줄 다섯 뒤로
 * 나머지를 두 줄로 나눠, 줄마다 반 칸씩 엇갈려 쌓는다 — 한 줄로 늘어서면 떼가 아니라 줄 선 다섯이다.
 */
export function dungeonLineupSpot(index: number, count: number): DungeonLineupSpot {
  const S = DUNGEON_LOBBY.stage;
  if (count <= 3) {
    const center = (count - 1) / 2;
    return { x: (index - center) * S.slotX, ground: S.ground + (index === center ? S.frontLift : 0), height: S.sd, crowd: false, labeled: true };
  }
  const { front, rows } = S.crowd;
  const frontCount = Math.min(front.count, count);
  if (index < frontCount) {
    return { x: (index - (frontCount - 1) / 2) * front.step, ground: front.ground, height: front.sd, crowd: true, labeled: true };
  }
  // 남은 몸은 가운데 줄이 먼저(올림) 채우고 맨 뒷줄이 나머지를 갖는다.
  const rest = count - frontCount;
  const midCount = Math.ceil(rest / 2);
  const back = index - frontCount >= midCount;
  const row = rows[back ? 1 : 0];
  const rowCount = back ? rest - midCount : midCount;
  const at = back ? index - frontCount - midCount : index - frontCount;
  // 앞줄 사이 틈을 메우도록 줄마다 반 칸씩 비낀다.
  const shift = (back ? -0.25 : 0.25) * row.step;
  return { x: (at - (rowCount - 1) / 2) * row.step + shift, ground: row.ground, height: row.sd, crowd: true, labeled: false };
}

/** 요약 카드의 윗변. */
export function dungeonSummaryTop(): number {
  return DUNGEON_LOBBY.summary.y - DUNGEON_LOBBY.summary.height / 2;
}

/** 요약 카드 `index`(0 = 적 전투력, 1 = 보상)의 중심 x와 폭. */
export function dungeonSummaryCard(index: 0 | 1): { x: number; width: number } {
  const { powerWidth, rewardWidth, gap } = DUNGEON_LOBBY.summary;
  const left = BASE_WIDTH / 2 - (powerWidth + gap + rewardWidth) / 2;
  return index === 0
    ? { x: left + powerWidth / 2, width: powerWidth }
    : { x: left + powerWidth + gap + rewardWidth / 2, width: rewardWidth };
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
