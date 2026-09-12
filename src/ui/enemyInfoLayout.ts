import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";

/**
 * 적 정보 팝업의 **순수 배치표**.
 *
 * 적은 유대도 급여도 룬도 없어 읽을 것이 아군의 절반이다. 그 절반을 화면 한 장(정보창 씬)에
 * 펼치면 판 넷 중 둘이 비어 "여기 뭔가 빠졌다"로 읽혔다 — 그래서 적만은 **출격 선택판만 한
 * 팝업 한 장**에 같은 요소를 모은다.
 *
 * **이것은 정보창을 조금 줄여 놓은 것일 뿐이다.** 배경 원화, 왼쪽 위 등급·이름 블록, 오른쪽
 * 위의 돌파 등급 표식과 돋보기, 기울어진 칸과 그 윗변에 걸터앉는 제목, 칸 안의 레벨·상한·
 * 사거리·오각형, 왼쪽 아래 스킬 액자 줄과 패시브 위의 폭주 뱃지, 오른쪽 아래 SD 받침까지
 * 전부 정보창의 프리팹을 **그대로** 쓴다(`addInfoPanel`·`addInfoMagnifier`·`addInfoFigureStand`).
 * 여기서 정하는 것은 자리뿐이다.
 *
 * Phaser를 모르는 이 표가 자리를 갖는 이유는 화면과 회귀 테스트가 같은 값을 읽어야 하기
 * 때문이다. 좌표는 모두 **팝업 몸판 가운데가 0인 로컬 좌표**다.
 */
export const ENEMY_INFO = {
  /** 출격 선택판(980 × 1240)과 같은 무게의 판. 화면을 다 덮지 않는다. */
  width: 960,
  height: 1240,
  /** 글이 앉는 좌·우 선. 몸판의 깎인 모서리를 피해 안쪽으로 들어온다. */
  left: -392,
  right: 392,
  /**
   * 이름 블록 뒤로 내려오는 어둠.
   *
   * 정보창과 같이 **판때기를 깔지 않는다** — 배경 원화와 전신 원화 위로 검정→투명 그라데이션만
   * 한 겹 덮어, 밝은 원화 앞에서도 등급·이름·개체번호가 읽히게 한다.
   *
   * 시작은 판 윗변이 아니라 **제목표 아래**다. 윗변까지 덮으면 판 위에 걸터앉은 `/정보창`이
   * 그 어둠에 함께 눌려 흐려진다.
   */
  nameFade: { top: -600, height: 300 },
  /** 왼쪽 위 이름 블록 — 정보창과 같은 순서(등급 · 이름 · 개체번호)와 같은 글자 크기다. */
  rarityY: -540,
  nameY: -466,
  numberY: -402,
  /** 이름 오른쪽에 붙는 속성·직군 뱃지. 정보창의 `AFFINITY`와 같은 값이다. */
  badge: { element: 96, role: 72, gap: 30 },
  /**
   * 오른쪽 기둥 — 정보창의 그것을 그대로 줄인 것이다.
   *
   * 두 칸이 같은 x·같은 폭이라 한 벌로 읽히고, 제목은 판 윗변에 걸터앉는다.
   */
  column: { x: 190, width: 404 },
  /** 돌파 등급 표식과 돌파 단계표 돋보기. 정보창과 같이 **레벨 칸 위**에 선다. */
  gradeRow: { x: 300, y: -520, size: 68 },
  gradeMagnifier: { x: 356, y: -512 },
  /** 레벨 칸 — 읽기 전용이라 경험치·급여가 빠진 정보창의 축소 판과 같은 높이다. */
  levelPanel: { top: -430, height: 168 },
  /** 능력치 칸. 오각형 반지름·사거리 줄·돋보기 자리가 모두 정보창과 같은 간격이다. */
  statPanel: { top: -214, height: 450 },
  radar: { radius: 128, offsetY: 40 },
  /**
   * 사거리 한 줄.
   *
   * 정보창과 같이 제목 바로 아래에 회색으로 눕는다 — 늘 떠 있는 자리는 균형이 먼저 읽혀야
   * 하므로 색은 상세 팝업이 맡는다. 칸이 정보창보다 좁아 그 높이 그대로 두면 오각형의 **위 축
   * 이름표**와 부딪히므로 한 뼘만 위로 올린다.
   */
  reach: { offsetX: -160, offsetY: -178 },
  statMagnifier: { offsetY: -148 },
  /**
   * 전신 원화.
   *
   * 정보창과 같이 **크게 세워 종아리쯤에서 판 밑변에 잘린다** — 상자에 맞춰 줄이면 얼굴이
   * 작아져 누구인지보다 여백이 먼저 읽힌다. 코어(`중심1`) 관절을 기준으로 세우고 판과 같은
   * 실루엣으로 잘라 깎인 모서리 밖으로 나가지 않게 한다.
   */
  portrait: { x: -196, coreY: -40, height: 1180 },
  /** 스킬 액자 줄 — 정보창과 같이 **왼쪽 아래**에 서고 크기·간격도 같다. */
  skills: { x: -356, y: 442, size: 150, step: 168 },
  /** 패시브 액자 위에 얹히는 폭주 뱃지. 정보창과 같은 높이 차이를 지킨다. */
  ferocityBadgeOffsetY: -139,
  /** 오른쪽 아래 SD 받침. */
  figure: { x: 258, groundY: 520, height: 200 },
} as const;

/** 오른쪽 칸 하나의 중심 y. 표는 윗변으로 적고 그리는 쪽은 가운데를 쓴다. */
export function enemyInfoPanelCenterY(panel: { top: number; height: number }): number {
  return panel.top + panel.height / 2;
}

/** 스킬 액자 셋이 서는 x. 정보창과 같이 왼쪽 끝에서 같은 간격으로 이어진다. */
export function enemyInfoSkillColumns(count = 3): number[] {
  return Array.from({ length: count }, (_, index) => ENEMY_INFO.skills.x + index * ENEMY_INFO.skills.step);
}

/**
 * 상자 하나가 팝업 몸판 안에 온전히 드는가.
 *
 * 몸판은 왼쪽 위·오른쪽 아래가 짧은 변의 14%만큼 깎여 있어, 네모를 그 대각선 밖에 두면
 * 조용히 판 밖으로 삐져나온다. 스테미나 창이 쓰는 것과 같은 규칙이다.
 */
export function insideEnemyInfoBody(box: { x?: number; y: number; width: number; height: number }): boolean {
  const bevel = Math.min(ENEMY_INFO.width, ENEMY_INFO.height) * POPUP_BODY_BEVEL_RATIO;
  const cx = box.x ?? 0;
  const corners = [
    { x: cx - box.width / 2, y: box.y - box.height / 2 },
    { x: cx + box.width / 2, y: box.y - box.height / 2 },
    { x: cx + box.width / 2, y: box.y + box.height / 2 },
    { x: cx - box.width / 2, y: box.y + box.height / 2 },
  ];
  return corners.every(({ x, y }) => {
    if (Math.abs(x) > ENEMY_INFO.width / 2 || Math.abs(y) > ENEMY_INFO.height / 2) return false;
    if ((x + ENEMY_INFO.width / 2) + (y + ENEMY_INFO.height / 2) < bevel) return false;
    return (ENEMY_INFO.width / 2 - x) + (ENEMY_INFO.height / 2 - y) >= bevel;
  });
}
