/**
 * 레이드 화면의 **순수 배치표** — Phaser를 읽지 않는다.
 *
 * 화면이 좌표를 손으로 적지 않는 이유는 이 판이 위에서부터 보스 · 남은 체력 · 기여 목록 ·
 * 하단 조작으로 쌓이는데, 그 사이를 눈대중으로 잡으면 한 줄이 늘거나 줄 때마다 아래가 전부
 * 어긋나기 때문이다. 간격은 `tests/unit/raidLayout.test.ts`가 지킨다.
 */

import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "./popupGeometry";

/**
 * 보스가 서는 자리.
 *
 * **원정 기록 화면과 같은 문법이다**(`RANKING.boss`) — 발끝을 화면 아래로 내보내고 크게 세워
 * 화면 위쪽에 **상반신만** 남긴다. 상자에 맞춰 줄이면 그 한 마리만 보는 화면인데 얼굴보다
 * 여백이 먼저 읽힌다. 두 화면이 같은 값을 쓰는 이유는 시즌 보스를 세우는 일이 같은 일이기
 * 때문이고, 다르게 적으면 같은 개체가 원정에서는 크고 레이드에서만 작게 선다.
 *
 * 아래 절반은 그리지 않는 것이 아니라 **어둠에 잠긴다**(`fade`) — 자르면 그 선이 가로줄로
 * 보이고, 그대로 두면 기여 목록의 유리 줄 뒤로 다리가 비쳐 목록이 흐려진다. 검정→투명
 * 그라데이션 한 겹이 남은 체력 줄의 배경도 함께 맡는다.
 */
export const RAID_BOSS_SPOT = {
  centerX: BASE_WIDTH / 2,
  groundY: BASE_HEIGHT + 40,
  height: 1720,
  /**
   * 원화가 잠기는 띠. 위는 투명하고 아래로 갈수록 어두워진다.
   *
   * **자르지 않는다.** 예전에는 이 띠의 아랫변에서 마스크가 원화를 끊었는데, 짙게 깔린 띠와
   * 그 선이 겹쳐 **하체가 통째로 잘려 나간 것처럼** 보였다 — 화면 한가운데를 가로로 긋는
   * 선이 하나 더 생긴 셈이다. 지금은 보스가 화면 밑동까지 온전히 서고, 목록과의 분리는
   * 그 위에 깔리는 반투명 판(`RAID_BOARD_PLATE`)이 맡는다.
   */
  fade: { top: 760, bottom: 1216 },
  /**
   * 원화를 누르면 적 정보창이 열리는 자리 — 상반신 둘레만 받는다.
   *
   * 원화 전체를 입력으로 두면 체력 줄·기여 목록 뒤의 다리까지 눌려, 목록을 끌다 창이 뜬다.
   * 머리글 줄과 남은 체력 이름표 사이에서 끝낸다.
   */
  tap: { top: 280, bottom: 940, width: 620 },
} as const;

/** 남은 체력 게이지. 보스 발밑을 지나 화면 폭을 거의 다 쓴다. */
export const RAID_HP_BAR = {
  centerX: BASE_WIDTH / 2,
  y: 1040,
  width: 880,
  height: 46,
  /** 남은 체력을 눈금으로도 셈하게 한다. 한 칸이 전체의 1/8이다. */
  ticks: 7,
  /** 게이지 위의 이름표와 아래의 수치가 앉는 자리. */
  labelY: 992,
  valueY: 1094,
} as const;

/**
 * 기여 목록이 흐르는 창.
 *
 * 순위표와 **같은 줄 규격**(`RANKING_LIST`)을 쓰되 자리만 이 화면에 맞춘다 — 같은 모양의
 * 목록이 화면마다 다른 줄 높이로 서면 같은 정보가 두 양식으로 읽힌다.
 */
/**
 * 기여 목록이 앉는 **반투명 판 한 겹.**
 *
 * 보스를 끊지 않고도 목록을 배경에서 떼어 놓는 방법이다 — 원화는 이 판 아래로 계속 서 있고,
 * 유리면 너머로 비쳐 "그 앞에 목록이 떠 있다"로 읽힌다.
 *
 * **제목표는 판 안이 아니라 윗변에 걸터앉는다**(`RAID_BOARD.titleY`) — 정보창의 칸·팝업 머리글과
 * 같은 문법이다. 판 안쪽에 들여 세우던 때는 같은 위계의 제목이 이 화면에서만 맨 글자처럼 섰다.
 */
