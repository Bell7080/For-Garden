import type { PuppetAsset } from "./assets";

/**
 * 20번 네 ZIP은 WebP 원본 좌표계에서 alpha > 16을 순회해 경계와 관절을 함께 실측했다.
 * SD 프로젝트에는 눈 관절이 없으므로 임의 얼굴 좌표를 만들지 않고 `eyes: null`로 기록한다.
 */
export const DIAN_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 16, top: 25, right: 1069, bottom: 1422 },
  joints: { center: [561, 468], head: [593, 360], eyes: [[550, 328], [630, 372]], feet: [[380, 1567], [571, 1394]] },
};

/** 디안 SD: 중심1·머리1·발1·발2를 프로젝트에서 읽었으며 눈 관절은 없다. */
export const DIAN_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 23, top: 83, right: 1237, bottom: 1184 },
  joints: { center: [649, 653], head: [688, 531], eyes: null, feet: [[760, 1162], [535, 1171]] },
};

/** 검은 털 소환수 쿠로 SD의 독립 실측값이다. */
export const KURO_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 87, top: 124, right: 1166, bottom: 1129 },
  joints: { center: [533, 729], head: [446, 577], eyes: null, feet: [[882, 1080], [694, 1056]] },
};

/** 흰 털 소환수 시로 SD의 독립 실측값이다. */
export const SHIRO_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 58, top: 89, right: 1195, bottom: 1165 },
  joints: { center: [533, 729], head: [364, 588], eyes: null, feet: [[820, 1110], [630, 1059]] },
};

/**
 * 1번 토리카(트리케라톱스) 전신. 다른 원화보다 등신이 낮아 카드에서는 확대를 줄여 얼굴 크기를 맞춘다.
 */
export const TORIKA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 95, top: 69, right: 894, bottom: 1419 },
  cardZoom: 0.82,
  /** 로비 세로 비율: 메론 기준. 1.26 m — 등신이 낮아 상자에 맞추면 혼자 가장 크게 섰다. */
  lobbyZoom: 0.903,
};

/**
 * 토리카 skin001 전신을 ZIP의 원본 텍스처 좌표계(왼쪽 위 0,0)에서 별도로 측정한 값이다.
 *
 * alpha > 16 경계는 178,23–972,1491이고, 관절은 중심1(467,454)·머리1(527,335)·
 * 눈1(472,312)·눈2(558,344)다. 기본 토리카 값을 복사하지 않고 같은 화면에서 나란히 비교했다.
 * `cardZoom` 0.792는 눈 간격의 카드 표시 크기를 기본 외형과 맞추고, `lobbyZoom` 0.834는 같은
 * 1.26 m 토리카의 눈–발끝 표시 길이를 맞춘다. 높은 중심 관절은 정보창 얼굴을 278px 내리므로
 * `portraitOffsetY`로 되돌린다. 머리 장식은 대칭 카드 홈 안에 들어 `cardHeadEscape`는 불필요하다.
 */
export const TORIKA_SKIN_001_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 178, top: 23, right: 972, bottom: 1491 },
  cardZoom: 0.792,
  lobbyZoom: 0.834,
  portraitOffsetY: -278,
};

/**
 * 토리카 skin001 SD의 원본 텍스처 좌표 측정값이다. alpha > 16 발끝은 y=1225이고,
 * 중심1(509,656)·머리1(621,508)을 함께 기록해 전투 배치가 기본 SD 메타데이터에 기대지 않는다.
 */
export const TORIKA_SKIN_001_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 189, top: 28, right: 1064, bottom: 1225 },
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
  /** 로비 세로 비율: 메론 기준. 1.63 m. */
  lobbyZoom: 1.002,
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
  /** 로비 세로 비율: 메론 기준. 1.74 m. */
  lobbyZoom: 1.018,
};

/** 4번 루카(벨로키랍토르) 전신. 넓은 후드와 꼬리까지 포함한 전용 원화다. */
export const LUKA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1728,
  imageHeight: 2446,
  // 원화의 후드·손·발·꼬리를 모두 포함한 가시 영역으로 발 높이와 화면 확대를 맞춘다.
  content: { left: 52, top: 44, right: 1683, bottom: 2404 },
  // 코어 관절이 다른 원화보다 아래에 박혀 있어 정보창에서 혼자 내려앉아 보인다.
  portraitOffsetY: -34,
  /** 로비 세로 비율: 메론 기준. 1.62 m. */
  lobbyZoom: 0.999,
};

