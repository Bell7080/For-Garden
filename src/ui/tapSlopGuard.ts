import Phaser from "phaser";
import { isTapDistance } from "../core/tapGuard";

/**
 * **끌기로 끝난 손은 칸을 누른 것이 아니다.** 스크롤하려던 손가락이 룬·카드·줄 위에서 떨어지면 Phaser는 그
 * 개체에 `pointerup`을 주고, 화면마다 거리를 재서 걸러야 했다(빠뜨린 칸이 눌렸다). 개체의 `pointerup`을 한 곳에서
 * 걸러, 누른 자리에서 `TAP_DRAG_SLOP`을 넘게 움직인 손은 그 개체의 `pointerup` 대신 `pointerout`(눌림을 조용히
 * 되돌린다)로 알린다. 끌어서 쓰는 개체(`draggable`)와 `data: allowLongPointerUp`을 켠 개체는 건드리지 않는다.
 */
let installed = false;

export function installTapSlopGuard(): void {
  if (installed) return;
  installed = true;
  const proto = Phaser.GameObjects.GameObject.prototype as unknown as { emit: (event: string, ...args: unknown[]) => boolean };
  const original = proto.emit;
  proto.emit = function guardedEmit(this: Phaser.GameObjects.GameObject, event: string, ...args: unknown[]): boolean {
    if (event === "pointerup") {
      const pointer = args[0] as Phaser.Input.Pointer | undefined;
      if (pointer && typeof pointer.getDistance === "function" && !isTapDistance(pointer.getDistance())
        && !this.input?.draggable && !this.getData?.("allowLongPointerUp")) {
        return original.call(this, "pointerout", pointer, ...args.slice(1, 2));
      }
    }
    return original.call(this, event, ...args);
  };
}