export const RAID_BOARD_PLATE = {
  top: 1150,
  bottom: BASE_HEIGHT - 206,
  width: BASE_WIDTH - 56,
} as const;

export const RAID_BOARD = {
  /** 판 윗변에 걸터앉는 제목표의 가운데. 정보창의 칸 제목과 같이 윗변에서 4px 위다. */
  titleY: RAID_BOARD_PLATE.top - 4,
  /** 제목표의 왼쪽 끝 — 판의 왼쪽 변이다. */
  titleX: (BASE_WIDTH - RAID_BOARD_PLATE.width) / 2,
  viewport: { top: 1216, bottom: BASE_HEIGHT - 232 },
  centerX: BASE_WIDTH / 2,
} as const;

/**
 * 하단 조작.
 *
 * **이 줄에 서는 것은 출격 하나뿐이다.** 전리품 상점 입구는 로비 출격판 밖 줄이 이미 갖고
 * 있어, 레이드 화면에도 같은 문을 달아 두면 같은 가게로 들어가는 입구가 둘이 된다 — 증표를
 * 쓰러 가는 길은 한 자리로 충분하다. 그래서 출격이 화면 가운데를 그대로 쓴다.
 *
 * 우하단은 공용 뒤로가기 자리라 그 위를 지나지 않는다.
 */
export const RAID_ACTIONS = {
  y: BASE_HEIGHT - 132,
  sortie: { centerX: BASE_WIDTH / 2, width: 420, height: 124 },
} as const;

/** 출격이 우하단 공용 뒤로가기와 벌린 가로 간격이다. 양수여야 한다. */
export function raidSortieBackGap(): number {
  return (BACK_SLOT.x - BACK_BUTTON_SIZE / 2) - (RAID_ACTIONS.sortie.centerX + RAID_ACTIONS.sortie.width / 2);
}

/**
 * 남은 체력 게이지의 색.
 *
 * 체력 바가 아니라 **깎아 내는 표적**이라 아군 체력의 연두가 아니고, 전장에서 아군이 받는
 * 피해와 같은 붉은 계열이다 — 이 화면에서 그 색이 뜻하는 것은 "여기를 민다"이다.
 */
export const RAID_HP_BAR_COLOR = 0xd2463c;

/** 시즌 머리글 — 제목, 초기화 시각, 남은 도전 횟수. */
export const RAID_HEADER = { titleX: 76, titleY: 132, seasonY: 196, attemptsY: 236 } as const;

/** 목록이 흐르는 창의 높이와 중심. 마스크와 입력면이 같은 값을 쓴다. */
export function raidBoardViewport(): { height: number; centerY: number } {
  const { top, bottom } = RAID_BOARD.viewport;
  return { height: bottom - top, centerY: (top + bottom) / 2 };
}

/**
 * 레이드 목록 — **층이 쌓이는 판**이다(교류 목록과 같은 문법).
 *
 * 맨 위에는 시스템이 하루 한 마리 여는 **월드 폭주**가 한 겹 더 두른 테두리를 달고 크게 서고,
 * 그 아래로 친구와 내가 소환한 레이드가 쌓인다. 층 하나는 **오른쪽이 보스의 얼굴**,
 * **왼쪽이 이름·도전·보상**, **맨 밑이 남은 체력**이다 — 들어가기 전에 "누구이고, 몇 번
 * 남았고, 무엇을 주고, 얼마나 남았나"가 한 장에 선다.
 */
