import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { Button } from "../ui/Button";
import { COLOR, textStyle } from "../ui/theme";

/** 연구소(운영 허브). 지금은 출격 동선만 살아있고 나머지 시설은 자리표시자다. */
export class ArchiveScene extends Phaser.Scene {
  constructor() {
    super("archive");
  }

  create(): void {
    setDebugScene("archive");

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.panel);

    this.add
      .text(cx, 160, "연구소", textStyle({ size: 68 }))
      .setOrigin(0.5);
    this.add
      .text(cx, 230, "ETERNAL CITY — RELIC MANAGEMENT", textStyle({ size: 28, color: COLOR.accentText }))
      .setOrigin(0.5);

    this.add
      .text(cx, BASE_HEIGHT * 0.45, "격납고 · 배양조 · 집무실\n(준비 중)", textStyle({ size: 34, color: COLOR.inkDim, align: "center", lineSpacing: 14 }))
      .setOrigin(0.5);

    // 화면 중앙부 하단의 출격 버튼. 여기서 스테이지 지도로 들어간다.
    new Button(this, cx, BASE_HEIGHT * 0.78, {
      width: 460,
      height: 140,
      label: "출  격",
      sub: "SORTIE",
      fontSize: 48,
      onClick: () => this.scene.start("stageMap"),
    }).setName("sortie");
  }
}
