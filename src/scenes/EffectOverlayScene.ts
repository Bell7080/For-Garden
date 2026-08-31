import Phaser from "phaser";
import { EffectManager } from "../managers/EffectManager";

/**
 * 누른 자리에 답하는 얇은 겹 하나.
 *
 * 씬마다 클릭 이펙트를 붙이면 화면이 늘 때마다 빠뜨리고, 같은 조작이 어디서는 답하고
 * 어디서는 답하지 않는다. 그래서 **모든 씬 위에 늘 떠 있는 한 겹**이 포인터를 듣는다.
 * 부트가 한 번 띄우면 씬이 바뀌어도 그대로 남는다(`launch`는 아래 씬을 멈추지 않는다).
 *
 * 결은 두 가지다.
 * - 메뉴에서는 **근미래 홀로그램 장비를 누른 손맛** — 얇은 마름모 파문 한 겹이 빠르게 지나간다.
 * - 전장에서는 **작게 톡 튀는 조각 셋** — 단순한 SD가 뚜따시하는 화면과 같은 결이다.
 *
 * 이 겹은 아무것도 가로채지 않는다. 표시 객체에 입력을 걸지 않으므로 아래 씬의 버튼은
 * 평소대로 눌린다.
 */
export class EffectOverlayScene extends Phaser.Scene {
  static readonly KEY = "effect-overlay";

  private effects!: EffectManager;

  constructor() {
    super(EffectOverlayScene.KEY);
  }

  create(): void {
    this.effects = new EffectManager(this, { depth: 0, shake: false });
    this.scene.bringToTop();
    // 모바일 우선 입력이라 손이 닿는 순간 답한다 — 떼는 순간까지 기다리면 눌린 느낌이 늦다.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      // 씬이 바뀌면 새 씬이 위로 올라오므로 누를 때마다 다시 맨 앞으로 세운다.
      this.scene.bringToTop();
      // 이 겹에는 입력을 받는 표시 객체가 없어 hit test가 돌지 않으므로 `worldX`가 갱신되지
      // 않는다. FIT 배율은 포인터를 이미 게임 좌표로 옮겨 두므로 `x`·`y`를 그대로 쓴다.
      this.effects.tap(pointer.x, pointer.y, this.scene.isActive("battle") ? "tapBattle" : "tap");
    });
  }
}
