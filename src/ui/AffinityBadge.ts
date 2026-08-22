import Phaser from "phaser";
import { AFFINITY_GLOW, type AffinityIconKey } from "./affinityIcons";

/**
 * 속성·직군 아이콘 한 장.
 *
 * 아이콘만 얹으면 배경 원화 위에서 납작한 스티커처럼 보인다. 뒤에 같은 모양의 **두꺼운
 * 검은 그림자**를 깔아 두께를 만들고, 그 사이에 같은 색 발광을 한 겹 넣어 스스로 빛나게
 * 한다. 세 겹의 순서와 간격은 여기서만 정하므로 화면마다 두께가 달라지지 않는다.
 *
 * 발광을 이미지에 구워 넣지 않는 이유는, 크기를 줄여 쓸 때 구운 빛무리가 뭉개지기 때문이다.
 */
export class AffinityBadge extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, key: AffinityIconKey, size: number) {
    super(scene, x, y);
    scene.add.existing(this);
    // 그림자는 아래로 두껍게 깔린다. 조금 크게 그려야 가장자리가 잘리지 않고 두께로 읽힌다.
    this.shadow = scene.add.image(size * 0.06, size * 0.1, key).setDisplaySize(size * 1.08, size * 1.08).setTint(0x05070a).setAlpha(0.85);
    this.glow = scene.add.image(0, 0, key).setDisplaySize(size * 1.34, size * 1.34).setTint(AFFINITY_GLOW[key]).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD);
    this.icon = scene.add.image(0, 0, key).setDisplaySize(size, size);
    this.add([this.shadow, this.glow, this.icon]);
  }

  /** 같은 자리에 다른 속성·직군을 다시 그린다. 카드는 목록에서 재사용되므로 새로 만들지 않는다. */
  setIcon(key: AffinityIconKey, size: number): this {
    this.shadow.setTexture(key).setPosition(size * 0.06, size * 0.1).setDisplaySize(size * 1.08, size * 1.08);
    this.glow.setTexture(key).setDisplaySize(size * 1.34, size * 1.34).setTint(AFFINITY_GLOW[key]);
    this.icon.setTexture(key).setDisplaySize(size, size);
    return this;
  }
}
