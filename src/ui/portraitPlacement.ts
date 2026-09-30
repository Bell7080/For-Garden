import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { PuppetAsset } from "../puppets/assets";
import { eyeLineAnchor, faceJoints } from "../puppets/anchors";

/** Alpha 실루엣을 화면 좌표로 옮긴 결과다. UI 안전 영역 테스트도 이 값만 사용한다. */
export interface PortraitScreenBounds { top: number; bottom: number; height: number }

/** 플레이어 조작과 읽기 전용 적 분석창은 하단에서 보호해야 할 콘텐츠가 서로 다르다. */
export const INFO_PORTRAIT_SAFE_AREA = {
  player: { titleBottom: 330, controlsTop: 1420 },
  enemy: { titleBottom: 330, controlsTop: 1660 },
} as const;

/**
 * 정보창 전신 원화가 서는 기준.
 *
 * `x`·`y`는 코어(`중심1`) 관절 자리이고 `height`는 alpha 경계 전체의 기준 높이다. 두 눈 관절을
 * 가진 원화는 이 값에서 **눈높이 한 줄**과 **얼굴 크기**를 거꾸로 구한다(`FACE_STANDARD`).
 * 코어는 가슴께에 박혀 있어 거기서 얼굴까지의 거리가 원화의 등신비를 그대로 따라가므로,
 * 코어로 세우면 같은 화면에서 눈높이가 330px 넘게 벌어졌다(스피나 506 · 델로피 836).
 */
export const INFO_PORTRAIT_FOCUS = { x: 336, y: 950, height: 1820 } as const;

/**
 * 얼굴 규격 — 전신과 카드가 **두 눈 관절**(`눈1`·`눈2`)로 맞추는 공통 기준.
 *
 * 개체마다 세로 보정(`portraitOffsetY`)·확대 보정(`cardZoom`·`portraitZoom`)을 적어 맞추던 때는
 * 새 원화가 들어올 때마다 같은 어긋남이 다시 생겼다(테리사가 그랬다 — 갈퀴가 실루엣 폭을 넓혀
 * 카드에서 무릎까지 보일 만큼 작아졌고, 정보창에서는 눈이 메론보다 45px 아래에 섰다).
 * 지금은 이 표 한 곳이 모든 개체의 얼굴선을 정한다.
 *
 * - `eyeRise`: 정보창 기준 높이 대비, 코어 자리에서 눈높이 한 줄까지 올라가는 거리.
 * - `span`: 두 눈 사이 거리의 목표. 정보창은 기준 높이 대비, 카드는 카드 폭 대비다.
 * - `band`: 목표에서 이만큼 벗어난 얼굴만 띠 끝까지 당긴다. 눈 간격은 고개 각도·그림체에 따라
 *   원래 조금씩 다르므로 전부 한 크기로 누르면 몸 비율이 튄다 — 띠 안은 원화 그대로 둔다.
 * - `aspect`·`maxHeadDrop`: 도감 카드(머리 홈 포함)의 세로/가로 비와, 카드가 정수리를 자르지
 *   않고 얼굴을 당길 수 있는 한계. 머리통·귀가 크게 솟은 원화(토리카·레이티아 자매)는 얼굴을
 *   띠까지 키우면 자르기 시작점이 `MAX_HEAD_DROP_RATIO`에 걸려 정수리가 잘린다 — 그 전에서 멈춘다.
 * - `maxWidth`: 정보창 실루엣 폭의 상한(기준 높이 대비). 얼굴만 맞추면 얼굴이 작게 그려진 원화의
 *   배율이 계속 올라가 판을 통째로 덮는다(노도니아가 폭 1748px이 된 적이 있다).
 */
export const FACE_STANDARD = {
  info: { eyeRise: 190 / 1820, span: 104 / 1820, band: 0.1, maxWidth: 1500 / 1820 },
  card: { fill: 0.56, span: 47 / 300, band: 0.1, aspect: 464 / 300, maxHeadDrop: 0.45 },
} as const;

/**
 * `infoFraming.showLeft`가 있는 원화의 구도.
 *
 * 그 왼쪽 끝을 정보창 왼쪽 안쪽 여백(`margin`)에 들이려고 먼저 얼굴을 오른쪽으로 `shift`만큼 옮긴다 —
 * 오른쪽은 어차피 능력치 판이 덮는 자리라 얼굴만 판 밖에 남으면 된다. 그래도 넘치면 배율을 줄인다.
 */
export const INFO_SHOW_LEFT = { shift: 104, margin: 24 } as const;

