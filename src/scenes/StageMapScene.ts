import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { STAGES } from "../data/stages";
import { isStageUnlocked, session } from "../state/session";
import { Button } from "../ui/Button";
import { COLOR, textStyle } from "../ui/theme";

/**
 * 스테이지 지도. 세로 게임이므로 진행 경로가 아래에서 위로 뻗는다.
 * 맨 아래가 1-1, 위로 갈수록 뒤쪽 스테이지다.
 */
export class StageMapScene extends Phaser.Scene {
  constructor() {
    super("stageMap");
  }

  create(): void {
    setDebugScene("stageMap");

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    this.add
      .text(cx, 140, "제 1 구역", textStyle({ size: 60 }))
      .setOrigin(0.5);
    this.add
      .text(cx, 202, "격리 구역 — 이터널 시티 외곽", textStyle({ size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5);

    const bottomY = BASE_HEIGHT - 460;
    const topY = 380;
    const gap = (bottomY - topY) / (STAGES.length - 1);

    // 아래에서 위로 이어지는 경로선.
    this.add.line(0, 0, cx, bottomY, cx, topY, COLOR.panelEdge).setOrigin(0).setLineWidth(6);

    STAGES.forEach((stage, i) => {
      const y = bottomY - gap * i;
      // 좌우로 살짝 어긋나게 놓아 단조로운 일자 배치를 피한다.
      const x = cx + (i % 2 === 0 ? -110 : 110);
      const unlocked = isStageUnlocked(stage.id);
      const cleared = session.cleared.has(stage.id);

      this.add.line(0, 0, cx, y, x, y, COLOR.panelEdge).setOrigin(0).setLineWidth(4);

      const node = this.add
        .circle(x, y, 46, cleared ? COLOR.accent : COLOR.panel)
        .setStrokeStyle(4, unlocked ? COLOR.accent : COLOR.panelEdge);

      this.add
        .text(
          x,
          y,
          stage.id,
          textStyle({ size: 32, color: cleared ? "#14120f" : unlocked ? COLOR.ink : COLOR.inkDim }),
        )
        .setOrigin(0.5);

      // 이름은 노드 아래에 둔다. 옆에 두면 가운데 경로선이 글자를 가로지른다.
      this.add
        .text(x, y + 74, stage.name, textStyle({ size: 30, color: unlocked ? COLOR.ink : COLOR.inkDim }))
        .setOrigin(0.5, 0);

      if (!unlocked) {
        node.setAlpha(0.4);
        return;
      }

      node.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        session.selectedStageId = stage.id;
        this.scene.start("party");
      });
    });

    new Button(this, cx, BASE_HEIGHT - 180, {
      width: 300,
      height: 96,
      label: "돌아가기",
      fontSize: 30,
      onClick: () => this.scene.start("archive"),
    });
  }
}
