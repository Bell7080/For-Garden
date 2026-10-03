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

/**
 * 관제 드론 디모(A-Dimo) SD의 독립 실측값이다. alpha > 16 경계와 관절(중심1·머리1·발1·발2)을
 * `charSD_022_dimo.zip`에서 읽었으며 눈 관절은 없다. 날개막이 캔버스 좌우를 거의 채워(1072/1254)
 * 모르페 SD처럼 정사각 원본을 그대로 쓴다.
 */
export const DIMO_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 92, top: 112, right: 1164, bottom: 1141 },
  joints: { center: [566, 703], head: [356, 634], eyes: null, feet: [[597, 835], [724, 879]] },
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
  joints: { center: [603, 711], head: [609, 395], eyes: [[554, 416], [638, 446]], feet: [[353, 1376], [686, 1403]] },
  /** 로비 세로 비율: 메론 기준. 1.26 m — 등신이 낮아 상자에 맞추면 혼자 가장 크게 섰다. */
  lobbyZoom: 0.903,
};

/**
 * 토리카 skin001 전신을 ZIP의 원본 텍스처 좌표계(왼쪽 위 0,0)에서 별도로 측정한 값이다.
 *
 * alpha > 16 경계는 178,23–972,1491이고, 관절은 중심1(467,454)·머리1(527,335)·
 * 눈1(472,312)·눈2(558,344)다. 기본 토리카 값을 복사하지 않고 같은 화면에서 나란히 비교했다.
 * `lobbyZoom` 0.834는 같은 1.26 m 토리카의 눈–발끝 표시 길이를 맞춘다. 카드·정보창의 얼굴
 * 크기와 눈높이는 공용 얼굴 규격(`FACE_STANDARD`)이 두 눈 관절에서 정한다. 머리 장식은 대칭 카드
 * 홈 안에 들어 `cardHeadEscape`는 불필요하다.
 */
export const TORIKA_SKIN_001_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 178, top: 23, right: 972, bottom: 1491 },
  joints: { center: [467, 454], head: [527, 335], eyes: [[472, 312], [558, 344]], feet: [[723, 1381], [403, 1474]] },
  lobbyZoom: 0.834,
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
  joints: { center: [629, 396], head: [613, 265], eyes: [[582, 265], [643, 236]], feet: [[498, 1426], [788, 1448]] },
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
  joints: { center: [495, 557], head: [572, 250], eyes: [[544, 239], [597, 208]], feet: [[497, 1402], [649, 1438]] },
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
  joints: { center: [843, 639], head: [882, 419], eyes: [[832, 425], [960, 368]], feet: [[593, 1435], [446, 2336]] },
  /** 로비 세로 비율: 메론 기준. 1.62 m. */
  lobbyZoom: 0.999,
};

