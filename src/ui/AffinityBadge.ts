import Phaser from "phaser";
import { AFFINITY_GLOW, type AffinityIconKey } from "./affinityIcons";

/** 어둠을 몇 겹 깔지와 그 크기. 겹칠수록 아이콘에서 멀어지며 옅어져 부드러운 그늘이 된다. */
const AURA = [1.62, 1.42, 1.24] as const;

/**
 * 속성·직군 아이콘 한 장.
 *
 * 아이콘만 얹으면 배경 원화 위에서 실루엣이 배경과 뒤엉켜 읽히지 않는다. 판때기를 깔면
 * 홀로그램의 결이 깨지므로, **아이콘 모양 그대로의 어둠**을 여러 겹 키워 가며 깔아 그늘을
 * 만든다. 그 위에 같은 색 발광을 한 겹 넣어 아이콘이 스스로 빛나게 한다.
 *
 * 원화가 밝고 복잡한 카드에서는 `strength`를 올려 그늘을 넓고 진하게 준다. 발광을 이미지에
 * 구워 넣지 않는 이유는, 크기를 줄여 쓸 때 구운 빛무리가 뭉개지기 때문이다.
 */
export class AffinityBadge extends Phaser.GameObjects.Container {
  private readonly aura: Phaser.GameObjects.Image[];
  private readonly glow: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    key: AffinityIconKey,
    size: number,
    /** 뒤에 까는 그늘의 진하기(0~1). 밝은 원화 위에서는 크게 준다. */
    private readonly strength = 0.5,
  ) {
    super(scene, x, y);
    scene.add.existing(this);
    this.aura = AURA.map((scale) =>
      scene.add.image(size * 0.04, size * 0.07, key).setDisplaySize(size * scale, size * scale).setTint(0x02040a).setAlpha(strength),
    );
    this.glow = scene.add.image(0, 0, key).setDisplaySize(size * 1.3, size * 1.3).setTint(AFFINITY_GLOW[key]).setAlpha(0.34).setBlendMode(Phaser.BlendModes.ADD);
    this.icon = scene.add.image(0, 0, key).setDisplaySize(size, size);
    this.add([...this.aura, this.glow, this.icon]);
  }

  /** 같은 자리에 다른 속성·직군을 다시 그린다. 카드는 목록에서 재사용되므로 새로 만들지 않는다. */
  setIcon(key: AffinityIconKey, size: number): this {
    this.aura.forEach((layer, index) => {
      layer.setTexture(key).setPosition(size * 0.04, size * 0.07).setDisplaySize(size * AURA[index], size * AURA[index]).setAlpha(this.strength);
    });
    this.glow.setTexture(key).setDisplaySize(size * 1.3, size * 1.3).setTint(AFFINITY_GLOW[key]);
    this.icon.setTexture(key).setDisplaySize(size, size);
    return this;
  }
}
