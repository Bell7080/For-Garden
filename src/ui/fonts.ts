/**
 * 게임 글꼴의 유일한 소유자.
 *
 * 굵기를 화면마다 눈대중으로 고르면 같은 위계의 글이 화면마다 다른 무게로 보인다.
 * 그래서 굵기 값 자체는 여기서만 정하고, 바깥에서는 "이 글이 무슨 역할인가"만 고른다.
 * 실제 파일 이름·가중치·로딩은 전부 이 파일에 갇혀 있어야 한다.
 */

/**
 * 글의 역할. 크기가 아니라 위계로 고른다.
 *
 * - `display`: 화면 제목, 캐릭터·스테이지 이름, 결과 문구, 전투 피해 수치처럼 한눈에 읽혀야
 *   하는 짧은 강조 문구. NEXON Kart ExtraBold.
 * - `emphasis`: 설명 안에서 튀어야 하는 라벨·소제목·수치·태그. 제목만큼 세지는 않다.
 *   NEXON Kart Gothic Bold.
 * - `body`: 스킬 설명, 대사, 안내, 통계 나열처럼 문장으로 읽는 모든 글. NEXON Kart Gothic
 *   Medium. 글이 길면 언제나 이쪽이다.
 */
export type TextRole = "display" | "emphasis" | "body";

/** 캔버스와 CSS가 같은 이름을 쓰도록 한 곳에서만 정한다. */
export const FONT_FAMILY_NAME = "NEXON Kart";

/**
 * 게임 글꼴이 아직 안 왔거나 글립이 없을 때 쓰는 대체 순서.
 * 한글이 얇게 빠지지 않도록 굵은 산세리프만 둔다.
 */
export const FONT_FALLBACK = '"Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/** Phaser Text와 CSS가 함께 쓰는 글꼴 스택. */
export const FONT_FAMILY = `"${FONT_FAMILY_NAME}", ${FONT_FALLBACK}`;

/** 역할별 굵기. 세 값 외의 굵기는 쓰지 않는다 — 파일이 세 개뿐이라 나머지는 브라우저가 흉내 낸다. */
export const FONT_WEIGHT: Record<TextRole, number> = {
  display: 800,
  emphasis: 700,
  body: 500,
} as const;

/**
 * `public/fonts`에 실제로 있는 파일과 굵기의 대응. @font-face를 CSS에 따로 적지 않고 이 목록
 * 하나로 등록하므로, 굵기를 늘리거나 파일을 바꿀 곳은 여기뿐이다.
 */
export const FONT_FACES: ReadonlyArray<{ weight: number; file: string }> = [
  { weight: FONT_WEIGHT.body, file: "/fonts/NexonKart-Medium.woff2" },
  { weight: FONT_WEIGHT.emphasis, file: "/fonts/NexonKart-Bold.woff2" },
  { weight: FONT_WEIGHT.display, file: "/fonts/NexonKart-ExtraBold.woff2" },
];

/** 역할을 캔버스가 이해하는 굵기 문자열로 바꾼다. Phaser의 `fontStyle`에 그대로 넣는다. */
export function fontStyleFor(role: TextRole): string {
  return `${FONT_WEIGHT[role]}`;
}

let loading: Promise<void> | undefined;

/**
 * 세 굵기를 등록하고 모두 내려받는다.
 *
 * Phaser Text는 캔버스에 한 번 그린 뒤 텍스처로 굳히기 때문에, 글꼴이 늦게 도착하면 이미 그려진
 * 글자가 대체 글꼴 상태로 남는다. 그래서 첫 화면을 띄우기 전 부트에서 한 번만 기다린다.
 * 실패는 삼키고 대체 글꼴로 계속 진행한다 — 글꼴 하나 때문에 게임이 멈추지는 않는다.
 */
export function loadGameFonts(): Promise<void> {
  if (loading) return loading;
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  if (!fonts) return (loading = Promise.resolve());
  loading = Promise.all(
    FONT_FACES.map(async (face) => {
      try {
        const loaded = await new FontFace(FONT_FAMILY_NAME, `url(${face.file}) format("woff2")`, {
          weight: `${face.weight}`,
        }).load();
        fonts.add(loaded);
      } catch {
        // 굵기 하나가 실패해도 나머지는 살린다.
      }
    }),
  ).then(() => undefined);
  return loading;
}