/** 7번 스테라(게오스테른베르기아) 전신. */
export const STELLA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 23, top: 37, right: 1007, bottom: 1503 },
  joints: { center: [581, 475], head: [549, 375], eyes: [[510, 386], [591, 357]], feet: [[542, 1433], [305, 1488]] },
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
  joints: { center: [548, 415], head: [518, 308], eyes: [[480, 317], [548, 265]], feet: [[248, 1231], [252, 1411]] },
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
  joints: { center: [470, 369], head: [482, 270], eyes: [[439, 268], [507, 242]], feet: [[436, 1499], [493, 1397]] },
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
  joints: { center: [459, 292], head: [445, 199], eyes: [[420, 206], [480, 172]], feet: [[359, 1515], [365, 1655]] },
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
  joints: { center: [599, 457], head: [578, 315], eyes: [[528, 327], [620, 306]], feet: [[208, 1530], [853, 1542]] },
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
  joints: { center: [618, 489], head: [585, 370], eyes: [[528, 367], [632, 355]], feet: [[485, 1320], [600, 1339]] },
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
  joints: { center: [514, 432], head: [520, 255], eyes: [[481, 277], [557, 243]], feet: [[574, 1377], [449, 1612]] },
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
  joints: { center: [537, 454], head: [546, 334], eyes: [[490, 330], [569, 361]], feet: [[417, 1492], [614, 1623]] },
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
  joints: { center: [537, 394], head: [519, 324], eyes: [[496, 319], [556, 294]], feet: [[535, 1531], [1048, 1743]] },
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
  joints: { center: [520, 420], head: [484, 353], eyes: [[467, 344], [515, 327]], feet: [[491, 1971], [214, 1576]] },
  /**
   * 베일과 펼친 날개가 캔버스를 거의 다 채워(998 / 1024) 카드 배율이 그 폭으로 정해지는 바람에
   * 얼굴만 중앙값의 0.56배까지 줄었다 — 렉시아의 낫과 같은 함정이다. 게다가 이 원화는 얼굴
   * 자체도 작게 그려져 있어(눈 간격 51px, 엘라 74px) 되돌릴 폭이 더 크다.
   */
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
  joints: { center: [589, 377], head: [572, 283], eyes: [[529, 280], [603, 262]], feet: [[395, 1451], [638, 1437]] },
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
  joints: { center: [441, 344], head: [403, 245], eyes: [[383, 254], [430, 216]], feet: [[199, 1369], [574, 1337]] },
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
 * 거대한 모피 코트가 실루엣 폭을 넓게 채운다(982 / 1086). 얼굴 크기는 폭이 아니라 두 눈
 * 관절로 재는 공용 얼굴 규격(`FACE_STANDARD`)이 맞추므로 개체 보정을 두지 않는다.
 */
export const MADDY_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 37, top: 29, right: 1019, bottom: 1421 },
  joints: { center: [507, 324], head: [472, 255], eyes: [[448, 244], [509, 218]], feet: [[588, 1344], [226, 1418]] },
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
  joints: { center: [561, 468], head: [588, 360], eyes: [[536, 331], [615, 361]], feet: [[374, 1434], [714, 1419]] },
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
  joints: { center: [728, 410], head: [671, 313], eyes: [[637, 315], [714, 269]], feet: [[141, 1213], [473, 1412]] },
  /** 로비 세로 비율: 메론 기준. 1.46 m. */
  lobbyZoom: 0.953,
};

/** 슈테 SD ZIP의 정사각 원본과 alpha > 16 경계다. 중심1(656,640)·머리1(589,501)을 함께 읽었다. */
export const SHUTE_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 31, top: 18, right: 1222, bottom: 1235 },
};

/**
 * 22번 **모르페**(디몰포돈)의 전신.
 *
 * **요람 의자에 앉은 개체라 실루엣이 서 있는 개체보다 크다.** 로비 비례는 `눈 → alpha 아래
 * 경계`로 재는데, 이 원화의 아래 경계는 발끝이 아니라 **의자 밑동**이다 — 같은 1.57 m라도
 * 서 있는 개체보다 그 거리가 짧으므로 규칙이 배율을 키워 화면에서 더 크게 선다. 의도한
 * 결과이며, 그래서 머리끝이 y=30까지 올라와 화면 위쪽에 가장 가까이 서는 개체가 된다.
 *
 * 발 관절(404,1415)·(511,1427)은 alpha 아래 경계(1408)보다 **아래에** 박혀 있다. 바닥선을
 * 관절이 아니라 `content.bottom`으로 잡는 규칙이 없었으면 이 개체만 바닥에 파묻혔을 것이다.
 */
