import Phaser from "phaser";
import { audioManager } from "../managers/AudioManager";
import { settingsManager } from "../managers/SettingsManager";
import { NotificationDot } from "./NotificationDot";
import { textStyle } from "./theme";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

export interface ResearchPullButtonOptions {
  width: number;
  height: number;
  label: string;
  /** 판의 제 색. 한 번과 열 번이 다른 색이라 누르기 전에 어느 쪽인지 읽힌다. */
  tone: number;
  onClick: () => void;
}

/** 드는 값 한 조각 — 그림과 수. `short`면 치를 수 없는 몫이라 수가 붉다. */
export interface ResearchPullCostPart { iconKey: string; amount: number; short?: boolean; }

/** 버튼 글자의 짙은 갈색 — 밝은 크림 면 위에서 검정보다 부드럽게 선다. */
const INK = 0x3b2a1c;
/** 크림 면. 모집 원화가 밝은 파스텔이라 어두운 유리 판은 그 위에서 구멍처럼 뚫려 보였다. */
const CREAM = 0xfff6e4;
/** 오늘의 무료 연구 강조 빛 — 「무료」 글자의 붉은빛과 겹치지 않는 따뜻한 금빛. */
const FREE_GLOW = 0xffc94a;

/**
 * 연구소의 연구 버튼 — **모집 원화에 어울리는 말랑한 알약**이다.
 *
 * 다른 화면의 버튼(어두운 유리 판)을 그대로 쓰던 때는 밝은 파스텔 원화 위에 검은 판 두 장이
 * 떠 화면의 결과 따로 놀았다. 여기만 크림 면 + 제 색의 두꺼운 테 + 아래로 떨어지는 짙은 그림자
 * (눌린 두께)로 세우고, 누르면 그 두께만큼 내려앉는다. 드는 재화는 **글이 아니라 그림**이다 —
 * 재화 아이콘과 수가 바짝 붙어 선다(버튼 안 비용 표기의 공용 규칙).
 */
