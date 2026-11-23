import Phaser from "phaser";

/**
 * 부서진 글자에 다시 쓰면 아무 일도 하지 않게 한다.
 *
 * Phaser Text는 `destroy` 때 캔버스·컨텍스트를 놓는데, 판이 닫힌 뒤 남은 시계·트윈·입력 처리가 `setText`·`setColor`를
 * 한 번 더 부르면 `updateText`가 놓은 캔버스를 읽다 던진다 — 입력 처리 중이면 프레임 보호(`guardFrame`) 밖이라 창 오류로
 * 남는다(client_errors #47·#49·#50). 원인은 자리마다 막되, 새 화면이 같은 실수를 해도 게임이 멎지 않게 여기서 한 번 더 받는다.
 */
export function installDestroyedTextGuard(textClass: { prototype: Phaser.GameObjects.Text } = Phaser.GameObjects.Text): void {
  const proto = textClass.prototype as Phaser.GameObjects.Text & { __destroyedGuard?: boolean };
  if (proto.__destroyedGuard) return;
  const original = proto.updateText;
  proto.updateText = function guardedUpdateText(this: Phaser.GameObjects.Text) {
    if (!this.canvas || !this.context) return this;
    return original.call(this);
  };
  proto.__destroyedGuard = true;
}
