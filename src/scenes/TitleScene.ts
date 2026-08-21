import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugReady, setDebugScene } from "../debug";
import { COLOR, textStyle } from "../ui/theme";
import { OPENING_TRAIN } from "../data/dialogues/openingTrain";
import { storyManager } from "../managers/StoryManager";
import { Button } from "../ui/Button";
import { LoadingDiamonds } from "../ui/LoadingDiamonds";
import { LOADING_STEPS, refreshTextTextures, runLoadingSteps } from "./loadingSteps";

/**
 * 타이틀이자 로딩 화면.
 *
 * 부트는 저장 데이터만 확인하고 곧바로 이 화면을 띄운다. 원화·아이콘·Puppet 묶음은 여기서
 * 읽으며, 기다리는 동안 제목 아래 마름모 다섯 칸이 하나씩 찬다. 다 차기 전에는 다음 화면으로
 * 넘어가지 못한다 — 로비가 원화 없이 뜨는 편이 잠깐 기다리는 것보다 나쁘다.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    setDebugScene("title");
    setDebugReady(false);

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    // 제목 · 부제 · 도시 소개 세 줄이 곧 글꼴 위계 셋의 본보기다.
    this.add.text(cx, BASE_HEIGHT * 0.34, "For - Garden", textStyle({ role: "display", size: 92 })).setOrigin(0.5);

    this.add
      .text(cx, BASE_HEIGHT * 0.34 + 96, "ETERNAL CITY", textStyle({ role: "emphasis", size: 40, color: COLOR.accentText }))
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

    const diamonds = new LoadingDiamonds(this, cx, BASE_HEIGHT * 0.5, LOADING_STEPS.length);

    void runLoadingSteps(this, (done) => {
      diamonds.setFilled(done);
      // 글꼴 단계가 끝나면 이미 그려 둔 제목을 게임 글꼴로 다시 굳힌다.
      if (done === 1) refreshTextTextures(this);
    }).then(() => {
      if (!this.scene.isActive()) return;
      this.showEntry(cx);
    });
  }

  /** 다섯 칸이 다 찬 뒤에만 부른다. 이때부터 화면 어디를 눌러도 다음으로 넘어간다. */
  private showEntry(cx: number): void {
    const prompt = this.add
      .text(cx, BASE_HEIGHT * 0.82, "TAP TO ENTER", textStyle({ role: "emphasis", size: 36 }))
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    if (storyManager.isCompleted(OPENING_TRAIN.id)) {
      // 회상은 완료 플래그를 지우지 않으므로 선택 보상이 다시 지급되지 않는다.
      new Button(this, cx, BASE_HEIGHT * 0.72, { width: 360, height: 96, label: "오프닝 회상", fontSize: 30, onClick: () => this.scene.start("opening") });
    }

    // 회상 버튼이 먼저 눌리도록 화면 전체 히트영역은 가장 아래 깊이에 깔고 pointerup에서 확정한다.
    const tapAnywhere = this.add
      .zone(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT)
      .setInteractive({ useHandCursor: true })
      .setDepth(-1);
    tapAnywhere.once("pointerup", () => {
      this.scene.start(storyManager.isCompleted(OPENING_TRAIN.id) ? "lobby" : "opening");
    });

    setDebugReady(true);
  }
}