export const RAID_LIST = {
  /**
   * 층이 흐르는 창. 위는 머리글(제목·토벌권) 아래에서, 아래는 **켜진 탭이 솟은 윗변**에서
   * 끝난다 — 그 강조선이 곧 목록의 밑변이라 선 하나로 탭과 목록이 한 덩어리가 된다.
   */
  viewport: { top: 262, bottom: 1606 },
  width: BASE_WIDTH - 92,
  slant: 26,
  /** 층과 층 사이. 윗변에 걸터앉는 제목표(높이 52)의 절반과 월드 폭주의 바깥 테두리가 든다. */
  gap: 58,
  /** 창 윗변에서 첫 층까지 — 첫 층의 제목표와 바깥 테두리가 잘리지 않게 한 뼘 내린다. */
  firstTop: 44,
  /** 월드 폭주만 두르는 바깥 테두리가 층에서 벌어지는 폭(px). */
  worldRing: 12,
  /** 글이 판 왼쪽 변에서 시작하는 여백. */
  padding: 44,
  /**
   * 원화가 서는 자리와 잘라내기.
   *
   * `from`(판 폭 대비)부터 오른쪽 끝까지 얼굴이 채우고, 그 왼쪽 가장자리를 `fade`만큼 녹인다.
   * `crop`은 실루엣 폭 대비 상자 높이라 작을수록 얼굴이 크게 당겨진다.
   */
  art: { from: 0.34, fade: 0.2, crop: 0.46, headX: 0.52, anchorY: 0.36 },
  /**
   * 층의 두 크기. 월드 폭주가 더 두껍게 서서 "오늘의 한 마리"임을 크기가 먼저 말한다.
   * 글줄·보상·체력 줄의 자리는 층 가운데 기준 y다.
   */
  kinds: {
    world: {
      height: 460, nameSize: 58,
      text: { nameY: -146, levelY: -90, attemptsY: -48 },
      reward: { y: 44, size: 92 },
      hp: { up: 44, height: 26, labelUp: 80 },
    },
    summon: {
      height: 360, nameSize: 50,
      text: { nameY: -112, levelY: -62, attemptsY: -24 },
      reward: { y: 46, size: 76 },
      hp: { up: 40, height: 24, labelUp: 76 },
    },
  },
  /** 보상 액자 오른쪽의 두 줄(무엇인가 · 내 기여)과 정산 버튼. 액자 오른쪽 변에서 잰다. */
  rewardText: { gap: 20, labelUp: 18, valueDown: 18 },
  settle: { width: 160, height: 66, fromFrame: 300 },
} as const;

export type RaidLayerKind = keyof typeof RAID_LIST.kinds;

/** 층을 순서대로 쌓았을 때 각 층 가운데의 y(목록 컨테이너 기준)와 목록 전체의 높이. */
export function raidLayerStack(kinds: readonly RaidLayerKind[]): { centers: number[]; height: number } {
  const centers: number[] = [];
  let y = RAID_LIST.viewport.top + RAID_LIST.firstTop;
  kinds.forEach((kind, index) => {
    if (index > 0) y += RAID_LIST.gap;
    const height = RAID_LIST.kinds[kind].height;
    centers.push(y + height / 2);
    y += height;
  });
  return { centers, height: y - RAID_LIST.viewport.top + RAID_LIST.firstTop };
}

/**
 * 목록 화면의 머리와 밑동.
 *
 * **머리 오른쪽은 두 토벌권이다** — 소환을 누르기 전에 몇 장 남았는지가 읽혀야 한다. 수만 적지 않고
 * 그 아이템의 액자에 수량을 겹친다(재화·아이템이 서는 자리의 공용 규칙).
 *
 * **밑동은 탭 → 소환 순으로 쌓인다.** 탭은 목록을 갈아 끼우는 전환 라벨이라 목록 바로 밑에 붙고
 * (`CategoryTab`, 가방·상점과 같은 한 장), 그 아래 소환 줄이 선다. **소환 둘은 같은 크기·같은
 * 양식으로 나란히 선다** — 선택 소환이 왼쪽, 소환이 오른쪽이다. 둘은 같은 손짓(토벌권 한 장)의
 * 두 갈래라 한쪽만 작거나 흐리면 덜 중요한 조작처럼 읽힌다. 그 토벌권이 없으면 그 버튼만
 * 꺼진 채 선다 — 자리를 비우면 버튼이 하나일 때와 둘일 때 줄이 흔들린다. 우하단은 공용
 * 뒤로가기 자리라 소환 줄은 그 왼쪽에서 끝난다.
 */
export const RAID_LIST_CHROME = {
  tickets: { y: 164, size: 88, gap: 22, right: BASE_WIDTH - 60 },
  tabs: { y: 1654, width: 250, height: 76, gap: 14, left: 46 },
  summon: {
    y: BACK_SLOT.y,
    height: 112,
    fontSize: 32,
    /** 선택 소환(왼쪽)과 소환(오른쪽). 폭이 같다. */
    select: { centerX: 252, width: 380 },
    normal: { centerX: 672, width: 380 },
  },
} as const;

/** 소환 줄의 오른쪽 끝이 우하단 공용 뒤로가기와 벌린 가로 간격이다. 양수여야 한다. */
export function raidSummonBackGap(): number {
  const { normal } = RAID_LIST_CHROME.summon;
  return (BACK_SLOT.x - BACK_BUTTON_SIZE / 2) - (normal.centerX + normal.width / 2);
}