export const MORPHE_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 23, top: 42, right: 1067, bottom: 1408 },
  joints: { center: [732, 473], head: [712, 390], eyes: [[678, 388], [753, 369]], feet: [[404, 1415], [511, 1427]] },
  /** 로비 세로 비율: 메론 기준. 1.57 m — 눈(378.5)에서 의자 밑동까지를 그 키로 맞춘다. */
  lobbyZoom: 1.092,
  /**
   * **왼쪽 위의 드론(A-Dimo)도 이 원화의 주인공이다.** 얼굴이 오른쪽에 있어 공용 규격 배율로 세우면 드론이
   * 통째로 화면 밖으로 나간다 — 드론의 왼쪽 끝(alpha 경계 left)까지 정보창 안에 들도록 구도를 잡는다.
   */
  // 요람에 앉은 개체라 키 비례를 포기한다. 지금보다 25% 크게 세우고, 드론 쪽은 화면 왼쪽에 조금 걸친다.
  lobbyFraming: { shift: 120, zoom: 0.806 },
};

/** 모르페 SD: 중심1·머리1·발1·발2를 프로젝트에서 읽었으며 눈 관절은 없다. */
export const MORPHE_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 30, top: 13, right: 1225, bottom: 1241 },
};

/**
 * 19번 테리사(테리지노사우루스) 전신.
 *
 * ZIP 안 WebP의 alpha > 16 경계를 실측했다(36,12–1077,1415). 관절도 같은 좌표계에서 읽어
 * 중심1(509,274)·머리1(484,159)·눈1(468,172)·눈2(536,145)이며, 넷 다 alpha 상자 안에 있다.
 *
 * **발 관절(792,1619 · 424,1518)은 그림 밖에 박혀 있다.** 캔버스 높이가 1446인데 발1이
 * 1619라, 그것으로 바닥선을 잡으면 이 개체만 공중에 뜬다 — 바닥선은 늘 alpha 경계
 * (`content.bottom`)가 잡는다.
 *
 * 양손의 갈퀴가 좌우 끝까지 뻗어 실루엣이 캔버스를 거의 채우지만(폭 1041/1088), 그 갈퀴는
 * 어깨 높이에서 벌어져 머리 위 여백을 키우지 않으므로 카드 쪽 `cardTop` 보정은 필요 없다.
 */
export const TERISA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1088,
  imageHeight: 1446,
  content: { left: 36, top: 12, right: 1077, bottom: 1415 },
  joints: { center: [509, 274], head: [484, 159], eyes: [[468, 172], [536, 145]], feet: [[792, 1619], [424, 1518]] },
  /** 로비 세로 비율: 메론 기준. 1.72 m — 보정 없이 세우면 1.709 m로 서므로 살짝 키운다. */
  lobbyZoom: 1.007,
  /**
   * 관절은 실측과 맞다(눈1·눈2가 두 눈 위에 정확히 앉는다). 다만 눈이 정수리(12)에서 146px 아래라
   * 후드·베일이 높이 솟은 만큼 같은 눈높이에서 정수리가 메론보다 약 110px 낮게 서 내려앉아 보인다.
   */
  infoFraming: { raise: 110 },
};

/** 테리사 SD ZIP의 정사각 원본과 alpha > 16 경계다. 중심1(587,564)·머리1(522,405)을 함께 읽었다. */
export const TERISA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 34, top: 32, right: 1219, bottom: 1222 },
};

/**
 * 상점 점원 **오비**(오비랍토르)의 전신.
 *
 * 렐릭이 아니라 상점 무대에만 서는 개체라 SD 묶음이 없다 — 전투에 나가지 않기 때문이다.
 * 값은 ZIP의 alpha 경계와 관절을 실측한 것이며, 눈 관절이 alpha 상자 안에 있어 카드·로비
 * 비례 규칙을 그대로 통과한다(상점은 머리 관절만 쓴다).
 */
export const SHOP_CLERK_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1122, imageHeight: 1402,
  content: { left: 69, top: 3, right: 879, bottom: 1359 },
  joints: { center: [608, 371], head: [576, 284], eyes: [[534, 300], [625, 262]], feet: [[474, 1280], [698, 1360]] },
};

/**
 * 고고학 상점 점원 **프로티아**(프로토케라톱스)의 전신.
 *
 * 오비와 같은 이유로 렐릭이 아니고 SD 묶음도 없다. 값은 ZIP의 alpha 경계와 관절을 실측한
 * 것이다 — **발 관절이 그림 밖에 박혀 있는 묶음**이라(발1이 y=1768, 캔버스는 1448) 바닥선
 * 기준으로는 세울 수 없지만, 상점 무대는 머리 관절만 쓰므로 그대로 통과한다.
 */
