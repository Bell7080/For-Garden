import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugReady, setDebugScene } from "../debug";
import { COLOR, textStyle } from "../ui/theme";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    setDebugScene("title");

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    this.add.text(cx, BASE_HEIGHT * 0.34, "ETERNAL CITY", textStyle({ size: 92 })).setOrigin(0.5);

    this.add
      .text(cx, BASE_HEIGHT * 0.34 + 96, "RELIC 관리 프로젝트", textStyle({ size: 40, color: COLOR.accentText }))
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        BASE_HEIGHT * 0.5,
        "멸종한 DNA로 되살린 호문쿨루스 소녀들,\n렐릭들이 살아가는 유일한 도시.\n\n당신은 이곳의 유일한 연구원이다.",
        textStyle({ size: 34, color: COLOR.inkDim, align: "center", lineSpacing: 14 }),
      )
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, BASE_HEIGHT * 0.82, "TAP TO ENTER", textStyle({ size: 36 }))
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    setDebugReady(true);

    this.input.once("pointerdown", () => {
      this.scene.start("lobby");
    });
  }
}