export class ResearchPullButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Container;
  /** 드는 값 줄 — 연구 재화 한 조각과, 모자라면 그 옆의 젬 한 조각. 값이 바뀔 때마다 다시 세운다. */
  private readonly cost: Phaser.GameObjects.Container;
  private enabled = true;
  /** 오늘의 무료 연구가 남은 동안만 서는 강조 한 벌(빛무리·반짝이·숨쉬기·붉은 점). */
  private freeHighlight?: { layer: Phaser.GameObjects.Container; dot: NotificationDot; tweens: Phaser.Tweens.Tween[] };

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: ResearchPullButtonOptions) {
    super(scene, x, y);
    const { width, height, tone } = options;
    const radius = height / 2;
    const depth = 12;
    // 눌린 두께 — 같은 알약을 제 색의 어두운 쪽으로 한 뼘 아래에 깐다.
    const base = scene.add.graphics();
    base.fillStyle(0x000000, 0.28);
    base.fillRoundedRect(-width / 2 + 6, -height / 2 + depth + 10, width, height, radius);
    base.fillStyle(Phaser.Display.Color.ValueToColor(tone).darken(28).color, 1);
    base.fillRoundedRect(-width / 2, -height / 2 + depth, width, height, radius);
    this.add(base);

    this.face = scene.add.container(0, 0);
    const plate = scene.add.graphics();
    plate.fillStyle(tone, 1);
    plate.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    plate.fillStyle(CREAM, 1);
    plate.fillRoundedRect(-width / 2 + 7, -height / 2 + 7, width - 14, height - 14, radius - 7);
    // 윗변의 반짝임 한 줄 — 광택 그라데이션이 아니라 얇은 띠 하나라 면은 그대로 평평하다.
    plate.fillStyle(0xffffff, 0.75);
    plate.fillRoundedRect(-width / 2 + radius * 0.7, -height / 2 + 14, width - radius * 1.4, 8, 4);
    this.face.add(plate);
    // 양 끝의 작은 반짝이 — 원화의 장난스러운 결을 버튼에도 한 겹 남긴다.
    const sparkle = scene.add.graphics();
    sparkle.fillStyle(tone, 0.95);
    for (const sx of [-width / 2 + radius * 0.66, width / 2 - radius * 0.66]) {
      // 동그라미가 아니라 좌우 높이를 어긋나게 깎은 마름모(화면 전체의 반짝임 규칙).
      sparkle.fillPoints([new Phaser.Geom.Point(sx, -18), new Phaser.Geom.Point(sx + 9, -3), new Phaser.Geom.Point(sx, 12), new Phaser.Geom.Point(sx - 8, -5)], true);
    }
    this.face.add(sparkle);
    this.face.add(scene.add.text(0, -height * 0.16, options.label, textStyle({ role: "display", size: Math.round(height * 0.27), color: hex(INK) })).setOrigin(0.5));
    // **드는 재화 그림은 크게, 검은 복제를 깔아 세운다.** 밝은 크림빛 면 위에서 호박석의 노란 결과
    // 화석의 옅은 돌빛이 면과 같은 밝기라 작게 두면 윤곽이 녹았다 — 판을 받치지 않고(버튼 안에 판이
    // 두 겹이 된다) 아래로 민 그림자와 한 뼘 큰 옅은 테두리로만 떼어 낸다.
    this.cost = scene.add.container(0, height * 0.23);
    this.face.add(this.cost);
    this.add(this.face);

    const hit = scene.add.rectangle(0, depth / 2, width, height + depth, 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 이 버튼은 공용 눌림(`pressIn`)을 쓰지 않아 손끝 소리도 직접 낸다 — 꺼진 버튼은 「아직」으로 답한다.
    hit.on("pointerdown", () => {
      if (this.enabled) this.face.setY(depth * 0.6);
      audioManager?.playUi(this.enabled ? "ui.click" : "ui.deny");
    });
    hit.on("pointerout", () => this.face.setY(0));
    hit.on("pointerup", () => {
      this.face.setY(0);
      if (this.enabled) options.onClick();
    });
    this.add(hit);
    scene.add.existing(this);
  }

  /**
   * 드는 값 — **연구 재화를 먼저 쓰고 모자란 몫은 젬**으로 옆에 선다(`화석 ×1  젬 ×2,700`).
   *
   * 연구 재화가 하나도 없으면 젬 조각 하나만 서고, 넉넉하면 연구 재화 조각 하나만 선다. 두 조각은 한
   * 덩어리로 가운데에 놓인다. 젬까지 모자라면 젬 수가 붉어져 왜 못 누르는지 값 자체가 말한다.
   */
  setCost(parts: readonly ResearchPullCostPart[]): this {
    this.cost.removeAll(true);
    const size = this.options.height * (parts.length > 1 ? 0.34 : 0.42);
    const textSize = Math.round(this.options.height * (parts.length > 1 ? 0.17 : 0.2));
    const pieces: { width: number; build: (x: number) => void }[] = parts.map((part) => {
      const amount = this.scene.add.text(0, 0, `× ${part.amount.toLocaleString()}`, textStyle({ role: "display", size: textSize, color: part.short ? "#d2463c" : hex(INK) })).setOrigin(0, 0.5);
      const gap = 6;
      return {
        width: size + gap + amount.width,
        build: (x: number) => {
          // 그림 뒤에 검은 복제 둘을 깐다 — 크림빛 면 위에서 화석·호박석·젬의 윤곽을 떼어 낸다.
          const shadow = this.scene.add.image(x + size / 2 + 3, 4, part.iconKey).setDisplaySize(size, size).setTintFill(0x2a1c10).setAlpha(0.42);
          const rim = this.scene.add.image(x + size / 2, 0, part.iconKey).setDisplaySize(size * 1.1, size * 1.1).setTintFill(0x2a1c10).setAlpha(0.5);
          const icon = this.scene.add.image(x + size / 2, 0, part.iconKey).setDisplaySize(size, size);
          this.cost.add([shadow, rim, icon, amount.setX(x + size + gap)]);
        },
      };
    });
    const between = 18;
    const total = pieces.reduce((sum, piece) => sum + piece.width, 0) + between * Math.max(0, pieces.length - 1);
    let x = -total / 2;
    for (const piece of pieces) { piece.build(x); x += piece.width + between; }
    return this;
  }

  /**
   * **오늘의 무료 연구**(`core/freeResearch.ts`) — 값 줄 자리에 재화 그림 대신 「오늘 무료」 한 마디가 선다.
   * 값이 사라진 것이 곧 이번 한 번은 아무것도 들지 않는다는 말이라 따로 딱지를 붙이지 않는다.
   */
  setFreeLabel(label: string): this {
    this.cost.removeAll(true);
    // 평소 값 줄보다 한 뼘 크고 흰 테를 둘러, 크림 면 위에서도 「무료」가 먼저 읽힌다.
    this.cost.add(this.scene.add.text(0, 0, label, textStyle({ role: "display", size: Math.round(this.options.height * 0.24), color: "#d2463c" })).setStroke("#ffffff", 6).setOrigin(0.5));
    return this;
  }

  /**
   * **오늘의 무료 연구를 크게 알린다** — 값 줄만 「오늘 무료!」로 바뀌던 때는 한 번 훑어선 평소 버튼과
   * 다르지 않았다. 판 뒤로 금빛 빛무리가 숨 쉬고, 둘레에 반짝이가 톡톡 켜지며, 버튼이 살짝 부풀었다
   * 가라앉고, 오른쪽 위에 공용 붉은 점이 선다. 무료를 쓰면 한 벌을 통째로 걷는다. 움직임 줄이기에서는
   * 빛무리와 점만 가만히 선다.
   */
  setFreeHighlight(on: boolean): this {
    if (on === (this.freeHighlight !== undefined)) return this;
    if (!on) {
      const current = this.freeHighlight!;
      for (const tween of current.tweens) tween.remove();
      current.layer.destroy(true);
      current.dot.destroy(true);
      this.freeHighlight = undefined;
      this.face.setScale(1);
      return this;
    }
    const scene = this.scene;
    const { width, height } = this.options;
    const reduce = settingsManager.get().accessibility.reduceMotion;
    const layer = scene.add.container(0, 0);
    // 빛무리 — 같은 알약을 한 뼘씩 키워 옅은 금빛을 겹친다(밝아지는 합성 없이, 원화 위에서 하얗게 뜨지 않게).
    const halo = scene.add.graphics();
    for (const [grow, alpha] of [[34, 0.16], [22, 0.24], [12, 0.34]] as const) {
      halo.fillStyle(FREE_GLOW, alpha);
      halo.fillRoundedRect(-width / 2 - grow, -height / 2 - grow, width + grow * 2, height + grow * 2 + 12, height / 2 + grow);
    }
    layer.add(halo);
    // 반짝이 — 둘레 여섯 자리에 네 갈래 마름모가 차례로 켜졌다 꺼진다. 난수 없이 번호에서 자리·박자를 정한다.
    const spots = [[-0.5, -0.62], [-0.18, -0.8], [0.22, -0.78], [0.52, -0.6], [0.56, 0.42], [-0.54, 0.46]] as const;
    const sparkles = spots.map(([sx, sy], index) => {
      const star = scene.add.graphics({ x: sx * width, y: sy * height });
      const r = index % 2 === 0 ? 15 : 11;
      star.fillStyle(0xffffff, 1);
      star.fillPoints([new Phaser.Geom.Point(0, -r), new Phaser.Geom.Point(r * 0.28, -r * 0.28), new Phaser.Geom.Point(r, 0), new Phaser.Geom.Point(r * 0.28, r * 0.28), new Phaser.Geom.Point(0, r), new Phaser.Geom.Point(-r * 0.28, r * 0.28), new Phaser.Geom.Point(-r, 0), new Phaser.Geom.Point(-r * 0.28, -r * 0.28)], true);
      star.fillStyle(FREE_GLOW, 1);
      star.fillPoints([new Phaser.Geom.Point(0, -r * 0.5), new Phaser.Geom.Point(r * 0.5, 0), new Phaser.Geom.Point(0, r * 0.5), new Phaser.Geom.Point(-r * 0.5, 0)], true);
      star.setAlpha(reduce ? 0.85 : 0).setScale(reduce ? 0.8 : 0.3);
      return star;
    });
    layer.add(sparkles);
    this.addAt(layer, 0);
    const tweens: Phaser.Tweens.Tween[] = [];
    if (!reduce) {
      tweens.push(scene.tweens.add({ targets: halo, alpha: { from: 0.55, to: 1 }, duration: 760, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
      tweens.push(scene.tweens.add({ targets: this.face, scale: { from: 1, to: 1.035 }, duration: 760, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }));
      sparkles.forEach((star, index) => {
        tweens.push(scene.tweens.add({ targets: star, alpha: { from: 0, to: 1 }, scale: { from: 0.3, to: 1 }, angle: { from: 0, to: 45 }, duration: 420, yoyo: true, repeat: -1, repeatDelay: 900, delay: index * 260, ease: "Sine.easeOut" }));
      });
    }
    const dot = new NotificationDot(scene, this, { x: width / 2 - 26, y: -height / 2 + 6 });
    this.freeHighlight = { layer, dot, tweens };
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.6);
    return this;
  }
}