export const ARCHAEOLOGY_CLERK_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 51, top: 21, right: 1018, bottom: 1412 },
  joints: { center: [550, 384], head: [557, 276], eyes: [[524, 288], [604, 248]], feet: [[631, 1768], [533, 1521]] },
};

/**
 * 전리품 상점 점원의 전신.
 *
 * 값은 ZIP의 원화 알파 경계와 `puppet.json`의 관절을 실측한 것이다 — 캔버스 크기를 그대로
 * 적거나 다른 점원의 값을 옮겨 오면 무대 배율이 통째로 틀어진다.
 */
export const LOOT_CLERK_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1122, imageHeight: 1402,
  content: { left: 51, top: 15, right: 1099, bottom: 1358 },
  joints: { center: [525, 359], head: [566, 244], eyes: [[533, 219], [598, 260]], feet: [[411, 1359], [794, 1254]] },
};

/*
 * **레이티아 다섯 자매의 실측값.**
 *
 * 전신과 SD 열 묶음을 WebP/PNG 원본 좌표계에서 alpha > 16으로 순회해 경계를 재고, 관절은
 * 프로젝트의 `중심1`·`머리1`·`눈1/2`·`발1/2`를 그대로 옮겼다. SD 프로젝트에는 눈 관절이
 * 없으므로 임의 얼굴 좌표를 만들지 않고 `eyes: null`로 남긴다.
 *
 * 다섯이 같은 몸이라도 **묶음마다 캔버스와 여백이 다르다** — 불 자매만 캔버스가
 * 1023×1537이고 나머지는 1086×1448이다. 한 자매의 값을 다른 자매에 옮겨 적으면 그 개체만
 * 카드·전신 배율이 통째로 틀어진다.
 */

/** 비리아(raitia-grass) 전신. */
export const VIRIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 130, top: 41, right: 953, bottom: 1413 },
  joints: { center: [537, 499], head: [511, 405], eyes: [[472, 410], [555, 366]], feet: [[577, 1843], [54, 1496]] },
};

/** 비리아(raitia-grass) 전투 SD. */
export const VIRIA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 250, top: 45, right: 992, bottom: 1232 },
  joints: { center: [634, 618], head: [618, 541], eyes: null, feet: [[729, 1211], [374, 1172]] },
};

/** 구티아(raitia-water) 전신. */
export const GUTTIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 67, top: 35, right: 1050, bottom: 1429 },
  joints: { center: [568, 508], head: [538, 385], eyes: [[511, 415], [595, 372]], feet: [[580, 1596], [32, 1495]] },
};

/** 구티아(raitia-water) 전투 SD. */
export const GUTTIA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 244, top: 19, right: 1103, bottom: 1229 },
  joints: { center: [649, 665], head: [611, 539], eyes: null, feet: [[721, 1207], [382, 1188]] },
};

/** 파비아(raitia-fire) 전신. */
export const FAVIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1023, imageHeight: 1537,
  content: { left: 161, top: 32, right: 937, bottom: 1513 },
  joints: { center: [541, 514], head: [511, 416], eyes: [[479, 409], [558, 375]], feet: [[533, 1697], [184, 1627]] },
};

/** 파비아(raitia-fire) 전투 SD. */
export const FAVIA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 216, top: 29, right: 1040, bottom: 1224 },
  joints: { center: [653, 660], head: [618, 541], eyes: null, feet: [[729, 1211], [460, 1194]] },
};

/** 실리아(raitia-earth) 전신. */
export const SILIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 26, top: 32, right: 1018, bottom: 1417 },
  joints: { center: [568, 508], head: [605, 417], eyes: [[559, 371], [635, 416]], feet: [[970, 1605], [201, 2026]] },
};

