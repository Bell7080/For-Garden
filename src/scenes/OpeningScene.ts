import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { DialogueFlow, dialogueStandingOrder, type DialogueChoice } from "../core/dialogue";
import { gameApi } from "../api/FakeServer";
import { OPENING_RETREAT } from "../data/dialogues/openingRetreat";
import { OPENING_TRAIN } from "../data/dialogues/openingTrain";
import { FIXED_STAGE_ENEMIES } from "../data/stages";
import { prefetchBattlePuppets } from "../puppets/battlePrefetch";
import { session } from "../state/session";
import { bindDebugReadyLifecycle, setDebugDialogue, setDebugReady, setDebugScene } from "../debug";
import { storyManager } from "../managers/StoryManager";
import { COLOR } from "../ui/theme";
import { DialogueLayer } from "../ui/DialogueLayer";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { playStoryTitleCard } from "../ui/StoryTitleCard";
import { Button } from "../ui/Button";
import { t } from "../i18n";

/**
 * 개발자용 임시 건너뛰기. 켜 두면 오프닝 상단에 버튼이 서고, 누르면 오프닝을 완료로 저장한 뒤
 * 1-1 전투까지 건너뛰고 곧장 로비로 간다. 1-1 클리어는 주지 않는다(지도에서 그대로 칠 수 있다).
 * 정식 빌드 전에 `false`로 끄거나 버튼째 걷어 낸다.
 */
const OPENING_DEV_SKIP_ENABLED = true;

/**
 * 정적 오프닝 데이터를 순회하고, 끝나면 곧장 1-1 전투로 넘기는 전용 화면이다.
 *
 * 대본이 쁘띠 로그 셋과 공멸 삼인조의 대치로 끝나므로 로비를 거치지 않고 그 전투로 들어간다
 * (그 판이 끝나면 전투가 로비로 내보낸다 — `StageBattleInputDto.exitTo`). **처음 볼 때만** 그렇다:
 * 타이틀의 다시 보기는 이미 지나온 관문의 입장 비용을 다시 받지 않도록 예전처럼 로비로 간다.
 *
 * 들어오면 검은 화면에서 제목과 부제가 열렸다 걷히고(`playStoryTitleCard`), 그 뒤에 미리 서
 * 있던 열차 객차가 드러나며 첫 대사가 시작된다. 제목표가 도는 동안 뒤에 설 스탠딩을 읽어 둔다.
 */
export class OpeningScene extends Phaser.Scene {
  private flow = new DialogueFlow(OPENING_TRAIN);
  private layer?: DialogueLayer;
  /** 마지막 입력이 겹쳐도 완료 저장과 다음 화면(1-1 또는 로비) 전환은 한 번만 수행한다. */
  private transitioningOut = false;

  constructor() { super("opening"); }