/** 7번 스테라(게오스테른베르기아) 전신. */
export const STELLA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 23, top: 37, right: 1007, bottom: 1503 },
  /** 로비 세로 비율: 메론 기준. 1.42 m. */
  lobbyZoom: 0.965,
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
  /** 로비 세로 비율: 메론 기준. 1.31 m. */
  lobbyZoom: 0.851,
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
  // 코어 관절이 가시 영역의 25% 지점에 박혀 있어(다른 원화는 28~35%) 정보창에서 혼자 내려앉는다.
  portraitOffsetY: -50,
  // 로비 세로 비율의 기준(1.58 m)이라 보정이 없다. 다른 원화의 `lobbyZoom`이 이 크기를 향한다.
};

/** 메론 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const MERON_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 197, top: 13, right: 1057, bottom: 1241 },
};

/** 파치 전신 ZIP의 원본 크기와 alpha > 16 경계다. */
export const PACHI_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 88, top: 8, right: 1009, bottom: 1515 },
  // 배트를 어깨에 걸친 자세라 코어가 가시 영역의 19% 지점까지 올라와 있어 더 크게 올린다.
  portraitOffsetY: -110,
  /** 로비 세로 비율: 메론 기준. 1.55 m. */
  lobbyZoom: 0.924,
};

/** 파치 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const PACHI_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 155, top: 12, right: 1098, bottom: 1242 },
};

/** 마키 전신 ZIP의 원본 크기와 alpha > 16 경계다. */
export const MAKI_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1085,
  imageHeight: 1449,
  content: { left: 31, top: 65, right: 1073, bottom: 1392 },
  /** 로비 세로 비율: 메론 기준. 1.62 m. */
  lobbyZoom: 1.048,
};

/** 마키 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const MAKI_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 61, top: 52, right: 1194, bottom: 1203 },
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
  /** 로비 세로 비율: 메론 기준. 토리카 원화와 같은 등신이다. */
  lobbyZoom: 0.729,
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
  /** 로비 세로 비율: 메론 기준. 1.76 m — 가장 크다. */
  lobbyZoom: 1.089,
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

/**
 * 12번 케리스(메갈로케로스) 전신.
 *
 * ZIP 안 WebP의 alpha > 16 경계를 원본 좌표계에서 직접 측정했다. 발 관절(`발2`)이 캔버스
 * 아래(y=1623 / 높이 1536) 밖에 박혀 있어 바닥선은 관절이 아니라 이 `content.bottom`이 잡는다.
 */
export const KERIS_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 77, top: 35, right: 926, bottom: 1491 },
  /** 로비 세로 비율: 메론 기준. 1.62 m. */
  lobbyZoom: 1.079,
};

/** 케리스 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const KERIS_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 102, top: 61, right: 1100, bottom: 1201 },
};

/** 13번 델로피(딜로포사우루스) 전신. ZIP 안 WebP의 alpha > 16 경계를 실측한 값이다. */
export const DELOPI_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 42, top: 27, right: 1062, bottom: 1426 },
  /*
   * 렉시아의 낫과 같은 이유의 보정이다. 카드 배율은 `content` **폭**으로 정해지는데, 델로피는
   * 양옆으로 뿌린 카드가 캔버스를 거의 다 채운다(1020 / 1086). 몸은 그만큼 넓지 않으므로 혼자
   * 축소되어 얼굴이 다른 카드의 70%로 앉았다.
   *
   * 값을 더 키우지 않는 이유는 등신이 낮아 머리가 크기 때문이다. 1.25를 넘으면 머리 위 여백이
   * 자르기 높이의 0.42를 넘어 `MAX_HEAD_DROP_RATIO`(0.46)에 바짝 붙고, 1.35에서는 남은 여백이
   * 3px까지 줄어 정수리가 홈 윗변에 닿는다. 1.2는 얼굴이 중앙값의 84%이면서 머리 드롭이
   * 0.403이라 한계와 여유가 남는 자리이고, `tests/unit/puppetAnchors.test.ts`가 그 둘을 함께 지킨다.
   */
  cardZoom: 1.2,
  /** 로비 세로 비율: 메론 기준. 1.45 m. */
  lobbyZoom: 0.95,
};