/** 실리아(raitia-earth) 전투 SD. */
export const SILIA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 205, top: 59, right: 1015, bottom: 1213 },
  joints: { center: [634, 618], head: [657, 534], eyes: null, feet: [[923, 1200], [554, 1183]] },
};

/** 벤티아(raitia-wind) 전신. */
export const VENTIA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 178, top: 37, right: 1016, bottom: 1424 },
  joints: { center: [568, 508], head: [523, 446], eyes: [[491, 449], [579, 414]], feet: [[566, 1599], [195, 1533]] },
};

/** 벤티아(raitia-wind) 전투 SD. */
export const VENTIA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 273, top: 29, right: 1104, bottom: 1219 },
  joints: { center: [634, 618], head: [618, 541], eyes: null, feet: [[729, 1211], [374, 1172]] },
};

/**
 * **수쿠스이노 전신.** 공멸이 풀어 놓은 데이노수쿠스 기반 폭주 병기이자 첫 시즌의 레이드 보스다.
 *
 * 값은 ZIP 안 WebP의 실제 크기와 alpha > 16 경계를 직접 재서 적었다. 다른 개체의 값을 옮겨
 * 오면 카드·전신 배율이 통째로 틀어지므로 원화가 바뀌면 같은 방법으로 다시 잰다.
 */
export const SUKUSUINO_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 15, top: 19, right: 1069, bottom: 1410 },
  joints: { center: [637, 386], head: [608, 267], eyes: [[585, 265], [637, 239]], feet: [[402, 1719], [858, 1423]] },
};

/** 수쿠스이노 전투 SD. */
export const SUKUSUINO_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 77, top: 52, right: 1171, bottom: 1227 },
  joints: { center: [658, 617], head: [681, 504], eyes: null, feet: [[880, 1208], [537, 1233]] },
};

/**
 * **타보아 전신.** 공멸이 풀어 놓은 티타노보아 기반 폭주 병기이자 둘째 레이드 보스다.
 *
 * 값은 ZIP 안 WebP의 실제 크기와 alpha > 16 경계를 직접 재서 적었다. 수쿠스이노와 캔버스
 * 크기가 같아도 여백과 관절이 다르므로 그 값을 옮겨 오지 않는다.
 */
export const TABOA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086, imageHeight: 1448,
  content: { left: 26, top: 21, right: 1055, bottom: 1421 },
  joints: { center: [566, 269], head: [520, 184], eyes: [[498, 188], [551, 147]], feet: [[909, 1904], [421, 1544]] },
};

/** 타보아 전투 SD. */
export const TABOA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 119, top: 13, right: 1135, bottom: 1241 },
  joints: { center: [648, 560], head: [572, 472], eyes: null, feet: [[509, 1262], [734, 1251]] },
};

/**
 * **코아틀 전신.** 공멸이 풀어 놓은 셋째 폭주 병기이자 셋째 레이드 보스다.
 *
 * 값은 ZIP 안 WebP의 실제 크기와 alpha > 16 경계를 직접 재서 적었다. 앞선 두 보스와 캔버스가
 * 달라(1122×1402) 그 값을 옮겨 오지 않는다.
 */
export const QUETZALCOATLUS_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1122, imageHeight: 1402,
  content: { left: 11, top: 78, right: 1108, bottom: 1349 },
  joints: { center: [574, 318], head: [568, 248], eyes: [[551, 249], [593, 225]], feet: [[424, 1387], [782, 1494]] },
};

/** 코아틀 전투 SD. */
export const QUETZALCOATLUS_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254, imageHeight: 1254,
  content: { left: 28, top: 34, right: 1226, bottom: 1220 },
  joints: { center: [662, 621], head: [637, 513], eyes: null, feet: [[638, 1226], [812, 1205]] },
};

