/**
 * 글자가 제 칸을 넘칠 때 **무엇을 얼마나 줄일까**를 정하는 순수 규칙.
 *
 * Phaser를 import하지 않는다 — 실제 글자 폭을 재는 일은 화면이 하고(`src/ui/textFit.ts`),
 * 여기서는 잰 값을 받아 **다음에 무엇을 해 볼까**만 고른다. 그래야 회귀 검사가 브라우저 없이
 * 같은 규칙을 돌려 볼 수 있다.
 *
 * **왜 필요한가.** 낱말 길이는 언어가 정하는데 칸 폭은 화면이 정한다 — 한국어 「연구」 두 글자가
 * 영어에서는 `Research Lab` 열두 글자이고, 스킬 설명 한 문장은 일본어에서 한 줄이 더 길어진다.
 * 값을 화면마다 눈대중으로 줄이면 같은 글이 어디서는 잘리고 어디서는 판 밖으로 나간다.
 */

/** 글자 한 덩어리의 실제 크기. 화면이 재서 넘긴다. */
export interface TextMetrics {
  width: number;
  height: number;
}

/** 들어가야 하는 칸. 높이를 주지 않으면 폭만 본다(한 줄짜리 이름표). */
export interface TextBox {
  width: number;
  height?: number;
}

/**
 * 한 줄 이름표를 **가로로만** 눌러 칸에 넣는다.
 *
 * 글자 크기를 줄이지 않고 가로 배율만 낮추는 이유는, 탭처럼 여러 칸이 나란히 선 줄에서 한 칸만
 * 글자가 작아지면 그 칸이 덜 중요한 것처럼 읽히기 때문이다. 세로 크기가 그대로라 줄의 무게가
 * 유지된다.
 *
 * **읽을 수 없어지기 전에 멈춘다.** 더 눌러야 들어가는 글은 거기서 넘치게 두고, 그때는 글자가
 * 아니라 칸을 손봐야 한다는 신호로 남긴다.
 */
export function fitScaleX(width: number, room: number, minScale: number): number {
  if (!(width > 0) || !(room > 0)) return 1;
  if (width <= room) return 1;
  return Math.max(minScale, room / width);
}

/** 크기를 낮춰 가며 재 볼 때 쓰는 설정. */
export interface FitFontSizeOptions {
  /** 처음 써 보는 크기(px). */
  size: number;
  /** 여기까지만 줄인다. 더 줄이면 읽을 수 없는 글자가 된다. */
  minSize: number;
  /** 한 번에 낮추는 폭(px). 1보다 작으면 1로 본다. */
  step?: number;
}

/**
 * 줄바꿈한 글 덩어리가 칸에 들 때까지 **글자 크기를 낮춘다.**
 *
 * 한 줄 이름표와 다른 축이다 — 그쪽은 가로로만 누르지만, 여러 줄로 흐르는 본문은 눌러도 줄 수가
 * 그대로라 세로가 줄지 않는다. 크기를 낮춰야 같은 폭에 더 많은 글자가 들어가 줄 수가 준다.
 *
 * `measure`는 그 크기로 **줄바꿈까지 마친** 덩어리의 크기를 돌려준다. 화면이 실제 Phaser Text로
 * 재므로 글꼴이 바뀌면 결과도 함께 바뀐다.
 *
 * 들어가는 가장 큰 크기를 돌려주고, 하한까지 낮춰도 들지 않으면 하한을 돌려준다 — 넘치더라도
 * 읽을 수 있는 글자로 남기는 편이 낫다.
 */
export function fitFontSize(box: TextBox, measure: (size: number) => TextMetrics, options: FitFontSizeOptions): number {
  const step = Math.max(1, Math.round(options.step ?? 1));
  const minSize = Math.max(1, Math.round(options.minSize));
  let size = Math.max(minSize, Math.round(options.size));
  while (size > minSize) {
    const metrics = measure(size);
    if (fitsIn(metrics, box)) return size;
    size = Math.max(minSize, size - step);
  }
  return size;
}

/**
 * 한 줄 제목을 **글자 크기를 낮춰** 칸에 넣는다.
 *
 * 이름표를 가로로 누르는 것(`fitScaleX`)과 다른 축이다 — 짧은 낱말은 눌러도 읽히지만, 제목처럼
 * 긴 문장을 반으로 누르면 획이 서로 붙어 읽을 수 없는 글자가 된다. 줄바꿈도 하지 않는다: 제목
 * 아래 줄은 자리가 고정되어 있어 두 줄이 되면 그 줄을 파고든다.
 */
export function fitSingleLineSize(measureWidth: (size: number) => number, room: number, options: FitFontSizeOptions): number {
  return fitFontSize({ width: room }, (size) => ({ width: measureWidth(size), height: 0 }), options);
}

/** 잰 덩어리가 칸 안에 드는가. 높이를 주지 않은 칸은 폭만 본다. */
export function fitsIn(metrics: TextMetrics, box: TextBox): boolean {
  if (metrics.width > box.width) return false;
  return box.height === undefined || metrics.height <= box.height;
}