/** 델로피 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const DELOPI_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 184, top: 55, right: 1153, bottom: 1207 },
};

/**
 * 14번 노도니아(프테라노돈) 전신. ZIP 안 WebP의 alpha > 16 경계를 실측한 값이다.
 *
 * **눈 위로 베일 끝이 320px 솟아 있다**(전체 높이의 21%). 로비 배율은 눈에서 발끝까지가
 * 키에 비례하도록 잡으므로, 머리 위 몫이 큰 원화일수록 그림 전체는 그만큼 더 커진다 —
 * 1.70 m로 적으면 화면 높이를 41px 넘겨 베일 끝이 상단에서 잘린다. 1.66 m가 지금 로비
 * 규격에서 이 원화가 온전히 서는 가장 큰 키다.
 */
export const NODONIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 13, top: 14, right: 1011, bottom: 1521 },
  /**
   * 베일과 펼친 날개가 캔버스를 거의 다 채워(998 / 1024) 카드 배율이 그 폭으로 정해지는 바람에
   * 얼굴만 중앙값의 0.56배까지 줄었다 — 렉시아의 낫과 같은 함정이다. 게다가 이 원화는 얼굴
   * 자체도 작게 그려져 있어(눈 간격 51px, 엘라 74px) 되돌릴 폭이 더 크다.
   */
  /**
   * 카드 배율은 `cardZoom × portraitZoom`의 곱으로 정해진다. 정보창에서 되돌린 몫이 카드에도
   * 함께 들어오므로, 카드에서 실제로 쓰는 배율(1.5)이 되도록 여기서 나눠 둔다 — 정보창 배율을
   * 고치면 이 값도 함께 고쳐야 카드가 따라 움직이지 않는다.
   */
  cardZoom: 1.24,
  /**
   * 정보창 전신 배율.
   *
   * **크기의 기준은 얼굴이 아니라 몸이다.** 이 원화는 얼굴이 혼자 작아(눈 간격 51px, 중앙값
   * 85px) 얼굴을 중앙값에 맞추려 1.55 → 1.45까지 올려 봤지만, 그러면 실루엣 폭이 1748px가
   * 되어 다른 개체(901~1429px)를 통째로 넘고 발끝이 화면 아래로 958px 나갔다 — 화면에서
   * 읽히는 크기는 얼굴이 아니라 **판을 채우는 몸**이라 "너무 확대됐다"로 보인다.
   * 1.21은 두 규칙이 정확히 만나는 자리다 — 얼굴이 중앙값의 0.70배(하한)이고 실루엣 폭이
   * 1458px으로 가장 넓은 개체(마키 1429px)의 1.02배다. 더 올리면 몸이 띠를 벗어나고 더
   * 내리면 얼굴이 하한 아래로 떨어진다.
   * 얼굴이 작은 것은 원화가 그렇게 그려졌기 때문이라 배율로 덮지 않는다 — 되돌리려면
   * 아트를 다시 굽는다.
   */
  portraitZoom: 1.21,
  /**
   * 카드는 베일 끝을 자른다. 실루엣 폭의 15%(150px)를 처음 넘는 행이 236이라, 그 위는 몇
   * 픽셀짜리 뾰족한 끝이라 잘려도 단면이 보이지 않는다. 로비 전신은 이 값을 쓰지 않는다.
   */
  cardTop: 236,
  /** 로비 세로 비율: 메론 기준. 1.66 m. */
  lobbyZoom: 1.106,
};

/** 노도니아 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const NODONIA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 164, top: 27, right: 1125, bottom: 1225 },
};

/** 15번 엘라(코엘로돈타) 전신. ZIP 안 WebP의 alpha > 16 경계를 실측한 값이다. */
export const ELLA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1122,
  imageHeight: 1402,
  content: { left: 85, top: 2, right: 1054, bottom: 1363 },
  /**
   * 정보창에서 혼자 내려앉아 보이는 몫.
   *
   * 이 원화는 뿔과 머리채가 정수리 위로 길게 솟아 있어, 코어 관절을 다른 개체와 같은 자리에
   * 두면 머리 끝은 나란한데 **얼굴만 50px 아래**에 선다(눈 809px, 중앙값 757px). 얼굴이
   * 판의 절반 아래로 내려가면 인물이 뒤로 가라앉은 것처럼 보인다. 배율은 이미 중앙값
   * (얼굴 102px, 중앙값 107px)이라 `portraitZoom`으로 덮지 않고 자리만 올린다.
   */
  portraitOffsetY: -50,
  /** 로비 세로 비율: 메론 기준. 1.56 m. */
  lobbyZoom: 1.019,
};

