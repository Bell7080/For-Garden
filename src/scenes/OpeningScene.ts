import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { DialogueFlow, type DialogueChoice } from "../core/dialogue";
import { OPENING_TRAIN } from "../data/dialogues/openingTrain";
import { setDebugReady, setDebugScene } from "../debug";
import { storyManager } from "../managers/StoryManager";
import { drawLayer, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { DialogueLayer } from "../ui/DialogueLayer";

/** 정적 오프닝 데이터를 순회하고 완료 후 로비로 넘기는 전용 화면이다. */
export class OpeningScene extends Phaser.Scene {
  private flow = new DialogueFlow(OPENING_TRAIN);
  private layer?: DialogueLayer;

  constructor() { super("opening"); }

  create(): void {
    // Phaser가 같은 Scene 인스턴스를 회상에 재사용하므로 커서를 시작 노드로 되돌린다.
    this.flow = new DialogueFlow(OPENING_TRAIN);
    setDebugScene("opening");
    // 임시 배경 자산을 만들지 않고 기존 색 토큰으로 야간 열차 창과 실내를 암시한다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);
    drawLayer(this, BASE_WIDTH / 2, 560, slantedRect(880, 720), {
      fill: 0x141920, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.25,
    });
    this.add.text(BASE_WIDTH / 2, 250, "NIGHT TRAIN · ETERNAL CITY LINE", textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5);
    this.layer = new DialogueLayer(this, (choice) => this.advance(choice));
    void this.layer.show(this.flow.current).finally(() => this.flow.unlockInput());
    setDebugReady(true);
  }

  private advance(choice?: DialogueChoice): void {
    const result = this.flow.advance(choice?.id);
    if (result.effect) storyManager.applyEffect(OPENING_TRAIN.id, result.effect);
    if (result.completed) {
      storyManager.complete(OPENING_TRAIN.id);
      this.scene.start("lobby");
      return;
    }
    void this.layer?.show(result.node!).finally(() => this.flow.unlockInput());
  }
}