/** 얼굴이 목표 띠 밖이면 띠 끝까지 당기는 배율. 띠 안이면 1이다. */
function faceBandFactor(natural: number, target: number, band: number): number {
  if (natural <= 0) return 1;
  const clamped = Math.min(Math.max(natural, target * (1 - band)), target * (1 + band));
  return clamped / natural;
}

/** 모든 정보창이 같은 얼굴 규격을 지나도록 spawn 옵션을 한 곳에서 만든다. */
export function infoPortraitPlacement(asset: PuppetAsset, focus: { x: number; y: number; height: number }) {
  const anchor = eyeLineAnchor(asset);
  const face = faceJoints(asset);
  if (!anchor || !face) {
    // 눈 관절이 없는 원화(폰토스 등)는 코어 기준과 원화 쪽 보정을 그대로 쓴다.
    return { focus: { anchor: "core" as const, x: focus.x, y: focus.y + (asset.portraitOffsetY ?? 0) }, height: focus.height * (asset.portraitZoom ?? 1) };
  }
  const contentHeight = asset.content.bottom - asset.content.top;
  const contentWidth = asset.content.right - asset.content.left;
  const spec = FACE_STANDARD.info;
  const base = focus.height / contentHeight;
  const widthCap = (spec.maxWidth * focus.height) / contentWidth;
  const faceScale = Math.min(base * faceBandFactor(face.span * base, spec.span * focus.height, spec.band), Math.max(base, widthCap));
  const framing = asset.infoFraming;
  // 눈높이 한 줄에서 `raise`만큼 더 올린다. 기준 높이가 다른 자리(적 창·획득창)에서도 같은 비율이 되도록 높이에 비례한다.
  const y = focus.y - spec.eyeRise * focus.height - (framing?.raise ?? 0) * focus.height / INFO_PORTRAIT_FOCUS.height;
  if (framing?.showLeft === undefined) {
    return { focus: { anchor: "eyeLine" as const, x: focus.x, y }, height: faceScale * contentHeight };
  }
  // 눈높이 배치의 가로 기준은 몸(코어)이다. 코어에서 끝까지 보여야 하는 왼쪽 끝까지의 거리(원화 px)가
  // 화면에서 `x - margin` 안에 들어야 한다.
  const reach = Math.max(1, anchor.x - framing.showLeft);
  const x = focus.x + INFO_SHOW_LEFT.shift * focus.height / INFO_PORTRAIT_FOCUS.height;
  const scale = Math.min(faceScale, (x - INFO_SHOW_LEFT.margin) / reach);
  return { focus: { anchor: "eyeLine" as const, x, y }, height: scale * contentHeight };
}

/**
 * 카드·얼굴 액자의 확대 보정. 모든 잘라내기(카드·얼굴 액자·얼굴 띠·뽑기 카드)가 기준 비율을
 * 이 값으로 나눈다 — 화면마다 보정을 따로 곱하면 같은 개체가 화면마다 다른 크기로 선다.
 *
 * 눈 관절을 가진 원화는 카드 속 두 눈 사이 거리를 `FACE_STANDARD.card` 띠 안으로 모은다.
 * 실루엣 **가로폭**으로 크기를 정하는 카드는 갈퀴·낫·날개가 넓은 원화만 얼굴이 작아지기 때문이다.
 */
export function portraitCardZoom(asset: Pick<PuppetAsset, "joints" | "content" | "cardTop" | "cardZoom" | "portraitZoom">): number {
  const face = faceJoints(asset);
  const head = asset.joints?.head;
  if (!face || !head) return (asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1);
  const spec = FACE_STANDARD.card;
  const fillWidth = (asset.content.right - asset.content.left) * spec.fill;
  const zoom = faceBandFactor(face.span / fillWidth, spec.span, spec.band);
  // 카드 잘라내기 높이는 `fillWidth × aspect ÷ zoom`이다. 머리 관절이 그 높이의 `maxHeadDrop`
  // 안에 들어야 자르기가 정수리 위에서 시작한다.
  const headDrop = head[1] - (asset.cardTop ?? asset.content.top);
  const clipCap = headDrop > 0 ? (spec.maxHeadDrop * fillWidth * spec.aspect) / headDrop : Infinity;
  return Math.min(zoom, clipCap);
}

/**
 * 원화 감상(돋보기)의 여백.
 *
 * 화면 네 변에서 이만큼만 비우고 나머지를 그림이 다 쓴다. 0으로 두지 않는 이유는 정수리와
 * 발끝이 화면 변에 딱 붙으면 잘린 것처럼 보이기 때문이다.
 */
export const GALLERY_PORTRAIT_MARGIN = 26;

