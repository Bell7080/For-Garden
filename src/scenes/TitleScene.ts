import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugReady, setDebugScene } from "../debug";
import { COLOR, textStyle } from "../ui/theme";
import { OPENING_TRAIN } from "../data/dialogues/openingTrain";
import { storyManager } from "../managers/StoryManager";
import { Button } from "../ui/Button";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    setDebugScene("title");

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    // 제목(For - Garden) · 부제(이터널 시티) · 도시 소개 세 줄이 곧 위계 셋의 본보기다.
    this.add.text(cx, BASE_HEIGHT * 0.34, "For - Garden", textStyle({ role: "display", size: 92 })).setOrigin(0.5);

    this.add
      .text(cx, BASE_HEIGHT * 0.34 + 96, "이터널 시티", textStyle({ role: "emphasis", size: 40, color: COLOR.accentText }))
      .setOrigin(0.5);

    this.add
      .text(cx, BASE_HEIGHT * 0.34 + 152, "멸종 동물 복원 연구 도시", textStyle({ role: "body", size: 30, color: COLOR.inkDim }))
      .setOrigin(0.5);

    const recoveryNotice = this.registry.get("saveRecoveryNotice") as string | undefined;
    if (recoveryNotice) {
      // 새게임 버튼 대신 자동 복구 사실만 안내해 향후 Google/Apple 계정 복구 흐름을 막지 않는다.
      this.add
        .text(cx, BASE_HEIGHT * 0.68, recoveryNotice, textStyle({ role: "body", size: 26, color: COLOR.dangerText, align: "center" }))
        .setOrigin(0.5);
      this.registry.remove("saveRecoveryNotice");
    }

    this.add
      .text(
        cx,
        BASE_HEIGHT * 0.5,
        "멸종한 DNA로 되살린 호문쿨루스 소녀들,\n렐릭들이 살아가는 유일한 도시.\n\n당신은 이곳의 유일한 연구원이다.",
        textStyle({ role: "body", size: 34, color: COLOR.inkDim, align: "center", lineSpacing: 14 }),
      )
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, BASE_HEIGHT * 0.82, "TAP TO ENTER", textStyle({ role: "emphasis", size: 36 }))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    setDebugReady(true);

    if (storyManager.isCompleted(OPENING_TRAIN.id)) {
      // 회상은 완료 플래그를 지우지 않으므로 선택 보상이 다시 지급되지 않는다.
      new Button(this, cx, BASE_HEIGHT * 0.72, { width: 360, height: 96, label: "오프닝 회상", fontSize: 30, onClick: () => this.scene.start("opening") });
    }

    prompt.once("pointerup", () => {
      this.scene.start(storyManager.isCompleted(OPENING_TRAIN.id) ? "lobby" : "opening");
    });
  }
}
