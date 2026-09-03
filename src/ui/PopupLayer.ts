import Phaser from "phaser";
import { chipPoints, drawLayer, drawShapeEdge, HOLO } from "./holo";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";
import { setDebugPopupTitles } from "../debug";
import { POPUP_CLOSE_LAYOUT, tiltedPopupSize } from "./popupGeometry";

/** 쪽지와 화면을 대부분 차지하는 작업판이 공유하는 제목 위계다. */
export const POPUP_TITLE_SIZE = {
  note: 26,
  workboard: 34,
} as const;

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
  /** `dim`을 켰을 때의 암전 불투명도. 중첩 팝업은 낮은 값으로 화면의 깊이만 더한다. */
  dimAlpha?: number;
  /** 공용 쪽지 제목보다 더 강한 결과·작업판 제목처럼 시각적 위계가 달라야 할 때만 지정한다. */
  titleSize?: number;
  /** 화면 자체의 뒤로가기 조작을 쓰는 큰 패널은 팝업 모서리의 중복 X를 숨긴다. */
  hideCloseButton?: boolean;
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
/**
 * 지금 화면에 떠 있는 팝업 장 수. 씬이 아니라 이 경계가 세는 이유는, 팝업 레이어가 화면마다
 * 그때그때 새로 만들어져 씬이 제 층을 전부 알지 못하기 때문이다. 전투는 이 값으로 코어 시간만
 * 멈춘다 — 판이 떠 있는 동안 뒤에서 전투가 굴러가면 읽는 사이에 판이 갈린다.
 */
let openLayerCount = 0;

/** 팝업이 한 장이라도 떠 있는가. */
export function anyPopupOpen(): boolean {
  return openLayerCount > 0;
}

export class PopupLayer {
  private readonly stack: Phaser.GameObjects.Container[] = [];
  /** 외부 뒤로가기가 `closeTop`을 호출해도 팝업 소유자의 정리 콜백을 빠뜨리지 않는다. */
  private readonly onCloseByLayer = new Map<Phaser.GameObjects.Container, (() => void) | undefined>();
  /** 판 소유자가 나중에 채운 내용 위로 머리글을 다시 올릴 수 있게 판별 본문마다 보관한다. */
  private readonly chromeByBody = new Map<Phaser.GameObjects.Container, Phaser.GameObjects.GameObject[]>();
  /** 제목 있는 팝업만 E2E 관찰용으로 기록한다. Canvas 밖에서는 지금 무엇이 열려 있는지 알 방법이 없다. */
  private readonly titleByLayer = new Map<Phaser.GameObjects.Container, string>();

  /** 씬 종료 정리를 이미 걸었는지. 첫 팝업을 열 때 한 번만 건다. */
  private shutdownHooked = false;

  constructor(private readonly scene: Phaser.Scene, private readonly depth = 2000) {}

