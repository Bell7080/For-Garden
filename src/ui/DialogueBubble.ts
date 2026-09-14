import Phaser from "phaser";
import {
  DIALOGUE_BUBBLE, dialogueBubbleCenterY, dialogueBubbleHeight, dialogueBubbleWrap,
  type DialogueBubbleAnchor,
} from "./dialogueBubbleLayout";
import { drawLayer, drawShapeEdge, slantedRect } from "./holo";
import { addSectionTitle } from "./SectionTitle";
import { setDebugBubble } from "../debug";
import { COLOR, textStyle } from "./theme";

/**
 * 공용 대사창.
 *
 * **누가 말하는지는 윗변에 걸터앉은 이름표가, 무슨 말인지는 그 아래 한 겹의 띠가 맡는다.**
 * 예전에는 화면마다 제 띠를 그렸다 — 로비는 이름과 대사를 한 판에 넣고 그 사이를 선으로 갈랐고
 * (그만큼 판이 두꺼워 캐릭터를 가렸다), 상점은 같은 코드를 옮겨 적었다. 지금은 이 한 장이
 * 그 자리를 모두 맡고, 화면은 **어디에 얼마나 넓게 세울지**만 고른다.
 *
 * 자리를 비우는 규칙도 여기 있다: 고를 것이 없는 말이라 잠깐 떠올랐다 스스로 사라지고,
 * 같은 캐릭터를 다시 누르면 앞의 말을 지우고 새 말이 선다.
 */
export interface DialogueBubbleOptions {
  /** 띠의 가로 가운데. */
  centerX: number;
  width: number;
  /** 띠를 거는 변의 y. `anchor`가 어느 변인지 정한다. */
  y: number;
  /** 기본은 밑변이다 — 대사가 길어져도 아래(조작 줄 쪽)로 자라지 않는다. */
  anchor?: DialogueBubbleAnchor;
  bodySize?: number;
  nameSize?: number;
  minHeight?: number;
  depth?: number;
  /** 담을 컨테이너. 주지 않으면 씬에 바로 올린다. */
  parent?: Phaser.GameObjects.Container;
}

