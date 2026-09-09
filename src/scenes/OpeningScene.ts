import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { DialogueFlow, type DialogueChoice } from "../core/dialogue";
import { OPENING_TRAIN } from "../data/dialogues/openingTrain";
import { bindDebugReadyLifecycle, setDebugDialogue, setDebugReady, setDebugScene } from "../debug";
import { storyManager } from "../managers/StoryManager";
import { drawLayer, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { DialogueLayer } from "../ui/DialogueLayer";

/** 정적 오프닝 데이터를 순회하고 완료 후 로비로 넘기는 전용 화면이다. */
export class OpeningScene extends Phaser.Scene {
  private flow = new DialogueFlow(OPENING_TRAIN);
  private layer?: DialogueLayer;
  /** 마지막 입력이 겹쳐도 완료 저장과 로비 전환은 한 번만 수행한다. */
  private transitioningToLobby = false;

  constructor() { super("opening"); }

  create(): void {
    // 이 씬이 ready를 소유하는 동안 시작과 종료 모두 공용 수명주기 규칙으로 false를 보장한다.
    bindDebugReadyLifecycle(this.events);
    // Phaser가 같은 Scene 인스턴스를 회상에 재사용하므로 커서를 시작 노드로 되돌린다.
    this.flow = new DialogueFlow(OPENING_TRAIN);
    this.transitioningToLobby = false;
    setDebugScene("opening");
    // 임시 배경 자산을 만들지 않고 기존 색 토큰으로 야간 열차 창과 실내를 암시한다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);
    drawLayer(this, BASE_WIDTH / 2, 560, slantedRect(880, 720), {
      fill: 0x141920, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.25,
    });
    this.add.text(BASE_WIDTH / 2, 250, "NIGHT TRAIN · ETERNAL CITY LINE", textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5);
    this.layer = new DialogueLayer(this, (choice) => this.advance(choice));
    // 첫 노드 정보를 먼저 게시하되 DialogueFlow 잠금은 Puppet 비동기 표시가 끝날 때까지 유지한다.
    setDebugDialogue(this.flow.current);
    void this.showCurrentNode(this.flow.current);
    setDebugReady(true);
  }

  private advance(choice?: DialogueChoice): void {
    if (this.transitioningToLobby) return;
    const result = this.flow.advance(choice?.id);
    if (result.effect) storyManager.applyEffect(OPENING_TRAIN.id, result.effect);
    if (result.completed) {
      // 저장이 던지면 현재 씬에 머물고 다시 시도할 수 있게 하며, 성공한 전환만 한 번 허용한다.
      try {
        storyManager.complete(OPENING_TRAIN.id);
        this.transitioningToLobby = true;
        // 로비의 비동기 Puppet까지 준비되기 전 오프닝의 true를 자동화가 재사용하지 않게 먼저 내린다.
        setDebugReady(false);
        this.scene.start("lobby");
      } finally {
        // 완료 경로도 잠금을 풀어 저장 실패 때문에 입력이 영구 잠기게 두지 않는다.
        this.flow.markCurrentNodeReady();
      }
      return;
    }
    void this.showCurrentNode(result.node!);
  }

  /** 비동기 표시 실패를 호출 경계에서 소비하되 어떤 결과에서도 다음 입력은 다시 허용한다. */
  private async showCurrentNode(node: Parameters<DialogueLayer["show"]>[0]): Promise<void> {
    // E2E도 실제 흐름 커서와 원문을 관찰해 Puppet 로딩 중 진입 입력이 첫 노드를 넘기지 않았는지 확인한다.
    setDebugDialogue(node);
    try {
      await this.layer?.show(node);
    } catch (error) {
      // 로드 실패를 보고하면서도 종료된 씬에서 비동기 Puppet 결과가 되살아나는 후속 작업은 만들지 않는다.
      console.error("오프닝 Puppet 표시 실패", error);
    } finally {
      // 성공과 에셋 실패 모두 표시 시도가 정리된 뒤에만 다음 입력을 받아 Puppet 로딩 경쟁을 막는다.
      this.flow.markCurrentNodeReady();
    }
  }
}