/**
 * 23번 켄토(켄트로사우르스) 전신.
 *
 * ZIP 안 WebP의 alpha > 16 경계를 실측했다(16,4–1071,1442). 눈1(543,350)·눈2(630,378)·머리1(604,374)·
 * 중심1(550,466)이 모두 그 상자 안에 있다. **발 관절(482,1388 · 714,1431)** 중 발2는 alpha 아래 경계(1442)
 * 안이라 바닥선이 어긋나지 않는다.
 *
 * 몸 뒤로 뻗은 가시 꼬리와 위쪽의 부유 가시 날 둘 때문에 실루엣이 캔버스를 거의 채우지만, 둘 다 어깨
 * 높이보다 위에서 머리 옆으로 벌어져 머리 위 여백을 키우지 않는다. **키가 1.38 m로 작아** 로비 배율은
 * 눈에서 alpha 아래 경계까지를 그 키로 맞춘 값이다(`lobbyZoom`).
 */
export const KENTO_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1087,
  imageHeight: 1447,
  content: { left: 16, top: 4, right: 1071, bottom: 1442 },
  joints: { center: [550, 466], head: [604, 374], eyes: [[543, 350], [630, 378]], feet: [[482, 1388], [714, 1431]] },
  /** 로비 세로 비율: 메론 기준. 1.38 m — 눈(364)에서 alpha 아래 경계까지를 그 키로 맞춘다. */
  lobbyZoom: 0.965,
};

/** 켄토 SD: 중심1·머리1·발1·발2를 프로젝트에서 읽었으며 눈 관절은 없다. alpha 경계는 (51,76)–(1209,1214)다. */
export const KENTO_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 51, top: 76, right: 1209, bottom: 1214 },
};

/**
 * 24번 모사나(모사사우루스) 전신.
 *
 * ZIP 안 WebP의 alpha > 16 경계를 실측했다(93,52–1018,1410). 눈1(381,218)·눈2(423,177)·머리1(401,213)·
 * 중심1(440,298)이 모두 그 상자 안에 있다. **발 관절(235,1530 · 596,1535)은 alpha 아래 경계(1410)
 * 밖에 박혀 있다** — 그래서 바닥선은 관절이 아니라 alpha 경계로 세운다(로비 규칙과 같다).
 *
 * 몸 뒤로 크게 휘어 나온 톱니 꼬리가 캔버스 오른쪽을 거의 채우지만 허리 아래에서 벌어져 머리 위
 * 여백을 키우지 않는다. 로비 배율은 눈에서 alpha 아래 경계까지를 관찰 프로필의 키로 맞춘 값이다.
 */
export const MOSANA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 93, top: 52, right: 1018, bottom: 1410 },
  joints: { center: [440, 298], head: [401, 213], eyes: [[381, 218], [423, 177]], feet: [[235, 1530], [596, 1535]] },
  /** 로비 세로 비율: 메론 기준. 1.62 m — 눈(197.5)에서 alpha 아래 경계까지를 그 키로 맞춘다. */
  lobbyZoom: 0.951,
};

/** 모사나 SD: 중심1·머리1·발1·발2를 프로젝트에서 읽었으며 눈 관절은 없다. alpha 경계는 (50,21)–(1203,1232)다. */
export const MOSANA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 50, top: 21, right: 1203, bottom: 1232 },
};

/**
 * 안카 전신(char_025): 중심1·머리1·눈1·눈2·발1·발2를 프로젝트에서 읽었다. alpha 경계는 (145,15)–(942,1438)이다.
 * 발 관절은 그림 밖에 박혀 있어 바닥선은 alpha 아래 경계가 맡는다.
 */
export const ANKA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 145, top: 15, right: 942, bottom: 1438 },
  joints: { center: [426, 324], head: [401, 213], eyes: [[374, 220], [456, 201]], feet: [[265, 1613], [538, 1649]] },
  /** 로비 세로 비율: 메론 기준. 1.24 m — 눈(210.5)에서 alpha 아래 경계까지를 그 키로 맞춘다. */
  lobbyZoom: 0.753,
};

