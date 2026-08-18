import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugReady, setDebugScene } from "../debug";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    setDebugScene("title");

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x0b0b0d);

    this.add
      .text(cx, BASE_HEIGHT * 0.34, "ETERNAL CITY", {
        fontFamily: "Georgia, serif",
        fontSize: "88px",
        color: "#e8e6e1",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, BASE_HEIGHT * 0.34 + 90, "RELIC 관리 프로젝트", {
        fontFamily: "Georgia, serif",
        fontSize: "36px",
        color: "#b99a5b",
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        BASE_HEIGHT * 0.5,
        "멸종한 DNA로 되살린 호문쿨루스 소녀들,\n렐릭들이 살아가는 유일한 도시.\n\n당신은 이곳의 유일한 연구원이다.",
        {
          fontFamily: "Georgia, serif",
          fontSize: "30px",
          color: "#8b8a86",
          align: "center",
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, BASE_HEIGHT * 0.82, "TAP TO ENTER", {
        fontFamily: "Georgia, serif",
        fontSize: "32px",
        color: "#e8e6e1",
      })
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
      this.scene.start("archive");
    });
  }
}
