import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { settingsManager } from "../managers/SettingsManager";
import { COLOR, textStyle } from "./theme";

/** 튜토리얼 안내가 서는 깊이. 팝업(2200~2400)과 결과판(5000대)보다 위다. */
export const TUTORIAL_SPOTLIGHT_DEPTH = 6000;

export interface TutorialSpotlightOptions {
  /** 밝게 남길 자리(씬 좌표). 이 안의 입력만 아래 화면으로 지나간다. */
  rect: { x: number; y: number; width: number; height: number };
  text: string;
  /** 안내 글이 구멍 위에 서는지 아래에 서는지. 기본은 위이고, 위가 모자라면 아래로 뒤집는다. */
  side?: "above" | "below";
  /** 있으면 구석에 「건너뛰기」가 서고, 누르면 이 함수를 부른다. */
  onSkip?: () => void;
  skipLabel?: string;
  depth?: number;
}

const HOLE_PAD = 14;
const DIM_ALPHA = 0.66;

/**
 * 화면을 어둡게 덮고 한 자리만 밝게 뚫어 가리키는 튜토리얼 안내.
 *
 * **조각마다 객체를 얹어 깊이를 만지지 않는다.** 가리킬 것이 팝업 안의 버튼이든 하단 탭이든 그 위치(bounds)만
 * 알면 되도록, 구멍 둘레에 어두운 막 네 장을 두르고 구멍은 비워 둔다 — 구멍 안의 눌림은 아래 화면이 그대로
 * 받고, 막이 덮은 곳은 막이 삼킨다. 호출한 쪽은 구멍 안의 조작이 일어나면 `destroy()`로 걷는다.
 */
export class TutorialSpotlight {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene, options: TutorialSpotlightOptions) {
    const depth = options.depth ?? TUTORIAL_SPOTLIGHT_DEPTH;
    const left = Math.max(0, options.rect.x - HOLE_PAD);
    const top = Math.max(0, options.rect.y - HOLE_PAD);
    const right = Math.min(BASE_WIDTH, options.rect.x + options.rect.width + HOLE_PAD);
    const bottom = Math.min(BASE_HEIGHT, options.rect.y + options.rect.height + HOLE_PAD);
    const dim = (x: number, y: number, width: number, height: number): void => {
      if (width <= 0 || height <= 0) return;
      this.objects.push(scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0x000000, DIM_ALPHA).setDepth(depth).setInteractive());
    };
    dim(0, 0, BASE_WIDTH, top);
    dim(0, bottom, BASE_WIDTH, BASE_HEIGHT - bottom);
    dim(0, top, left, bottom - top);
    dim(right, top, BASE_WIDTH - right, bottom - top);

    // 구멍 둘레의 얇은 강조선 — 어디까지가 눌러야 할 자리인지 말한다.
    const frame = scene.add.graphics().setDepth(depth + 1);
    frame.lineStyle(4, COLOR.accent, 0.95);
    frame.strokeRect(left, top, right - left, bottom - top);
    this.objects.push(frame);

    const roomAbove = top;
    const side = options.side === "below" || (options.side !== "above" && roomAbove < 260) ? "below" : "above";
    const cx = Math.min(BASE_WIDTH - 60, Math.max(60, (left + right) / 2));
    const textY = side === "above" ? top - 150 : bottom + 150;
    const arrowY = side === "above" ? top - 44 : bottom + 44;
    const label = scene.add.text(BASE_WIDTH / 2, textY, options.text, textStyle({ role: "display", size: 42, color: COLOR.accentText, wrap: BASE_WIDTH - 160, align: "center" }))
      .setOrigin(0.5).setDepth(depth + 2).setShadow(3, 4, "#05070a", 0, true, true);
    const arrow = scene.add.text(cx, arrowY, side === "above" ? "▼" : "▲", textStyle({ role: "display", size: 56, color: COLOR.accentText }))
      .setOrigin(0.5).setDepth(depth + 2);
    this.objects.push(label, arrow);
    if (!settingsManager.get().accessibility.reduceMotion) {
      scene.tweens.add({ targets: arrow, y: arrow.y + (side === "above" ? 16 : -16), duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    if (options.onSkip) {
      const onSkip = options.onSkip;
      const skip = scene.add.text(BASE_WIDTH - 48, 64, options.skipLabel ?? "", textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim }))
        .setOrigin(1, 0).setDepth(depth + 3).setInteractive({ useHandCursor: true });
      skip.on("pointerup", () => onSkip());
      this.objects.push(skip);
    }
  }

  get active(): boolean { return !this.destroyed; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const object of this.objects) {
      if (!object.scene) continue;
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.objects.length = 0;
  }
}
