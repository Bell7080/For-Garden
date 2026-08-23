import Phaser from "phaser";
import { chipPoints, drawLayer, drawShapeEdge, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 팝업 한 장을 여는 데 필요한 것. 내용은 콜백이 컨테이너에 직접 채운다. */
export interface PopupOptions {
  width: number;
  height: number;
  /** 판 위쪽에 얹는 짧은 제목. 비우면 제목 줄을 만들지 않는다. */
  title?: string;
  /** 판 가운데가 놓일 자리. 비우면 화면 가운데다. */
  x?: number;
  y?: number;
  /** 판을 몇 도 기울일지. 정보창의 다른 판과 결을 맞출 때 쓴다. */
  tilt?: number;
  /** 판 바깥을 눌러 닫을 수 있는지. 무엇을 고르는 팝업은 끄고 읽는 팝업은 켠다. */
  closeOnBackdrop?: boolean;
  /**
   * 뒤 화면을 어둡게 덮을지.
   *
   * 기본은 덮지 않는다. 스킬이나 용어를 읽는 팝업은 **누른 자리 위에 얹히는 쪽지**여야지,
   * 화면을 새로 채우는 다른 장면이 되면 안 된다. 젬을 고르는 것처럼 그 순간 다른 조작을
   * 막아야 하는 팝업만 켠다.
   */
  dim?: boolean;
  /**
   * 누른 자리. 주면 그 위(자리가 없으면 아래)에 붙는다.
   * 화면 밖으로 나가지 않도록 가장자리에서 안쪽으로 밀어 넣는다.
   */
  anchor?: { x: number; y: number };
  /** 닫힐 때 부르는 콜백. 누른 버튼이 눌린 상태를 되돌릴 때 쓴다. */
  onClose?: () => void;
}

/**
 * 씬 하나가 공유하는 팝업 더미.
 *
 * 스킬을 누르면 스킬 팝업이 뜨고, 그 안의 강조된 말을 누르면 그 위에 용어 팝업이 또 뜬다.
 * 화면마다 따로 만들면 층이 엉키고 닫는 규칙이 갈라지므로, 쌓고 닫는 일은 여기서만 한다.
 * 위에 있는 것부터 닫히고, 마지막 한 장이 닫히면 어두운 막도 함께 사라진다.
 */
export class PopupLayer {
  private readonly stack: Phaser.GameObjects.Container[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly depth = 2000) {}

  get isOpen(): boolean {
    return this.stack.length > 0;
  }

  /** 파괴적 동작이 화면마다 제각각 구현되지 않도록 같은 팝업 위에 확인/취소를 제공한다. */
  confirm(options: { title: string; message: string; confirmLabel: string; destructive?: boolean }, onConfirm: () => void): void {
    this.open({ width: 820, height: 390, title: options.title, dim: true, closeOnBackdrop: false }, (body, close) => {
      body.add(this.scene.add.text(-350, -75, options.message, textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setWordWrapWidth(700));
      const addAction = (x: number, label: string, color: string, action: () => void): void => {
        const button = this.scene.add.text(x, 105, label, textStyle({ role: "emphasis", size: 28, color })).setOrigin(0.5).setInteractive({ useHandCursor: true });
        button.on("pointerdown", () => button.setScale(1.1));
        button.on("pointerout", () => button.setScale(1));
        button.on("pointerup", action);
        body.add(button);
      };
      addAction(-150, "취소", COLOR.inkDim, close);
      addAction(150, options.confirmLabel, options.destructive ? "#ff8c88" : COLOR.accentText, () => { close(); onConfirm(); });
    });
  }

  /** 팝업 한 장을 연다. `build`는 판 가운데를 원점으로 하는 컨테이너를 받는다. */
  open(
    options: PopupOptions,
    build: (body: Phaser.GameObjects.Container, close: () => void) => void,
  ): Phaser.GameObjects.Container {
    const { width, height } = options;
    const screen = { width: this.scene.scale.width, height: this.scene.scale.height };
    const anchored = this.anchorPosition(options, screen);
    const cx = anchored?.x ?? options.x ?? screen.width / 2;
    const cy = anchored?.y ?? options.y ?? screen.height / 2;
    const layer = this.scene.add.container(0, 0).setDepth(this.depth + this.stack.length * 2);

    // 바깥을 눌러 닫을 수 있게 투명한 판을 깐다. 고르는 팝업만 실제로 어둡게 덮는다.
    const backdrop = this.scene.add
      .rectangle(screen.width / 2, screen.height / 2, screen.width, screen.height, 0x05070a, options.dim ? 0.55 : 0)
      .setInteractive();
    layer.add(backdrop);

    const body = this.scene.add.container(cx, cy);
    if (options.tilt) body.setRotation(Phaser.Math.DegToRad(options.tilt));
    const unit = Math.min(width, height);
    const shape = chipPoints(width, height, {
      bevel: { topLeft: unit * 0.14, topRight: 0, bottomRight: unit * 0.14, bottomLeft: 0 },
    });
    body.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x0b0f15, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.6 }));
    body.add(drawShapeEdge(this.scene, 0, 0, shape, "bottom", { color: COLOR.accent, alpha: 0.3, inset: 12 }));
    layer.add(body);

    const close = (): void => {
      this.close(layer);
      options.onClose?.();
    };
    if (options.title) {
      body.add(
        this.scene.add
          .text(-width / 2 + unit * 0.12, -height / 2 + 24, options.title, textStyle({ role: "display", size: 30 }))
          .setOrigin(0, 0),
      );
      // 닫기는 오른쪽 위 구석. 어느 팝업에서나 같은 자리에 둔다.
      const closeButton = this.scene.add.container(width / 2 - 40, -height / 2 + 40);
      const mark = this.scene.add.graphics();
      mark.lineStyle(HOLO.lineWidth + 1, 0xc9ccd2, 0.9);
      mark.lineBetween(-13, -13, 13, 13);
      mark.lineBetween(13, -13, -13, 13);
      closeButton.add(mark);
      const hit = this.scene.add.rectangle(width / 2 - 40, -height / 2 + 40, 84, 84, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => closeButton.setScale(1.15));
      hit.on("pointerout", () => closeButton.setScale(1));
      hit.on("pointerup", () => close());
      body.add([closeButton, hit]);
    }
    if (options.closeOnBackdrop !== false) backdrop.on("pointerup", () => close());

    build(body, close);

    // 살짝 커지며 떠오른다. 정보창의 다른 판과 같은 등장 방식이다.
    layer.setAlpha(0);
    body.setScale(0.96);
    this.scene.tweens.add({ targets: layer, alpha: 1, duration: 160 });
    this.scene.tweens.add({ targets: body, scale: 1, duration: 200, ease: "Cubic.Out" });

    this.stack.push(layer);
    return body;
  }

  /**
   * 누른 자리 위(자리가 없으면 아래)에 붙는 좌표.
   *
   * 화면 밖으로 넘치면 안쪽으로 밀어 넣는다. 쪽지가 잘려 보이면 읽을 수 없기 때문이다.
   */
  private anchorPosition(options: PopupOptions, screen: { width: number; height: number }): { x: number; y: number } | undefined {
    if (!options.anchor) return undefined;
    const margin = 24;
    const gap = 34;
    const above = options.anchor.y - options.height / 2 - gap;
    const y = above - options.height / 2 >= margin ? above : options.anchor.y + options.height / 2 + gap;
    return {
      x: Phaser.Math.Clamp(options.anchor.x, options.width / 2 + margin, screen.width - options.width / 2 - margin),
      y: Phaser.Math.Clamp(y, options.height / 2 + margin, screen.height - options.height / 2 - margin),
    };
  }

  /** 맨 위 한 장만 닫는다. */
  closeTop(): void {
    const top = this.stack[this.stack.length - 1];
    if (top) this.close(top);
  }

  closeAll(): void {
    while (this.stack.length > 0) this.closeTop();
  }

  private close(layer: Phaser.GameObjects.Container): void {
    const index = this.stack.indexOf(layer);
    if (index === -1) return;
    this.stack.splice(index, 1);
    layer.destroy();
  }
}
