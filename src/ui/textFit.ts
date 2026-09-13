import Phaser from "phaser";
import { fitFontSize, fitScaleX, fitSingleLineSize, fitsIn, type TextBox } from "../core/textFit";
import { getTextScale } from "./textScale";
import { countFittedText, reportClampedText } from "../debug";

/**
 * 이미 그린 글자를 **제 칸 안에 넣는다.**
 *
 * 규칙(무엇을 얼마나 줄일까)은 `src/core/textFit.ts`가 갖고, 여기서는 실제 Phaser Text로 재고
 * 적용하기만 한다. 화면이 저마다 눈대중으로 줄이면 같은 글이 어디서는 잘리고 어디서는 판 밖으로
 * 나가므로, 줄이는 일은 이 두 함수만 한다.
 *
 * **언어가 바뀌면 같은 문장이 다른 크기로 선다** — 그것이 이 파일이 있는 이유다. 한국어에서
 * 넉넉하던 이름표가 영어에서 두 배로 길어지고, 스킬 설명 한 문장은 일본어에서 줄이 더 는다.
 */

/**
 * 한 줄 이름표를 **가로로만** 눌러 칸에 넣는다(탭·칸 제목처럼 폭이 고정된 자리).
 *
 * 글자 크기를 줄이지 않는 이유는 여러 칸이 나란히 선 줄에서 한 칸만 작아지면 그 칸이 덜 중요한
 * 것처럼 읽히기 때문이다. 세로 크기가 그대로라 줄의 무게가 유지된다.
 */
export function squeezeTextToWidth(text: Phaser.GameObjects.Text, room: number, minScale = 0.68): Phaser.GameObjects.Text {
  // 이미 눌러 둔 배율 위에 다시 누르지 않도록 폭은 언제나 배율 1에서 잰다.
  text.setScale(1, text.scaleY);
  countFittedText();
  const scaleX = fitScaleX(text.width, room, minScale);
  // 하한까지 눌러도 들지 않으면 넘친 채로 남는다 — 그 사실만 검사 채널에 남긴다.
  if (text.width * scaleX > room + 0.5) reportClampedText(text.text, text.width * scaleX, room);
  return text.setScale(scaleX, text.scaleY);
}

/** 줄바꿈·크기 맞춤이 쓰는 값. `size`는 접근성 배율을 **먹이기 전**의 px다. */
export interface FitTextOptions {
  /** 처음 써 보는 크기(px). 생략하면 지금 글자의 크기에서 시작한다. */
  size?: number;
  /** 여기까지만 줄인다. 기본은 시작 크기의 72%이고 18px 아래로는 내려가지 않는다. */
  minSize?: number;
  /** 한 번에 낮추는 폭(px). */
  step?: number;
}

/** 지금 글자에 물린 크기(px)를 접근성 배율을 벗긴 값으로 읽는다. */
function baseSize(text: Phaser.GameObjects.Text): number {
  const raw = Number.parseFloat(String(text.style.fontSize)) || 24;
  return Math.max(1, Math.round(raw / getTextScale()));
}

/**
 * 여러 줄로 흐르는 글을 **칸 안에 들 때까지 크기를 낮춰** 앉힌다.
 *
 * 한 줄 이름표(`squeezeTextToWidth`)와 다른 축이다 — 가로로 눌러도 줄 수는 그대로라 세로가
 * 줄지 않는다. 크기를 낮춰야 같은 폭에 더 많은 글자가 들어가 줄이 준다.
 *
 * 줄바꿈 폭은 언제나 칸의 폭이다. 높이를 주지 않으면 폭만 맞추고(제목 한 줄), 주면 그 높이
 * 안에 들 때까지 낮춘다(스킬 설명처럼 판이 정해진 본문).
 *
 * 하한까지 낮춰도 들지 않으면 하한에서 멈춘다 — 넘치더라도 읽을 수 있는 글자로 남기는 편이
 * 낫고, 그때는 글자가 아니라 판을 손봐야 한다는 신호다.
 */
export function fitTextToBox(text: Phaser.GameObjects.Text, box: TextBox, options: FitTextOptions = {}): Phaser.GameObjects.Text {
  countFittedText();
  const start = Math.round(options.size ?? baseSize(text));
  // 기본 하한은 시작 크기의 72%다. 그보다 작아지면 같은 판 안의 다른 글과 위계가 뒤집힌다.
  const minSize = Math.max(18, Math.round(options.minSize ?? start * 0.72));
  const scale = getTextScale();
  const chosen = fitFontSize(box, (size) => {
    // 접근성 배율은 모든 글자가 거치는 계층이므로 잴 때도 함께 먹인다.
    text.setFontSize(Math.round(size * scale));
    text.setWordWrapWidth(box.width);
    return { width: text.width, height: text.height };
  }, { size: start, minSize: Math.min(start, minSize), step: options.step });
  text.setFontSize(Math.round(chosen * scale));
  text.setWordWrapWidth(box.width);
  if (!fitsIn({ width: text.width, height: text.height }, box)) reportClampedText(text.text, text.width, box.width);
  return text;
}

/**
 * 한 줄 제목을 **글자 크기를 낮춰** 칸에 넣는다(스킬 이름·팝업 머리글처럼 긴 문장이 오는 자리).
 *
 * 가로로 누르지 않는 이유는 긴 문장을 반으로 누르면 획이 서로 붙어 읽을 수 없기 때문이다.
 * 줄바꿈도 하지 않는다 — 제목 아래 줄은 자리가 고정되어 있어 두 줄이 되면 그 줄을 파고든다.
 */
export function shrinkTextToWidth(text: Phaser.GameObjects.Text, room: number, options: FitTextOptions = {}): Phaser.GameObjects.Text {
  countFittedText();
  const start = Math.round(options.size ?? baseSize(text));
  // 제목의 기본 하한은 시작 크기의 62%다. 본문(72%)보다 낮은 것은 제목이 원래 크기 때문이다 —
  // 46px의 62%도 28px이라 같은 판의 본문(28px)만큼은 남는다.
  const minSize = Math.max(16, Math.round(options.minSize ?? start * 0.62));
  const scale = getTextScale();
  const chosen = fitSingleLineSize((size) => {
    text.setFontSize(Math.round(size * scale));
    return text.width;
  }, room, { size: start, minSize: Math.min(start, minSize), step: options.step });
  text.setFontSize(Math.round(chosen * scale));
  if (text.width > room + 0.5) reportClampedText(text.text, text.width, room);
  return text;
}