  create(): void {
    // 이 씬이 ready를 소유하는 동안 시작과 종료 모두 공용 수명주기 규칙으로 false를 보장한다.
    bindDebugReadyLifecycle(this.events);
    // Phaser가 같은 Scene 인스턴스를 회상에 재사용하므로 커서를 시작 노드로 되돌린다.
    this.flow = new DialogueFlow(OPENING_TRAIN);
    this.transitioningOut = false;
    setDebugScene("opening");
    // 배경 원화가 도착하기 전과 원화가 없는 빌드에서도 빈 캔버스가 아니라 어두운 판이 선다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-40);
    this.layer = new DialogueLayer(this, (choice) => this.advance(choice), { backdrop: OPENING_TRAIN.backdrop });
    this.layer.prefetch(dialogueStandingOrder(OPENING_TRAIN));
    // 첫 노드 정보를 먼저 게시하되 DialogueFlow 잠금은 제목표와 Puppet 표시가 끝날 때까지 유지한다.
    setDebugDialogue(this.flow.current);
    void this.openStory();
    if (OPENING_DEV_SKIP_ENABLED) this.addDevSkip();
    setDebugReady(true);
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  /** 개발자용 임시 건너뛰기 — 제목표·대사판보다 위에 선다. */
  private addDevSkip(): void {
    new Button(this, BASE_WIDTH - 150, 72, {
      width: 240,
      height: 64,
      label: t("opening.devSkip"),
      fontSize: 22,
      onClick: () => this.skipToLobby(),
    }).setDepth(2000);
  }

  /** 오프닝을 완료로 저장하고 1-1 전투 없이 로비로 간다. */
  private skipToLobby(): void {
    if (this.transitioningOut) return;
    this.transitioningOut = true;
    try {
      if (!storyManager.isCompleted(OPENING_TRAIN.id)) storyManager.complete(OPENING_TRAIN.id);
    } catch (error) {
      console.error("오프닝 완료 저장 실패", error);
    }
    setDebugReady(false);
    this.time.delayedCall(0, () => startScene(this, "lobby"));
  }

  /** 제목표가 걷힌 뒤에 첫 대사를 연다. 막 뒤에서 글이 먼저 흘러가지 않게 한다. */
  private async openStory(): Promise<void> {
    if (OPENING_TRAIN.titleCard) {
      await playStoryTitleCard(this, OPENING_TRAIN.titleCard);
      // 제목표가 도는 사이 씬이 닫혔으면 첫 대사를 열지 않는다.
      if (!this.scene.isActive()) return;
    }
    await this.showCurrentNode(this.flow.current);
  }

  private advance(choice?: DialogueChoice): void {
    if (this.transitioningOut) return;
    const result = this.flow.advance(choice?.id);
    if (result.effect) storyManager.applyEffect(OPENING_TRAIN.id, result.effect);
    // 폭파로 전장이 드러나는 순간부터 곧 싸울 SD를 읽어 둔다 — 남은 몇 마디가 그 시간을 벌어 준다.
    if (result.node?.cue === "explosion" && !storyManager.isCompleted(OPENING_TRAIN.id)) {
      prefetchBattlePuppets(session.party, FIXED_STAGE_ENEMIES);
    }
    if (result.completed) {
      // 완료를 확인한 즉시 후속 입력을 영구 차단해 저장과 씬 전환을 한 번만 수행한다.
      this.transitioningOut = true;
      const firstRun = !storyManager.isCompleted(OPENING_TRAIN.id);
      try {
        storyManager.complete(OPENING_TRAIN.id);
      } catch (error) {
        // 저장 실패는 다음 실행에서 오프닝을 다시 보여 주는 복구로 남기고 현재 세션의 진행은 계속한다.
        console.error("오프닝 완료 저장 실패", error);
      }
      // 로비의 비동기 Puppet까지 준비되기 전 오프닝의 true를 자동화가 재사용하지 않게 먼저 내린다.
      setDebugReady(false);
      // 로딩을 기다리는 지연이 아니라 현재 pointerup 처리와 DialogueLayer 종료를 다음 Phaser 틱으로 분리한다.
      this.time.delayedCall(0, () => { if (firstRun) void this.enterFirstBattle(); else startScene(this, "lobby"); });
      return;
    }
    void this.showCurrentNode(result.node!);
  }

  /**
   * 1-1에 곧장 들어간다. 입장(스테미나)은 지도에서 들어갈 때와 같은 서버 경계를 지난다 — 여기만
   * 비용을 건너뛰면 그 판의 결과 확정이 입장 영수증 없이 도착한다.
   *
   * 입장이 거절되면(스테미나 부족 등) 전투 대신 로비로 간다. 오프닝에 갇히지 않는 것이 먼저다.
   */
  private async enterFirstBattle(): Promise<void> {
    const stageId = "1-1";
    try {
      const requestId = globalThis.crypto?.randomUUID?.() ?? `opening-${stageId}-${Date.now()}`;
      await gameApi.enterStage({ stageId, requestId });
      if (!this.scene.isActive()) return;
      session.selectedStageId = stageId;
      // 이기면 공멸 삼인조가 날아가는 막을 거쳐 로비로 나간다.
      startScene(this, "battle", { mode: "stage", exitTo: "lobby", epilogueStoryId: OPENING_RETREAT.id });
    } catch (error) {
      console.error("오프닝 뒤 1-1 입장 실패", error);
      if (this.scene.isActive()) startScene(this, "lobby");
    }
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
