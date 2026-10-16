import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 회고 창의 자리표.
 *
 * **목록은 창 안에서 흐른다.** 1장만 해도 이야기가 열세 편이라 줄을 판 위에 그대로 쌓던 때는
 * 아래쪽 줄이 판 밑변을 넘어 화면 밖으로 삐져나갔다. 창의 크기는 임무판과 같은 몫을 쓰고(화면에서
 * 좌우·위아래 여백만 남긴다), 줄은 그 안의 창에서 마스크로 잘린 채 흐른다.
 *
 * 줄 하나는 교류 층과 같은 문법의 **한 장**이다 — 이야기의 무대 원화가 판을 채우고 판 실루엣대로
 * 잘린다. 글은 왼쪽에서 오른쪽으로 걷히는 어둠 위에 선다.
 */
export const RECOLLECTION_LAYOUT = {
  popup: { width: BASE_WIDTH - 70, height: BASE_HEIGHT - 210 },
  /** 목록이 흐르는 창(팝업 몸판 좌표). 위는 제목표 아래, 아래는 탭 줄 위에서 끊는다. */
  viewport: { top: -(BASE_HEIGHT - 210) / 2 + 128, bottom: (BASE_HEIGHT - 210) / 2 - 196 },
  layer: {
    width: BASE_WIDTH - 70 - 80,
    height: 196,
    /** 줄 사이 간격(중심 기준). */
    step: 216,
    /** 판의 깎인 두 모서리(왼쪽 위·오른쪽 아래). */
    bevel: 30,
    /** 글이 판 왼쪽 변에서 들어오는 거리. */
    textInset: 46,
    /** 눈썹 줄(관문·전후)·제목·한 줄 줄거리의 자리(판 가운데 기준). */
    eyebrowY: -54,
    titleY: -6,
    summaryY: 50,
    /** 원화의 진하기. 이야기를 고르는 목록이라 그림이 글을 이기지 않게 은은하게 둔다. */
    artAlpha: 0.62,
    lockedArtAlpha: 0.22,
    /** 왼쪽에서 오른쪽으로 걷히는 어둠. 왼쪽 끝의 진하기와 걷히기 시작하는 자리(폭 비율). */
    scrim: { alpha: 0.9, fadeFrom: 0.28 },
    /** 판 오른쪽에 은은하게 깔리는 대사 한 줄. */
    echo: { size: 34, alpha: 0.2, right: 40, y: -42, maxWidth: 520 },
  },
  tab: { width: 250, height: 70, gap: 8, y: (BASE_HEIGHT - 210) / 2 - 110 },
} as const;

/** 줄 하나의 중심 y(흐르는 목록 좌표, 창 윗변이 0). */
export function recollectionRowY(index: number): number {
  const { layer } = RECOLLECTION_LAYOUT;
  return 12 + layer.height / 2 + index * layer.step;
}

/** 목록 전체의 높이. 창보다 길면 그 안에서 흐른다. */
export function recollectionListHeight(count: number): number {
  if (count <= 0) return 0;
  return recollectionRowY(count - 1) + RECOLLECTION_LAYOUT.layer.height / 2 + 24;
}

/** 창의 높이. */
export function recollectionViewportHeight(): number {
  return RECOLLECTION_LAYOUT.viewport.bottom - RECOLLECTION_LAYOUT.viewport.top;
}

/** 흐르는 목록 좌표의 y가 어느 줄 위인지. 줄 사이 틈이면 `undefined`. */
export function recollectionRowAt(localY: number, count: number): number | undefined {
  const { layer } = RECOLLECTION_LAYOUT;
  for (let index = 0; index < count; index += 1) {
    if (Math.abs(localY - recollectionRowY(index)) <= layer.height / 2) return index;
  }
  return undefined;
}

/**
 * 무대 원화에서 **이야기마다 다른 한 조각**을 잘라 내는 규칙.
 *
 * 본편 대사는 대부분 같은 전장 원화에서 흐르므로 가운데만 잘라 내면 모든 줄이 같은 그림이 된다.
 * 이야기 ID에서 세로 자리(`focus`, 0 위 ~ 1 아래)를 정해 그 높이의 띠를 잘라 낸다 — 같은 무대의
 * 서로 다른 구석이 줄마다 비친다. 늘이지 않고 제 비율로 키워 넘치는 만큼만 자른다(`coverCrop`과 같다).
 *
 * 그림의 원점이 가운데라 잘라 낸 띠가 판 가운데에 오도록 그림 자리(`offsetX`·`offsetY`)도 함께 준다.
 */
export interface RecollectionArtCrop {
  scale: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  offsetX: number;
  offsetY: number;
}

export function recollectionArtCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, focus: number): RecollectionArtCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { scale: 1, cropX: 0, cropY: 0, cropWidth: Math.max(0, sourceWidth), cropHeight: Math.max(0, sourceHeight), offsetX: 0, offsetY: 0 };
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const cropWidth = Math.min(sourceWidth, targetWidth / scale);
  const cropHeight = Math.min(sourceHeight, targetHeight / scale);
  const clamped = Math.min(1, Math.max(0, focus));
  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) * clamped;
  return {
    scale, cropX, cropY, cropWidth, cropHeight,
    offsetX: -((cropX + cropWidth / 2) - sourceWidth / 2) * scale,
    offsetY: -((cropY + cropHeight / 2) - sourceHeight / 2) * scale,
  };
}

/** 이야기 ID에서 나오는 세로 자리. 난수가 아니라 글자에서 정해 같은 이야기가 늘 같은 조각을 보인다. */
export function recollectionArtFocus(storyId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < storyId.length; index += 1) {
    hash ^= storyId.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  // 원화의 맨 위·맨 아래(하늘·바닥만 남는 띠)는 피한다.
  return 0.16 + (hash % 1000) / 1000 * 0.68;
}