  /**
   * 씬이 통째로 내려가면 `layer.destroy()`가 `close()`를 거치지 않으므로 셈만 직접 되돌린다.
   *
   * **생성자에서 걸지 않는다.** 팝업 층을 필드 초기화로 두는 씬(상점·프리미엄·환경설정)은 이
   * 생성자가 씬 생성자 안에서 도는데, 그때 `scene.events`는 아직 없다 — 거기서 건드리면 게임이
   * 부팅되는 순간 모든 씬이 만들어지며 통째로 죽는다(v0.55.8이 그랬다).
   */
  private hookShutdown(): void {
    if (this.shutdownHooked) return;
    this.shutdownHooked = true;
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      openLayerCount -= this.stack.length;
      this.stack.length = 0;
      this.shutdownHooked = false;
    });
  }

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

    // 바깥을 눌러 닫을 수 있게 투명한 판을 깐다. 명시한 강도는 중첩 암전이 과해지는 것을 막는다.
    const dimAlpha = options.dim ? Phaser.Math.Clamp(options.dimAlpha ?? 0.55, 0, 1) : 0;
    const backdrop = this.scene.add
      .rectangle(screen.width / 2, screen.height / 2, screen.width, screen.height, 0x05070a, dimAlpha)
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

    // 닫기 경로(내부 X·배경·외부 뒤로가기)에 관계없이 정리 콜백은 close() 한 곳에서 정확히 한 번 돈다.
    this.onCloseByLayer.set(layer, options.onClose);
    const close = (): void => { this.close(layer); };
    const titleChrome: Phaser.GameObjects.GameObject[] = [];
    if (options.title) {
      // 머리글은 판 안이 아니라 **윗변에 걸터앉는다.** 정보창의 칸 제목(유대·능력치·룬)과
      // 같은 표를 써서, 어느 화면에서나 제목이 같은 무게와 같은 모양으로 읽히게 한다.
      // 비동기 조회가 끝난 뒤 본문이 추가되어도 머리글보다 앞에 그려지지 않도록 자식 depth를 고정한다.
      // 발굴 원화처럼 늦게 생성되는 큰 이미지가 `/발굴` 제목표를 덮던 문제도 이 한 규칙으로 막는다.
      titleChrome.push(addSectionTitle(this.scene, -width / 2 + unit * 0.1, -height / 2, options.title, { size: options.titleSize ?? POPUP_TITLE_SIZE.note, parent: body }).setDepth(1000));
      // 닫기는 기본적으로 오른쪽 위에 두되, 화면 chrome이 닫기를 맡으면 중복 조작을 만들지 않는다.
      if (!options.hideCloseButton) {
        const closeButton = this.scene.add.container(width / 2 - POPUP_CLOSE_LAYOUT.centerInset, -height / 2 + POPUP_CLOSE_LAYOUT.centerInset);
        const mark = this.scene.add.graphics();
        mark.lineStyle(HOLO.lineWidth + 1, 0xc9ccd2, 0.9);
        mark.lineBetween(-13, -13, 13, 13);
        mark.lineBetween(13, -13, -13, 13);
        closeButton.add(mark);
        const hit = this.scene.add.rectangle(width / 2 - POPUP_CLOSE_LAYOUT.centerInset, -height / 2 + POPUP_CLOSE_LAYOUT.centerInset, POPUP_CLOSE_LAYOUT.hitSize, POPUP_CLOSE_LAYOUT.hitSize, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => closeButton.setScale(1.15));
        hit.on("pointerout", () => closeButton.setScale(1));
        hit.on("pointerup", () => close());
        body.add([closeButton, hit]);
        closeButton.setDepth(1000); hit.setDepth(1000);
        titleChrome.push(closeButton, hit);
      }
    }
    if (options.closeOnBackdrop !== false) {
      // A popup is commonly created by another object's `pointerup`.  Registering the backdrop in that
      // same dispatch lets Phaser deliver the opening release to the newly-created backdrop as well, making
      // the note flash and disappear.  Arm dismissal on the next input frame so only a later outside click
      // can close it; controls inside the body remain above the backdrop and keep the note open.
      this.scene.time.delayedCall(0, () => {
        if (layer.active && backdrop.active) backdrop.on("pointerup", () => close());
      });
    }

    // Container는 자식의 depth로 순서를 바꾸지 않고 넣은 순서대로만 그린다. 그래서 머리글은
    // 판 소유자가 내용을 채울 때마다 다시 맨 위로 올려야 하고, 그 목록을 여기 남겨 둔다.
    this.chromeByBody.set(body, titleChrome);
    body.once(Phaser.GameObjects.Events.DESTROY, () => this.chromeByBody.delete(body));

    build(body, close);
    // 배경 원화를 까는 큰 팝업은 내용이 제목 뒤로 들어오므로, 채운 뒤 머리글을 한 번 더 맨 위로 올린다.
    this.raiseChrome(body);

    // 살짝 커지며 떠오른다. 정보창의 다른 판과 같은 등장 방식이다.
    layer.setAlpha(0);
    body.setScale(0.96);
    this.scene.tweens.add({ targets: layer, alpha: 1, duration: 160 });
    this.scene.tweens.add({ targets: body, scale: 1, duration: 200, ease: "Cubic.Out" });

    if (options.title) this.titleByLayer.set(layer, options.title);
    this.hookShutdown();
    this.stack.push(layer);
    openLayerCount += 1;
    this.publishDebugTitles();
    return body;
  }

  /** 지금 스택에 쌓인 제목만 Canvas 밖에 공개한다. 팝업 본문·게임 상태는 노출하지 않는다. */
  private publishDebugTitles(): void {
    setDebugPopupTitles(this.stack.map((layer) => this.titleByLayer.get(layer)).filter((title): title is string => title !== undefined));
  }

  /**
   * 머리글을 다시 맨 위로 올린다.
   *
   * `build`가 끝난 뒤에 배경 원화나 큰 이미지를 얹는 판은 그때마다 이걸 부른다. 팝업 안에서
   * 화면을 갈아 끼우는 발굴처럼, 늦게 만들어진 원화가 `/ 발굴` 제목표를 덮기 때문이다.
   */
  raiseChrome(body: Phaser.GameObjects.Container): void {
    for (const chrome of this.chromeByBody.get(body) ?? []) body.bringToTop(chrome);
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
    // 회전 전 width/height로 제한하면 기울어진 모서리와 그 안의 X 입력면이 안전 영역을 넘는다.
    const bounds = tiltedPopupSize(options.width, options.height, options.tilt);
    const above = options.anchor.y - bounds.height / 2 - gap;
    const y = above - bounds.height / 2 >= margin ? above : options.anchor.y + bounds.height / 2 + gap;
    return {
      x: Phaser.Math.Clamp(options.anchor.x, bounds.width / 2 + margin, screen.width - bounds.width / 2 - margin),
      y: Phaser.Math.Clamp(y, bounds.height / 2 + margin, screen.height - bounds.height / 2 - margin),
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
    openLayerCount -= 1;
    this.titleByLayer.delete(layer);
    const onClose = this.onCloseByLayer.get(layer);
    this.onCloseByLayer.delete(layer);
    layer.destroy();
    onClose?.();
    this.publishDebugTitles();
  }
}