/** 엘라 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const ELLA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 138, top: 7, right: 1116, bottom: 1247 },
};

/** 16번 데이(데이노니쿠스) 전신. ZIP 안 WebP의 alpha > 16 경계를 실측한 값이다. */
export const DEINA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1085,
  imageHeight: 1450,
  content: { left: 57, top: 45, right: 1053, bottom: 1395 },
  /*
   * **렉시아와 같은 함정이다.** 카드 배율은 `content` **폭**으로 정해지는데, 이 원화는 왼쪽으로
   * 내민 스프레이 캔과 오른쪽으로 크게 휘는 깃털 꼬리가 캔버스를 거의 다 차지한다(996 / 1085).
   * 몸은 그만큼 넓지 않으므로 혼자 축소되어 얼굴이 다른 카드의 68%까지 작아졌다.
   *
   * 그리고 그 폭을 만든 캔과 꼬리는 **정작 잘라내기에서 버려진다** — 카드 크롭은 머리 관절
   * 기준이라 화면에 나오지도 않는다. 그래서 개체별 보정이 맞다. 값은 눈대중이 아니라
   * `tests/unit/puppetAnchors.test.ts`의 "카드 얼굴 크기" 중앙값에 맞춰 구했다(0.99배).
   */
  cardZoom: 1.45,
  /** 로비 세로 비율: 메론 기준. 1.66 m. */
  lobbyZoom: 1.013,
};

/** 데이 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const DEINA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 222, top: 67, right: 1125, bottom: 1190 },
};

/**
 * 17번 매디(매머드) 전신. ZIP 안 WebP의 alpha > 16 경계를 실측한 값이다.
 *
 * 거대한 모피 코트가 실루엣 폭을 넓게 채워(982 / 1086) 렉시아의 낫과 같은 함정에 걸린다 —
 * 카드·정보창 배율이 `content` **폭**으로 정해지는데, 모피는 몸 넓이만큼 있지 않아 얼굴이
 * 중앙값보다 작게 앉는다. `cardZoom`은 카드 얼굴 크기 회귀 테스트의 중앙값에 맞춰 구했다.
 * `portraitZoom`은 얼굴 하한(도디가 밀려 1.45를 넘지 않는 범위)과 실루엣 폭 상한(다른
 * 개체의 105%를 넘지 않는 범위)이 겹치는 좁은 구간(1.188~1.192) 안에서 골랐다.
 */
export const MADDY_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 37, top: 29, right: 1019, bottom: 1421 },
  cardZoom: 1.2,
  portraitZoom: 1.19,
  /** 로비 세로 비율: 메론 기준. 1.52 m. */
  lobbyZoom: 0.932,
};

/** 매디 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const MADDY_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 240, top: 63, right: 1082, bottom: 1208 },
};

/**
 * 21번 파루아(파라사우롤로푸스) 전신.
 *
 * ZIP 안 WebP의 alpha > 16 경계를 실측한 값이다. 실루엣이 캔버스를 거의 채워(폭 994/1086)
 * 렉시아 같은 폭 보정이 필요 없다.
 */
export const PARUA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 58, top: 12, right: 1052, bottom: 1431 },
  /** 로비 세로 비율: 메론 기준. 1.45 m — 보정 없이 세우면 1.459 m로 서므로 살짝 줄인다. */
  lobbyZoom: 0.994,
};

/** 파루아 SD ZIP의 정사각 원본과 alpha > 16 경계다. */
export const PARUA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 58, top: 11, right: 1196, bottom: 1244 },
};

/**
 * 18번 슈테(스테고사우루스) 전신.
 *
 * ZIP 안 WebP의 alpha > 16 경계를 실측했다(5,8–1078,1446). 관절도 같은 좌표계에서 읽어
 * 중심1(728,410)·머리1(671,313)·눈1(637,315)·눈2(714,269)이며, 셋 다 alpha 상자 안에 있어
 * 카드·로비 배율이 그림 밖 관절에 기대지 않는다.
 *
 * 앉아 있는 포즈라 실루엣이 캔버스를 거의 채우지만(폭 1073/1087), 눈에서 발끝까지가 여전히
 * 그림 높이의 80%라 다른 전신과 같은 방법으로 잰다.
 */
export const SHUTE_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1087,
  imageHeight: 1447,
  content: { left: 5, top: 8, right: 1078, bottom: 1446 },
  /** 로비 세로 비율: 메론 기준. 1.46 m. */
  lobbyZoom: 0.953,
};

/** 슈테 SD ZIP의 정사각 원본과 alpha > 16 경계다. 중심1(656,640)·머리1(589,501)을 함께 읽었다. */
export const SHUTE_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 31, top: 18, right: 1222, bottom: 1235 },
};
