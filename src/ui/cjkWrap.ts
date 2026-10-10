import Phaser from "phaser";
import { needsCharWrap, wrapByCharacter } from "../core/cjkWrap";

let installed = false;

/**
 * Phaser Text의 줄바꿈이 공백 없는 언어에서도 폭 안에 들도록 한 번만 고친다.
 *
 * 기본 알고리즘은 공백에서만 끊어 일본어·중국어 대사가 판 밖으로 나갔다. 글자 사이 줄바꿈이
 * 필요한 문자가 있을 때만 `core/cjkWrap`의 규칙을 쓰고, 나머지는 Phaser 원래 길을 그대로 탄다.
 */
export function installCjkWrap(): void {
  if (installed) return;
  installed = true;
  const proto = Phaser.GameObjects.Text.prototype;
  const original = proto.runWordWrap;
  proto.runWordWrap = function patched(this: Phaser.GameObjects.Text, text: string): string {
    const width = this.style.wordWrapWidth;
    if (!this.style.wordWrapCallback && width && needsCharWrap(text)) {
      const context = this.context;
      return wrapByCharacter(text, width, (line) => context.measureText(line).width);
    }
    return original.call(this, text);
  };
}