/**
 * 돋보기로 여는 감상 자리.
 *
 * **그림이 한 조각도 잘리지 않는다.** 정보창의 전신은 코어 관절을 기준으로 크게 세워 종아리쯤에서
 * 판 밑변에 잘리는데, 그것을 자세히 보려고 누른 자리에서 같은 방식으로 세우면 더 크게 잘린
 * 그림을 볼 뿐이다. 여기서는 alpha 경계의 **가로와 세로 둘 다** 화면 안에 들어오는 배율을 고르고
 * (둘 중 작은 쪽), 그림 한가운데를 화면 한가운데에 둔다.
 *
 * **개체별 보정(`portraitZoom`·`portraitOffsetY`)을 태우지 않는다.** 그 둘은 정보창에서 여러
 * 개체의 얼굴 크기와 시각 중심을 맞추려고 둔 값이라, 통째로 보는 자리에서 곱하면 어떤 원화는
 * 다시 화면 밖으로 나간다.
 */
export function galleryPortraitPlacement(asset: PuppetAsset): { x: number; groundY: number; height: number } {
  const contentWidth = asset.content.right - asset.content.left;
  const contentHeight = asset.content.bottom - asset.content.top;
  const scale = Math.min(
    (BASE_WIDTH - GALLERY_PORTRAIT_MARGIN * 2) / contentWidth,
    (BASE_HEIGHT - GALLERY_PORTRAIT_MARGIN * 2) / contentHeight,
  );
  const height = contentHeight * scale;
  // `computePlacement`는 그림의 가로 가운데를 `x`에, 밑변을 `groundY`에 맞춘다 — 세로 가운데에
  // 두려면 밑변이 화면 중심보다 그림 높이의 절반만큼 아래에 있으면 된다.
  return { x: BASE_WIDTH / 2, groundY: BASE_HEIGHT / 2 + height / 2, height };
}

/**
 * 로비 광장에 선 애착 렐릭의 자리.
 *
 * 예전에는 상자 하나에 그림을 욱여넣어 크기를 정했다. 그러면 캔버스 여백과 등신이 원화마다
 * 달라 1.08 m 토리카가 1.76 m 메테보다 크게 서고, 발끝도 개체마다 다른 높이에 떴다.
 * 지금은 **바닥선 하나**(`floor`)에 발을 세우고, 키가 큰 개체가 실제로 크게 서도록
 * 기준 높이에 원화별 `lobbyZoom`을 곱한다. 기준은 메론(1.58 m)이다.
 */
export const LOBBY_PORTRAIT_SPOT = { x: BASE_WIDTH / 2, floor: 1930, height: 1740 } as const;

/** 로비 전신이 쓰는 spawn 옵션. 화면이 좌표와 배율을 손으로 적지 않는다. */
export function lobbyPortraitPlacement(asset: PuppetAsset) {
  return {
    // 꼬리가 긴 렉시아도 그림 외곽이 아니라 `중심1` 관절이 광장 중앙에 오도록 맞춘다.
    focusX: { anchor: "core" as const, x: LOBBY_PORTRAIT_SPOT.x },
    groundY: LOBBY_PORTRAIT_SPOT.floor,
    height: LOBBY_PORTRAIT_SPOT.height * (asset.lobbyZoom ?? 1),
  };
}

/** 정적으로 측정한 alpha union과 코어 관절로 실제 화면의 머리·꼬리 끝을 계산한다. */
export function portraitScreenBounds(asset: PuppetAsset, coreY: number, placement: { focusY: number; height: number }): PortraitScreenBounds {
  const scale = placement.height / (asset.content.bottom - asset.content.top);
  const top = placement.focusY + (asset.content.top - coreY) * scale;
  const bottom = placement.focusY + (asset.content.bottom - coreY) * scale;
  return { top, bottom, height: bottom - top };
}

/** 발끝을 바닥선에 맞추는 기록/전투 배치도 정보창과 같은 alpha 경계 표현을 돌려준다. */
export function groundedPortraitBounds(asset: PuppetAsset, groundY: number, height: number): PortraitScreenBounds {
  // grounded 배치는 union bottom을 정확히 groundY에 맞추므로 top은 의도 높이만큼 위다.
  const scale = height / (asset.content.bottom - asset.content.top);
  const renderedHeight = (asset.content.bottom - asset.content.top) * scale;
  return { top: groundY - renderedHeight, bottom: groundY, height: renderedHeight };
}

/** 화면 밖 꼬리는 조작판 뒤에서 잘리지만 제목 쪽 실루엣은 그대로 보존한다. */
export function visiblePortraitBounds(bounds: PortraitScreenBounds): PortraitScreenBounds {
  const top = Math.max(0, bounds.top); const bottom = Math.min(BASE_HEIGHT, bounds.bottom);
  return { top, bottom, height: Math.max(0, bottom - top) };
}