/** 안카 SD: 중심1·머리1·발1·발2를 프로젝트에서 읽었으며 눈 관절은 없다. alpha 경계는 (179,15)–(1075,1239)다. */
export const ANKA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 179, top: 15, right: 1075, bottom: 1239 },
};

/**
 * 이르나 전신(char_026): 중심1·머리1·눈1·눈2·발1·발2를 프로젝트에서 읽었다. alpha 경계는 (49,12)–(1014,1427)이다.
 * 고개가 기울어 두 눈의 높이가 35px 다르다(눈 사이 약 66px) — 눈높이는 두 눈의 가운데로 잰다.
 */
export const IRNA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 49, top: 12, right: 1014, bottom: 1427 },
  joints: { center: [549, 332], head: [600, 254], eyes: [[567, 230], [623, 265]], feet: [[470, 1369], [693, 1421]] },
  /** 로비 세로 비율: 메론 기준. 1.56 m — 눈(247.5)에서 alpha 아래 경계까지를 그 키로 맞춘다. */
  lobbyZoom: 0.981,
};

/** 이르나 SD: 중심1·머리1을 프로젝트에서 읽었으며 눈 관절은 없다. alpha 경계는 (66,54)–(1149,1218)이다. */
export const IRNA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 66, top: 54, right: 1149, bottom: 1218 },
};

/**
 * 아크 전신(char_027): 중심1·머리1·눈1·눈2·발1·발2를 프로젝트에서 읽었다. alpha 경계는 (39,13)–(1055,1423)이다.
 * 고개가 기울어 두 눈의 높이가 33px 다르다 — 눈높이는 두 눈의 가운데로 잰다. 후드가 머리보다 한참 위로 솟아 있어
 * 키(1.46 m)가 작아도 로비 배율은 1 아래로 내려간다.
 */
export const ARK_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1086,
  imageHeight: 1448,
  content: { left: 39, top: 13, right: 1055, bottom: 1423 },
  joints: { center: [577, 437], head: [595, 338], eyes: [[558, 306], [620, 339]], feet: [[358, 1413], [735, 1461]] },
  /** 로비 세로 비율: 메론 기준. 1.46 m — 눈(322.5)에서 alpha 아래 경계까지를 그 키로 맞춘다. */
  lobbyZoom: 0.98,
};

/**
 * 유티라 전신(char_028): 중심1·머리1·눈1·눈2·발1·발2를 프로젝트에서 읽었다. alpha > 16 경계는 (19,20)–(1005,1502)이다.
 * 고개를 숙인 자세라 두 눈의 높이가 36px 다르다 — 눈높이는 두 눈의 가운데로 잰다. 발2 관절은 그림 밖에 있어
 * 바닥선은 관절이 아니라 alpha 경계로 잡는다.
 */
export const YUTIRA_PORTRAIT_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1024,
  imageHeight: 1536,
  content: { left: 19, top: 20, right: 1005, bottom: 1502 },
  joints: { center: [551, 323], head: [497, 227], eyes: [[470, 227], [528, 191]], feet: [[371, 1403], [517, 1629]] },
  /** 로비 세로 비율: 메론 기준. 1.68 m — 눈(209)에서 alpha 아래 경계까지를 그 키로 맞춘다. */
  lobbyZoom: 0.96,
};

/** 유티라 SD: 중심1·머리1·발1·발2를 프로젝트에서 읽었으며 눈 관절은 없다. alpha > 16 경계는 (69,65)–(1165,1218)이다. */
export const YUTIRA_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 69, top: 65, right: 1165, bottom: 1218 },
  joints: { center: [630, 616], head: [616, 474], eyes: null, feet: [[739, 1217], [529, 1193]] },
};

/** 아크 SD: 중심1·머리1을 프로젝트에서 읽었으며 눈 관절은 없다. alpha 경계는 (113,31)–(1128,1224)이다. */
export const ARK_SD_METADATA: Omit<PuppetAsset, "url"> = {
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 113, top: 31, right: 1128, bottom: 1224 },
};
