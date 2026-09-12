import Phaser from "phaser";
import { addGlowStar, type StarTones } from "./stars";
import { COLOR } from "./theme";

const GAP = 96;
/** 칸 하나의 바깥 반지름. 빈 칸과 찬 별이 같은 자리를 쓴다. */
const OUTER = 30;

/**
 * 로딩 칸의 별 한 벌.
 *
 * 성급(호박색)과 같은 겹 구조를 쓰되 색만 화면의 강조색 계열로 바꾼다 — `stars.ts`의 규칙
 * 그대로다. 겹마다 색을 바꾸지 않고 한 계열의 밝기만 달리해 같은 빛에서 나온 것처럼 둔다.
 */
const LOADING_STAR: StarTones = { shadow: 0x1a1206, halo: 0xffe6a8, glow: 0xf3d089, body: COLOR.accent };

/**
 * 칸이 찰 때의 **박히는** 연출.
 *
 * 색만 갈아 끼우면 어느 칸이 방금 찼는지 읽히지 않는다. 위에서 내리꽂히듯 크게 들어와
 * 제 자리에 박히고, 그 순간 흰 섬광 한 겹이 넓게 퍼졌다 사라진다.
 */
const PUNCH = {
  /** 들어오기 시작하는 배율. 크게 시작해 줄어드는 동안 "꽂힌다"로 읽힌다. */
  from: 2.8,
  ms: 300,
  /** 박히는 순간 퍼지는 섬광의 최대 배율과 수명. */
  flashScale: 3.4,
  flashMs: 380,
  /** 섬광의 진하기. 겹쳐 밝아지는 합성이라 옅게 둔다 — 진하면 별이 그 속에 묻힌다. */
  flashAlpha: 0.55,
} as const;

/**
 * 로딩 진행 칸. 별 하나가 로딩 단계 하나다.
 *
 * 퍼센트 막대 대신 칸을 쓰는 이유는, 실제로 기다리는 대상이 파일 다섯 무리라서 남은 양보다
 * "몇 개 남았는지"가 정확하기 때문이다. 남은 양은 아래 숫자(`LoadingPercent`)가 맡는다.
 *
 * 모양은 하단 탭의 로비 아이콘과 같은 네 꼭짓점 마름모이고, 찬 칸만 `stars.ts`의 겹
 * (그림자·빛무리 두 겹·몸통)을 그대로 받아 화려해진다.
 */
export class LoadingDiamonds extends Phaser.GameObjects.Container {
  /** 빈 칸의 테두리. 찰 때 그 자리에서 사라진다. */
  private readonly empties: Phaser.GameObjects.Star[] = [];
  /** 찬 칸의 겹을 한 덩어리로 움직이기 위한 자리별 컨테이너다. */
  private readonly slots: Phaser.GameObjects.Container[] = [];
  private filled = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, count: number) {
    super(scene, x, y);
    const left = -((count - 1) * GAP) / 2;
    for (let i = 0; i < count; i++) {
      const slotX = left + i * GAP;
      // 빈 칸은 가라앉혀 둔다. 밝은 배경 영상 위에서도 자리는 보이되 찬 칸과 무게가 갈린다.
      const empty = scene.add
        .star(slotX, 0, 4, OUTER * 0.57, OUTER, 0x000000, 0.42)
        .setStrokeStyle(3, COLOR.panelEdge, 0.9);
      this.empties.push(empty);
      this.add(empty);

      const slot = scene.add.container(slotX, 0).setVisible(false);
      this.slots.push(slot);
      this.add(slot);
    }
    scene.add.existing(this);
  }

  /** 채워진 칸 수를 갱신한다. 새로 찬 칸만 한 번 박혀 눈이 진행을 따라간다. */
  setFilled(count: number): void {
    for (let i = this.filled; i < count && i < this.slots.length; i++) this.punch(i);
    this.filled = Math.min(count, this.slots.length);
  }

  /** 칸 하나가 박힌다 — 빈 테두리가 꺼지고, 별이 내리꽂히며, 섬광이 한 겹 퍼진다. */
  private punch(index: number): void {
    const scene = this.scene;
    this.empties[index].setVisible(false);

    const slot = this.slots[index];
    slot.setVisible(true).setScale(PUNCH.from).setAlpha(0);
    // 네 꼭짓점 마름모로 그린다. 겹과 비율은 성급 별과 같고 색만 이 화면의 것이다.
    addGlowStar(scene, slot, 0, 0, OUTER, LOADING_STAR, 4);
    scene.tweens.add({ targets: slot, scale: 1, alpha: 1, duration: PUNCH.ms, ease: "Back.easeOut" });

    // 박히는 자리에서 퍼지는 섬광 한 겹. 별과 같은 마름모라 다른 종류의 표식으로 보이지 않는다.
    const flash = scene.add
      .star(slot.x, 0, 4, OUTER * 0.5, OUTER, 0xffffff, PUNCH.flashAlpha)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add(flash);
    scene.tweens.add({
      targets: flash,
      scale: PUNCH.flashScale,
      alpha: 0,
      duration: PUNCH.flashMs,
      ease: "Quad.Out",
      onComplete: () => flash.destroy(),
    });
  }
}
