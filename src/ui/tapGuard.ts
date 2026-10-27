import Phaser from "phaser";
import { isTapDistance } from "../core/tapGuard";
import { pressOut } from "./pressFeedback";

export { TAP_DRAG_SLOP } from "../core/tapGuard";

/** 놓은 손이 끌기였다면 거짓이다. 누른 자리와 뗀 자리를 Phaser가 직접 재므로 화면이 거리를 따로 세지 않는다. */
export function isTap(pointer: Phaser.Input.Pointer): boolean {
  return isTapDistance(pointer.getDistance());
}

/**
 * 스크롤 목록 안의 칸에 거는 탭. 끌다 놓은 손에는 실행하지 않고, 눌림 표시를 조용히 되돌린다.
 * `press`를 주면 끌기로 끝난 손이 칸을 눌린 채 남기지 않는다.
 */
export function onTap(
  target: Phaser.GameObjects.GameObject,
  handler: (pointer: Phaser.Input.Pointer) => void,
  press?: Phaser.GameObjects.Container,
): void {
  target.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    if (!isTap(pointer)) {
      if (press) pressOut(press, "normal", { pop: false });
      return;
    }
    handler(pointer);
  });
}
