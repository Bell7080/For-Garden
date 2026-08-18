import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugScene } from "../debug";

/** 연구소(운영 허브) 화면이 들어설 자리. 지금은 토대만 확인하는 자리표시자다. */
export class ArchiveScene extends Phaser.Scene {
  constructor() {
    super("archive");
  }

  create(): void {
    setDebugScene("archive");

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x14120f);

    this.add
      .text(cx, BASE_HEIGHT / 2, "연구소 — 준비 중", {
        fontFamily: "Georgia, serif",
        fontSize: "42px",
        color: "#e8e6e1",
      })
      .setOrigin(0.5);
  }
}