/** 한 화면에 한 장만 두고 계속 갈아 끼운다. 말할 때마다 새로 만들면 옛 띠가 겹쳐 남는다. */
export class DialogueBubble extends Phaser.GameObjects.Container {
  private readonly options: Required<Pick<DialogueBubbleOptions, "centerX" | "width" | "y" | "anchor" | "bodySize" | "nameSize" | "minHeight">>;
  /** 말이 바뀔 때마다 오르는 세대. 늦게 끝난 사라짐이 새 대사를 지우지 못하게 한다. */
  private generation = 0;
  /** 머무는 시간을 재는 타이머. 다음 말이 서면 앞의 것을 함께 버린다. */
  private fade?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, options: DialogueBubbleOptions) {
    super(scene, 0, 0);
    this.options = {
      centerX: options.centerX,
      width: options.width,
      y: options.y,
      anchor: options.anchor ?? "bottom",
      bodySize: options.bodySize ?? DIALOGUE_BUBBLE.bodySize,
      nameSize: options.nameSize ?? DIALOGUE_BUBBLE.nameSize,
      minHeight: options.minHeight ?? DIALOGUE_BUBBLE.minHeight,
    };
    this.setDepth(options.depth ?? 500).setVisible(false);
    options.parent?.add(this);
    if (!options.parent) scene.add.existing(this);
  }

  /**
   * 한 마디 띄운다.
   *
   * 높이는 손으로 적지 않고 **실제 글 높이에서 거꾸로 구한다** — 대사가 길어지거나 언어를
   * 바꿀 때마다 아래 여백이 어긋나지 않는다.
   */
  say(name: string, line: string, options: { holdMs?: number; slideX?: number } = {}): void {
    const generation = ++this.generation;
    // 띠는 잠깐 떴다 스스로 사라져 캡처 사이로 빠져나간다 — 검사 채널이 실제로 섰는지를 남긴다.
    setDebugBubble({ name, body: line });
    this.scene.tweens.killTweensOf(this);
    this.removeAll(true);

    const { width, bodySize, nameSize, minHeight } = this.options;
    const body = this.scene.add
      .text(0, 0, line, textStyle({ role: "body", size: bodySize, color: COLOR.ink, wrap: dialogueBubbleWrap(width), lineSpacing: DIALOGUE_BUBBLE.lineSpacing }))
      .setOrigin(0, 0);
    const height = dialogueBubbleHeight(body.height, minHeight);
    const shape = slantedRect(width, height, DIALOGUE_BUBBLE.slant);

    // 띠는 거의 불투명하다 — 배경 원화가 아무리 밝아도 글자가 뭉개지면 안 되고, 그 대신
    // 높이를 글 만큼으로만 잡아 가리는 넓이를 줄인다.
    this.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x05070a, alpha: 0.92, shadow: false }));
    // 선은 판의 변을 그대로 따라 긋는다. 수평으로 그으면 기울어진 띠와 어긋나 두 겹으로 보인다.
    this.add(drawShapeEdge(this.scene, 0, 0, shape, "top", { color: COLOR.accent, alpha: 0.85, inset: 6 }));
    this.add(drawShapeEdge(this.scene, 0, 0, shape, "bottom", { color: COLOR.accent, alpha: 0.28, inset: 6 }));

    body.setPosition(-width / 2 + DIALOGUE_BUBBLE.padX, -height / 2 + DIALOGUE_BUBBLE.padTop);
    this.add(body);
    // 이름표는 띠 **안**이 아니라 윗변에 걸터앉는다 — 안팎의 경계에 서야 이름과 대사가
    // 선 하나 없이도 갈리고, 화면 어디서나 쓰는 제목표와 같은 문법으로 읽힌다.
    addSectionTitle(this.scene, -width / 2 + DIALOGUE_BUBBLE.nameInset, -height / 2, name, { size: nameSize, parent: this });

    const centerY = dialogueBubbleCenterY(this.options.y, height, this.options.anchor);
    // 기본은 아래에서 떠오르는 것이고, 화면이 조립되는 자리에서만 옆에서 밀려 들어온다.
    const slideX = options.slideX ?? 0;
    this.setPosition(this.options.centerX + slideX, centerY + (slideX ? 0 : DIALOGUE_BUBBLE.rise)).setAlpha(0).setVisible(true);
    this.scene.tweens.add({
      targets: this, alpha: 1, x: this.options.centerX, y: centerY,
      duration: slideX ? DIALOGUE_BUBBLE.riseMs * 1.7 : DIALOGUE_BUBBLE.riseMs, ease: "Cubic.Out",
    });
    /*
     * **사라짐은 지연 tween이 아니라 타이머가 연다.**
     *
     * 들어오는 tween과 나가는 tween을 같은 순간에 걸면 둘이 같은 `alpha`·`y`를 두고 매 프레임
     * 번갈아 쓴다 — 지연 중인 tween이 만들어질 때 붙잡은 시작값(그때는 alpha 0)을 계속 되쓰기
     * 때문에, 띠가 뜨자마자 흐려졌다가 이내 사라졌다. 나가는 몫은 들어오는 tween이 끝난 뒤에
     * 하나만 돈다.
     */
    this.fade?.remove(false);
    this.fade = this.scene.time.delayedCall(options.holdMs ?? DIALOGUE_BUBBLE.holdMs, () => {
      if (generation !== this.generation) return;
      this.scene.tweens.add({
        targets: this, alpha: 0, x: this.options.centerX, y: centerY - DIALOGUE_BUBBLE.rise * 2, duration: DIALOGUE_BUBBLE.fadeMs,
        onComplete: () => { if (generation === this.generation) this.hideNow(); },
      });
    });
  }

  /** 화면을 닫을 때처럼 곧바로 치운다. */
  hideNow(): void {
    this.generation += 1;
    setDebugBubble(undefined);
    this.fade?.remove(false);
    this.fade = undefined;
    this.scene?.tweens.killTweensOf(this);
    this.removeAll(true);
    this.setVisible(false);
  }
}
