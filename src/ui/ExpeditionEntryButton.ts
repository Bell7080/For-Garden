import Phaser from "phaser";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 로딩 표에 등록된 원정 진입 일러스트 키. 프리팹 밖에서 문자열을 반복하지 않는다. */
const EXPEDITION_ENTRY_ART = "content-expedition-entry";

/** 원정 일러스트와 출격 계열의 주황 강조를 한 입력면으로 묶는 재사용 진입 버튼이다. */
export class ExpeditionEntryButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: { width: number; height: number; status: string; onClick: () => void }) {
    super(scene, x, y);
    scene.add.existing(this);

    const shape = chipPoints(options.width, options.height, {
      bevel: { topLeft: options.height * 0.46, bottomRight: options.height * 0.46 },
    });
    // 버튼은 배경 원화와 달리 액자 예외에 해당하므로 닫힌 윤곽과 내부 비네트를 함께 사용한다.
    this.add(drawLayer(scene, 0, 0, shape, { fill: 0x0d1219, alpha: HOLO.glass, edge: COLOR.sortie, edgeAlpha: 0.95 }));
    const art = scene.add.image(0, 0, EXPEDITION_ENTRY_ART);
    art.setScale(Math.max(options.width / art.width, options.height / art.height)).setAlpha(0.68);
    // 사각 원화의 가장자리는 비네트와 주황 액자가 눌러 기존 홀로그램 판 안의 이미지로 읽히게 한다.
    this.add(art);
    this.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.74 }));
    this.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.sortie, alpha: 0.92, width: 3 }));
    this.add(scene.add.text(-options.width / 2 + 78, -18, "원정", textStyle({ role: "display", size: 42, color: COLOR.sortieText })).setOrigin(0, 0.5));
    this.add(scene.add.text(-options.width / 2 + 80, 40, options.status, textStyle({ role: "emphasis", size: 20, color: COLOR.ink })).setOrigin(0, 0.5));

    // 투명 입력면 하나가 그림과 글자를 함께 확대해 공용 Button과 같은 눌림 피드백을 낸다.
    const hit = scene.add.rectangle(0, 0, options.width, options.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.add(hit);
    hit.on("pointerdown", () => this.setScale(1.08));
    hit.on("pointerout", () => this.setScale(1));
    hit.on("pointerup", () => { this.setScale(1); options.onClick(); });
  }
}
