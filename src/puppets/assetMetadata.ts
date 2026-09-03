import type { PuppetAsset } from "./assets";

/**
 * 1번 토리카(트리케라톱스) 전신. 다른 원화보다 등신이 낮아 카드에서는 확대를 줄여 얼굴 크기를 맞춘다.
 */
export const TORIKA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 95, top: 69, right: 894, bottom: 1419 },
  cardZoom: 0.82,
};

/**
 * 2번 렉시아(티라노사우루스) 전신.
 *
 * content가 1번 토리카 값을 그대로 옮겨 온 것이었다. 왼쪽으로 크게 뻗은 낫 무기가 실제 alpha
 * 경계 밖으로 잘려 있어, 카드·정보창 배율이 무기 없는 좁은 폭 기준으로 계산되며 실제보다
 * 확대되어 보였다. ZIP 안 WebP의 alpha > 16 실제 경계로 다시 측정했다.
 */
export const LEXIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 15, top: 43, right: 1038, bottom: 1455 },
  /*
   * 카드 배율은 `content` **폭**으로 정해지는데, 렉시아는 낫 무기가 좌우로 크게 뻗어 그 폭이
   * 캔버스를 거의 다 차지한다(1023 / 1054). 몸은 그만큼 넓지 않으므로 혼자 축소되어 얼굴이
   * 다른 카드보다 한참 작아 보였다 — 눈 사이 거리로 재면 여섯 종 중앙값의 72%였다.
   *
   * 게다가 배율을 정한 그 무기는 **정작 잘라내기에서 버려진다.** 카드 크롭은 머리 관절 기준
   * 327~899이고 무기는 15~327에 있어 화면에 나오지도 않는다. 그래서 개체별 보정이 맞다 —
   * 무기가 화면 밖으로 나가는 만큼만 되돌린다. 값은 눈대중이 아니라 중앙값에 맞춰 계산했고
   * (49.0 ÷ 35.4 ≒ 1.38), `tests/unit/puppetAnchors.test.ts`의 "카드 얼굴 크기"가 지킨다.
   */
  cardZoom: 1.38,
};

/**
 * 3번 스피나(스피노사우루스) 전신.
 *
 * content가 잘리지 않은 원본 캔버스 그대로였던 탓에 카드에서 실루엣이 실제보다 작고 왼쪽으로
 * 치우쳐 보였다. ZIP 안 WebP의 alpha > 16 실제 경계로 다시 측정했다.
 */
export const SEIRA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1085,
  imageHeight: 1450,
  content: { left: 273, top: 82, right: 950, bottom: 1450 },
  // 뒷머리 뾰족 장식이 오른쪽으로 쏠려 카드 홈의 오른쪽 대각선 모서리에 걸렸다.
  cardHeadEscape: { right: 0.12 },
};

/** 4번 루카(벨로키랍토르) 전신. 넓은 후드와 꼬리까지 포함한 전용 원화다. */
export const LUKA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1728,
  imageHeight: 2446,
  // 원화의 후드·손·발·꼬리를 모두 포함한 가시 영역으로 발 높이와 화면 확대를 맞춘다.
  content: { left: 52, top: 44, right: 1683, bottom: 2404 },
  // 코어 관절이 다른 원화보다 아래에 박혀 있어 정보창에서 혼자 내려앉아 보인다.
  portraitOffsetY: -34,
};

/** 7번 스테라(게오스테른베르기아) 전신. */
export const STELLA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 23, top: 37, right: 1007, bottom: 1503 },
};

/**
 * 8번 티아(이크티오사우루스) 전신.
 *
 * 반투명한 지느러미 베일이 좌우로 넓게 펼쳐져 실루엣 폭이 캔버스를 거의 다 차지한다(1051 /
 * 1086). 카드 배율은 그 폭으로 정해지는데 베일은 정작 카드 잘라내기 밖으로 나가므로, 렉시아와
 * 같은 이유로 얼굴만 다른 카드보다 작아진다(중앙값의 0.89배). 베일이 화면 밖으로 나가는
 * 만큼만 되돌려 중앙값에 맞췄고, `tests/unit/puppetAnchors.test.ts`의 "카드 얼굴 크기"가 지킨다.
 */
export const TIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 25, top: 21, right: 1076, bottom: 1425 },
  cardZoom: 1.12,
};

/**
 * 9번 메론(메갈로돈) 전신.
 *
 * 후드와 꼬리가 오른쪽으로 크게 뻗어 실루엣이 넓지만, 캔버스 왼쪽 186px은 통째로 비어 있다.
 * 실측 경계를 그대로 적어 두면 배율이 그림 폭을 따라가고 얼굴도 다른 카드와 같은 크기로 선다.
 */
export const MERON_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 186, top: 10, right: 1031, bottom: 1440 },
};

/** 메론 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const MERON_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 197, top: 13, right: 1057, bottom: 1241 },
};

/** 티아 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const TIA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 98, top: 38, right: 1156, bottom: 1216 },
};

/** 도디 전신·SD ZIP의 원본 크기와 alpha > 16인 실제 실루엣 경계다. */
export const DODI_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 100, top: 76, right: 986, bottom: 1352 },
  // 오른쪽으로 뻗은 머리 깃털이 카드에서 대칭 홈의 오른쪽 대각선 모서리에 애매하게 걸렸다.
  cardHeadEscape: { right: 0.08 },
};

export const DODI_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 121, top: 72, right: 1088, bottom: 1207 },
};

/** 메테 전신·SD ZIP의 원본 크기와 alpha > 16인 실제 실루엣 경계다. */
export const METTE_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 67, top: 43, right: 1003, bottom: 1463 },
  // 왼쪽으로 처진 후드 장식이 카드에서 대칭 홈의 왼쪽 대각선 모서리에 잘렸다.
  cardHeadEscape: { left: 0.12 },
};

export const METTE_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 106, top: 80, right: 1099, bottom: 1207 },
};

/**
 * 폰토스 ZIP을 정적으로 검사한 렌더링 메타데이터다.
 *
 * 브라우저 전용 Phaser 런타임을 불러오지 않아도 단위 테스트가 원본 크기와 alpha > 16 경계를
 * 검증할 수 있도록 URL과 분리한다. 좌표는 두 ZIP 안 WebP의 원본 픽셀 좌표계다.
 */
export const PONTOS_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  // alpha > 16 원본과 idle 0~1.6초를 10ms 간격으로 샘플링한 Mesh의 union이다.
  content: { left: -1, top: 3, right: 1024, bottom: 1589 },
  // 이미지 캔버스가 아니라 위 union의 머리·꼬리 끝으로 계산해 기존보다 확대·상향한다.
  portraitZoom: 0.94,
  portraitOffsetY: -72,
};

/** 폰토스 SD ZIP의 1254px 정사각 원본과 alpha > 16 경계다. */
export const PONTOS_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 32, top: 25, right: 1218, bottom: 1238 },
};