/**
 * 난이도의 색.
 *
 * 층의 뒷배경을 **은은하게** 물들이고(`RAID_LIST.tone`), 소환 창의 난이도 버튼과 소환 연출의
 * 파문도 같은 색을 쓴다 — 한 판을 고르는 순간부터 그 판에 들어가기까지 같은 색이 따라와야
 * "지금 어느 난이도인가"가 글자를 읽기 전에 읽힌다. 쉬움에서 폭주로 갈수록 차가운 색에서
 * 뜨거운 색으로 간다. 폭주는 남은 체력 줄과 같은 붉은빛이다.
 */
export const RAID_DIFFICULTY_TONE = {
  easy: 0x3fbf8a,
  normal: 0x4a8fe0,
  hard: 0xa45be0,
  rampage: RAID_HP_BAR_COLOR,
} as const;

/** 층 뒷배경의 물들임 — 글이 서는 왼쪽에서 가장 짙고 얼굴 쪽으로 풀린다. 윗변에 같은 색 선 한 줄. */
export const RAID_LAYER_TONE = { washAlpha: 0.34, washReach: 0.78, edgeAlpha: 0.85, edgeWidth: 4 } as const;

/** 소환자는 층 윗변 오른쪽 위에 회색 글자로 선다 — 왼쪽의 제목표와 같은 줄, 맞은편이다. */
export const RAID_LAYER_OWNER = { up: 20, size: 22 } as const;

/**
 * 소환 연출의 세기 — **어려운 판일수록 오래 모이고 세게 터진다**(뽑기 연출과 같은 규칙).
 * `charge`는 봉인이 모이는 시간(ms), `shake`는 터지는 순간의 흔들림이다.
 */
export const RAID_SUMMON_INTENSITY = {
  easy: { charge: 620, shake: 0.006, shards: 6 },
  normal: { charge: 760, shake: 0.009, shards: 8 },
  hard: { charge: 920, shake: 0.013, shards: 9 },
  rampage: { charge: 920, shake: 0.013, shards: 9 },
} as const;

/** 소환 연출의 자리. 봉인이 서는 가운데와, 드러난 보스 얼굴·이름·난이도 줄. */
export const RAID_SUMMON_STAGE = {
  centerY: 820,
  face: 380,
  nameY: 1110,
  tagY: 1186,
  seal: { radius: 250, squash: 0.44 },
} as const;

/**
 * 선택 소환의 두 창 — **보스를 고르는 층**과 그 위에 겹쳐 뜨는 **난이도 층**이다.
 *
 * 둘 다 목록의 층과 같은 문법(오른쪽을 채운 얼굴 띠, 왼쪽의 글, 윗변에 걸터앉는 제목표)을
 * 쓴다. 버튼 줄이나 얼굴 카드로 세우던 때는 "누구를 부를지"와 "얼마나 세게"가 한 창의 버튼
 * 색으로만 갈렸다 — 층으로 세우면 고르기 전에 얼굴과 그 판의 무게가 먼저 읽힌다.
 *
 * 창의 높이는 층 수에서 거꾸로 구한다(`raidPickHeight`). 층 사이 `gap`에는 다음 층의 제목표가
 * 든다(목록과 같다).
 */
export const RAID_BOSS_PICK = {
  width: 820, height: 280, gap: 62, padding: 44, top: 150, bottom: 70,
  nameY: -54, nameSize: 54,
  /** 이름 아래 속성·직군 — 정보창과 같은 뱃지를 줄여 쓴다. */
  badgeY: 26, badge: { element: 62, role: 48, gap: 18 },
  levelsY: 92,
} as const;

export const RAID_DIFFICULTY_PICK = {
  width: 820, height: 250, gap: 62, padding: 44, top: 150, bottom: 70,
  nameY: -72, nameSize: 44, levelY: -24,
  /** 최대 정산 액자와 그 오른쪽 두 줄(무엇인가 · 보스 체력). */
  reward: { y: 56, size: 84 },
  rewardText: { gap: 18, labelUp: 18, valueDown: 18 },
  /** 난이도 층은 그 색으로 판을 한층 짙게 물들인다 — 이 창에서는 색이 곧 고르는 대상이다. */
  washAlpha: 0.5,
} as const;

/** 층을 쌓는 창의 높이 — 층 수에서 거꾸로 구한다. */
export function raidPickHeight(spec: { height: number; gap: number; top: number; bottom: number }, count: number): number {
  return spec.top + count * spec.height + Math.max(0, count - 1) * spec.gap + spec.bottom;
}

/** 보스를 고르는 창의 높이. */
export function raidBossPickHeight(count: number): number {
  return raidPickHeight(RAID_BOSS_PICK, count);
}
