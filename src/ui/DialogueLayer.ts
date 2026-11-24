import Phaser from "phaser";
import { audioManager } from "../managers/AudioManager";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { DialogueBackdrop, DialogueChoice, DialogueNode, DialogueStandingAsset, DialogueVoice } from "../core/dialogue";
import { DialoguePlaybackClock } from "../core/dialoguePlayback";
import { settingsManager } from "../managers/SettingsManager";
import { Button } from "./Button";
import { ControlChip } from "./ControlChip";
import { addSettingsGear, settingsGearY, type SettingsGear } from "./SettingsGear";
import { t } from "../i18n";
import { anyPopupOpen } from "./PopupLayer";
import { DIALOGUE_BUBBLE } from "./dialogueBubbleLayout";
import { DialogueStage } from "./DialogueStage";
import { DIALOGUE_OVERSCAN, DIALOGUE_PANEL_TOP, DIALOGUE_VOICE } from "./dialogueStageLayout";
import { drawGlassFade, drawHairline } from "./holo";
import { addSectionTitle } from "./SectionTitle";
import { addFactionMark } from "./FactionMark";
import { DIALOGUE_PANEL, dialogueBodyHeight, dialogueChoiceShade, dialogueChoiceY } from "./dialoguePanelLayout";
import { dialogueSpeakerId, dialogueSpeakerTitle } from "./dialogueSpeakerTitle";
import { COLOR, textStyle } from "./theme";
import { wrapDialogueText } from "../core/dialogueTextWrap";
import { fitTextToBox } from "./textFit";
import { motionPolicy } from "../core/settings";
import { activeFontFamily, fontStyleFor } from "./fonts";
import { playFadeIn, playFadeOut } from "./screenTransition";

const PANEL_TOP = DIALOGUE_PANEL_TOP;

/**
 * 이야기 대사판도 **공용 대사창과 같은 문법**을 쓴다.
 *
 * 판 자체는 화면 밑동을 통째로 덮는 유리면이라 띠 한 장으로 줄일 수 없지만, 화자 이름은 판
 * 안이 아니라 **윗선에 걸터앉는 제목표**가 맡는다 — 로비·상점·정보창의 대사창과 같은 자리에
 * 같은 빗금으로 서므로, 짧은 한마디든 긴 이야기든 "누가 말하는가"가 한 양식으로 읽힌다.
 * 이름과 본문을 가르던 자리도 그 선 하나가 대신해 본문이 한 줄만큼 위로 올라온다.
 */
const PANEL_TEXT = { nameX: DIALOGUE_PANEL.name.x, bodyX: DIALOGUE_PANEL.body.x, bodyY: DIALOGUE_PANEL.body.y, nameSize: DIALOGUE_PANEL.name.size, bodySize: DIALOGUE_PANEL.body.size } as const;

/**
 * 자동 넘기기는 이야기를 오가도 유지되는 보기 습관이라 화면(레이어)이 아니라 모듈에 둔다. 저장하지 않는다 —
 * 앱을 다시 켜면 꺼진 채로 시작하는 것이 업계 표준이고, 켜 둔 채 잊은 사람이 대사를 놓치지 않는다.
 */
let autoAdvance = false;

/** 대사판 우상단 조작 칩 줄(자동·로그·숨기기). 판 윗선 바로 위, 오른쪽 끝에서 안쪽으로 붙는다. */
const DIALOGUE_TOOLS = { y: PANEL_TOP - 62, right: BASE_WIDTH - 48, width: 150, height: 62, gap: 12 } as const;
/** 자동 넘기기가 다음 줄로 넘어가기까지 기다리는 시간: 기본 + 글자당. 배속 설정은 타이핑에만 쓴다. */
const AUTO_ADVANCE_MS = { base: 1100, perCharacter: 55, retry: 500 } as const;
/** 로그에 남기는 지난 대사 수 상한. */
const LOG_LIMIT = 40;

/** 1080×1920 안전 영역 안에서 모든 스토리가 공유하는 대사/선택/스탠딩 표시다. */
export class DialogueLayer extends Phaser.GameObjects.Container {
  /** 화자 이름표. 노드마다 글자 폭이 달라지므로 판 한 장을 다시 만든다. */
  private speakerPlate?: Phaser.GameObjects.Container;
  /** 이름 아래 수식어(소속·직책) 한 줄과 엠블럼. 이름표와 함께 갈아 끼운다. */
  private speakerTitle: Phaser.GameObjects.GameObject[] = [];
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly nextMark: Phaser.GameObjects.Text;
  private readonly choiceObjects: Phaser.GameObjects.GameObject[] = [];
  /** 배경과 스탠딩, 장면 연출. 판은 글만 맡고 무대는 이 한 장이 맡는다. */
  readonly stage: DialogueStage;
  private renderGeneration = 0;
  /** 현재 노드의 타이핑을 소유해 노드 교체와 빠른 입력이 이전 콜백을 남기지 않게 한다. */
  private typingEvent?: Phaser.Time.TimerEvent;
  private pendingChoices: readonly DialogueChoice[] = [];
  private isTyping = false;
  private fullBody = "";
  /** 설정을 노드마다 다시 읽는 실행 경계라 화면을 재생성하지 않아도 다음 대사에 새 배속이 적용된다. */
  private readonly playbackClock = new DialoguePlaybackClock(() => settingsManager.get().game.textSpeed);
  /** 종료가 시작된 컨테이너에는 늦게 도착한 비동기 Puppet 결과를 다시 붙이지 않는다. */
  private terminated = false;
  /** Phaser가 Container의 scene 참조를 정리해도 생성 당시 씬의 실행 상태를 판정하는 기준이다. */
  private readonly ownerScene: Phaser.Scene;
  private readonly history: { speaker: string; body: string }[] = [];
  private autoTimer?: Phaser.Time.TimerEvent;
  private autoChip?: ControlChip;
  private logOverlay?: Phaser.GameObjects.Container;
  private hideCatcher?: Phaser.GameObjects.Rectangle;
  /**
   * 대사 도중 설정을 여는 길. 무대를 가리지 않도록 화면 위에 새 버튼을 세우지 않고 판 위 도구 줄의 넷째 칩으로 선다 —
   * 판을 숨기면 함께 숨고, 로그·선택지·확인 창이 덮는 동안에는 그 아래라 눌리지 않는다.
   */
  private readonly onSettings?: () => void;
  private settingsGear?: SettingsGear;

  constructor(
    scene: Phaser.Scene,
    private readonly onAdvance: (choice?: DialogueChoice) => void,
    options: { backdrop?: DialogueBackdrop; onSettings?: () => void } = {},
  ) {
    super(scene, 0, 0);
    this.onSettings = options.onSettings;
    this.ownerScene = scene;
    this.stage = new DialogueStage(scene, options.backdrop);
    // 대사판도 테두리를 두르지 않는다. 아래로 짙어지는 유리면과 윗선 한 줄로만 자리를 잡는다.
    // 스탠딩이 잠기는 어둠은 무대(`DialogueStage`)가 깔므로 판 자체는 옅게 시작한다.
    // 판은 화면 밑동을 넘어 좌우·아래로 더 뻗는다 — 예전에는 1880에서 끝나 밑의 40px이 비었고,
    // 진동이 오면 그 틈과 화면 가장자리가 드러났다.
    const glassTop = PANEL_TOP - 10;
    const glassHeight = BASE_HEIGHT + DIALOGUE_OVERSCAN - glassTop;
    const glass = drawGlassFade(scene, BASE_WIDTH / 2, glassTop + glassHeight / 2, BASE_WIDTH + DIALOGUE_OVERSCAN * 2, glassHeight, { topAlpha: 0.2, bottomAlpha: 0.95 });
    // 윗선은 옅게만 둔다. 짙으면 어둠에 잠겨 가던 몸을 그 줄이 다시 가로로 자른 것처럼 보인다.
    const topLine = drawHairline(scene, BASE_WIDTH / 2, PANEL_TOP - 10, BASE_WIDTH, { color: COLOR.accent, alpha: 0.14 });
    const blocker = scene.add.rectangle(BASE_WIDTH / 2, PANEL_TOP + 290, BASE_WIDTH, 620, 0xffffff, 0);
    blocker.setInteractive({ useHandCursor: true }).on("pointerup", () => {
      // 선택지가 떠 있을 때 패널 탭으로 분기를 건너뛰지 않는다.
      if (this.choiceObjects.length > 0) return;
      // 타이핑 중 첫 입력은 본문만 완성하고, 완성된 뒤의 별도 입력만 다음 노드로 진행한다.
      if (this.isTyping) { this.finishTyping(); return; }
      this.onAdvance();
    });
    this.bodyText = scene.add.text(PANEL_TEXT.bodyX, PANEL_TEXT.bodyY, "", textStyle({ role: "body", size: PANEL_TEXT.bodySize, wrap: BASE_WIDTH - 184, lineSpacing: DIALOGUE_BUBBLE.lineSpacing + 6 }));
    this.bodyText.setWordWrapCallback((text: string, object: Phaser.GameObjects.Text) => wrapDialogueText(text, object.style.wordWrapWidth ?? BASE_WIDTH - 184,
      (value) => object.context.measureText(value).width, settingsManager.get().game.language));
    this.nextMark = scene.add.text(DIALOGUE_PANEL.next.x, DIALOGUE_PANEL.next.y, "▼", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);
    this.add([glass, topLine, blocker, this.bodyText, this.nextMark]);
    this.addTools();
    this.setDepth(600);
    scene.add.existing(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // 종료 세대는 진행 중인 show를 모두 무효화해 종료된 씬에서 비동기 Puppet 결과가 되살아나는 것을 막는다.
      this.terminated = true;
      this.autoTimer?.remove(false);
      this.logOverlay?.destroy();
      this.hideCatcher?.destroy();
      this.renderGeneration += 1;
      this.cancelTyping();
    });
  }

  /**
   * 노드가 바뀔 때 이전 선택 UI를 폐기하고 무대를 그 노드에 맞춘다.
   *
   * 이름과 본문은 기다리지 않고 곧바로 세운다 — 새 스탠딩이 도착할 때까지 판이 비어 있으면
   * 입력이 먹히지 않은 것처럼 읽힌다. 무대만 기다리고, 기다리는 사이 노드가 바뀌었거나 씬이
   * 닫혔으면 늦게 도착한 스탠딩을 붙이지 않는다.
   */
  async show(node: DialogueNode): Promise<void> {
    // Phaser의 create() 안에서는 scene.isActive()가 아직 false일 수 있어도 첫 화자·본문 UI는 그려야 한다.
    if (this.terminated) return;
    const generation = ++this.renderGeneration;
    this.cancelTyping();
    this.clearChoices();
    this.setSpeaker(node.speaker, node.standing);
    this.history.push({ speaker: node.speaker, body: node.body });
    if (this.history.length > LOG_LIMIT) this.history.shift();
    this.pendingChoices = node.choices ?? [];
    this.startTyping(node.body, node.voice);
    await this.stage.present(node, () => generation === this.renderGeneration && this.isRenderOwnerActive());
  }

  /** 이 이야기가 쓰는 스탠딩을 미리 읽는다. 무대가 처음 서는 순서를 그대로 따른다. */
  prefetch(order: readonly DialogueStandingAsset[]): void { this.stage.prefetch(order); }

  /** 화자 이름표를 판 윗선에 다시 세운다. 이름 길이가 노드마다 달라 판째로 갈아 끼운다. */
  private setSpeaker(label: string, standing?: DialogueNode["standing"]): void {
    this.speakerPlate?.destroy();
    this.speakerPlate = undefined;
    this.speakerTitle.splice(0).forEach((object) => object.destroy());
    // 화자가 없는 줄은 지문이다. 이름표를 비워 두어 누가 말하는 것이 아님을 판이 말한다.
    if (!label) return;
    this.speakerPlate = addSectionTitle(this.scene, PANEL_TEXT.nameX, DIALOGUE_PANEL.name.y, label, { size: PANEL_TEXT.nameSize, parent: this });
    // 이름 아래 한 줄 — 누구 편이고 어느 자리인가. 정체를 감춘 화자(???)와 지문에는 서지 않는다.
    const title = dialogueSpeakerTitle(dialogueSpeakerId(label, standing));
    if (!title) return;
    const spec = DIALOGUE_PANEL.title;
    const mark = title.squad ? addFactionMark(this.scene, spec.x + spec.emblem / 2, spec.y, title.squad, { size: spec.emblem }) : undefined;
    const textX = mark ? spec.x + spec.emblem + spec.gap : spec.x;
    const text = this.scene.add.text(textX, spec.y, title.text, textStyle({ role: "emphasis", size: spec.size, color: COLOR.inkDim })).setOrigin(0, 0.5);
    if (mark) { this.add(mark); this.speakerTitle.push(mark); }
    this.add(text);
    this.speakerTitle.push(text);
  }

  /**
   * 현재 설정으로 글자 간격을 계산하고 본문 완성 전에는 진행 표식과 선택지를 감춘다.
   * 목소리 크기(`voice`)는 글자 크기·굵기·색과 찍히는 속도를 함께 바꾼다 — 외침은 판이 한 번 튄다.
   */
  private startTyping(body: string, voice?: DialogueVoice): void {
    const characters = Array.from(body);
    const spec = voice ? DIALOGUE_VOICE[voice] : undefined;
    const base = this.playbackClock.timingFor(body);
    const timing = spec ? { ...base, characterMs: base.characterMs * spec.speed } : base;
    this.fullBody = body;
    const size = Math.round(PANEL_TEXT.bodySize * (spec?.sizeRatio ?? 1));
    this.bodyText.setFontStyle(fontStyleFor(spec?.role ?? "body")).setColor(spec?.dim ? COLOR.inkDim : COLOR.ink);
    // 전체 문장으로 먼저 맞춰 타이핑 도중 글자 크기가 흔들리지 않게 한다.
    this.bodyText.setFontFamily(activeFontFamily()).setText(body);
    fitTextToBox(this.bodyText, { width: DIALOGUE_PANEL.body.width, height: dialogueBodyHeight() }, { size, minSize: DIALOGUE_PANEL.body.minSize, step: 1 });
    this.bodyText.setText("");
    if (spec && spec.bump > 0) this.bump(spec.bump);
    this.nextMark.setVisible(false);
    this.isTyping = characters.length > 0;
    if (!this.isTyping) { this.finishTyping(); return; }
    let visibleCount = 0;
    this.typingEvent = this.scene.time.addEvent({
      delay: timing.characterMs,
      repeat: characters.length - 1,
      callback: () => {
        // 한 타이머만 본문을 소유하며 마지막 글자에서 선택지 또는 진행 표식을 연다.
        visibleCount += 1;
        this.bodyText.setText(characters.slice(0, visibleCount).join(""));
        if (visibleCount === characters.length) this.finishTyping();
      },
    });
  }

  /** 외침 — 본문이 한 번 위로 튀었다 돌아온다. 움직임 줄이기에서는 튀지 않는다. */
  private bump(dy: number): void {
    const factor = motionPolicy(settingsManager.get()).nonEssentialDistanceFactor;
    if (factor <= 0) return;
    this.scene.tweens.killTweensOf(this.bodyText);
    this.bodyText.setY(PANEL_TEXT.bodyY);
    this.scene.tweens.add({ targets: this.bodyText, y: PANEL_TEXT.bodyY - dy * factor, duration: 70, yoyo: true, ease: "Quad.Out", onComplete: () => this.bodyText.setY(PANEL_TEXT.bodyY) });
  }

  /** 빠른 입력과 자연 완료가 공유하는 단일 완료 경계다. */
  private finishTyping(): void {
    this.typingEvent?.remove(false);
    this.typingEvent = undefined;
    this.isTyping = false;
    // Timer 완료와 빠른 입력 모두 같은 원문으로 끝나 일부 문자열이 남는 경로를 없앤다.
    this.bodyText.setText(this.fullBody);
    this.nextMark.setVisible(this.pendingChoices.length === 0);
    this.buildChoices(this.pendingChoices);
    this.scheduleAutoAdvance();
  }

  /** 자동 넘기기: 본문이 다 서면 읽을 만큼 기다렸다가 다음 줄로. 선택지가 있으면 사람이 고를 때까지 선다. */
  private scheduleAutoAdvance(): void {
    this.autoTimer?.remove(false);
    this.autoTimer = undefined;
    if (!autoAdvance || this.pendingChoices.length > 0 || this.terminated) return;
    const generation = this.renderGeneration;
    const wait = AUTO_ADVANCE_MS.base + Array.from(this.fullBody).length * AUTO_ADVANCE_MS.perCharacter;
    const tick = (delay: number): void => {
      this.autoTimer = this.scene.time.delayedCall(delay, () => {
        if (this.terminated || !autoAdvance || generation !== this.renderGeneration || this.isTyping || this.choiceObjects.length > 0) return;
        // 확인 창·로그가 떠 있거나 판을 숨긴 동안에는 넘기지 않고 기다린다.
        if (anyPopupOpen() || this.logOverlay || this.hideCatcher) { tick(AUTO_ADVANCE_MS.retry); return; }
        this.onAdvance();
      });
    };
    tick(wait);
  }

  private addTools(): void {
    const { y, right, width, height, gap } = DIALOGUE_TOOLS;
    const centerX = (index: number): number => right - width / 2 - index * (width + gap);
    this.autoChip = new ControlChip(this.ownerScene, centerX(0), y, {
      icon: "auto", label: t("dialogue.auto"), width, height,
      onClick: () => {
        autoAdvance = !autoAdvance;
        this.autoChip?.setActive(autoAdvance);
        // 켠 순간 이미 다 서 있는 대사는 바로 타이머를 건다.
        if (autoAdvance && !this.isTyping) this.scheduleAutoAdvance();
        else this.autoTimer?.remove(false);
      },
    });
    this.autoChip.setActive(autoAdvance);
    const logChip = new ControlChip(this.ownerScene, centerX(1), y, { icon: "scroll", label: t("dialogue.log"), width, height, onClick: () => this.openLog() });
    const hideChip = new ControlChip(this.ownerScene, centerX(2), y, { icon: "caret-down", label: t("dialogue.hide"), width, height, onClick: () => this.hidePanel() });
    this.add([this.autoChip, logChip, hideChip]);
    if (this.onSettings) {
      const open = this.onSettings;
      // 설정은 다른 화면과 같은 우상단 톱니다 — 대사판 칩으로 두면 같은 "설정"이 이 화면에서만 다른 자리에 선다.
      // 로그가 열려 있거나 판을 숨긴 동안에는 열지 않는다 — 돌아왔을 때 무엇을 하던 중인지 흐려진다.
      this.settingsGear = addSettingsGear(this.ownerScene, settingsGearY(), () => { if (!this.logOverlay && !this.hideCatcher) open(); });
      this.settingsGear.icon.setDepth(650);
      this.settingsGear.hit.setDepth(651);
    }
  }

  private setGearVisible(visible: boolean): void {
    this.settingsGear?.icon.setVisible(visible);
    this.settingsGear?.hit.setVisible(visible);
  }

  /** 판을 숨기고 배경·스탠딩만 보여 준다. 화면 아무 곳이나 누르면 돌아온다. */
  private hidePanel(): void {
    if (this.hideCatcher || this.choiceObjects.length > 0) return;
    this.setVisible(false);
    this.setGearVisible(false);
    this.hideCatcher = this.ownerScene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0xffffff, 0).setDepth(605).setInteractive();
    this.hideCatcher.once("pointerup", () => {
      this.hideCatcher?.destroy();
      this.hideCatcher = undefined;
      this.setVisible(true);
      this.setGearVisible(true);
      if (autoAdvance && !this.isTyping) this.scheduleAutoAdvance();
    });
  }

  /** 지난 대사 로그. 가장 최근 대사가 아래에 서고, 화면을 누르면 닫힌다. */
  private openLog(): void {
    if (this.logOverlay) return;
    const scene = this.ownerScene;
    const overlay = scene.add.container(0, 0).setDepth(720);
    const dim = scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.86).setInteractive();
    const text = scene.add.text(80, BASE_HEIGHT - 150, "", textStyle({ role: "body", size: 32, wrap: BASE_WIDTH - 160, lineSpacing: 10 })).setOrigin(0, 1);
    overlay.add([dim, text]);
    const entries = this.history.map(({ speaker, body }) => (speaker ? `${speaker}\n${body}` : body));
    let shown = "";
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const next = shown ? `${entries[i]}\n\n${shown}` : entries[i];
      text.setText(next);
      if (text.height > BASE_HEIGHT - 340 && shown) break;
      shown = next;
    }
    text.setText(shown);
    overlay.add(scene.add.text(BASE_WIDTH / 2, 90, t("dialogue.log"), textStyle({ role: "display", size: 40, color: COLOR.accentText })).setOrigin(0.5));
    dim.once("pointerup", () => {
      dim.disableInteractive();
      this.logOverlay = undefined;
      playFadeOut(scene, [overlay], () => overlay.destroy());
    });
    this.logOverlay = overlay;
    playFadeIn(scene, [overlay]);
  }

  /** 노드 교체 시 타이머와 그 타이머가 참조하던 원문을 함께 폐기한다. */
  private cancelTyping(): void {
    this.autoTimer?.remove(false);
    this.autoTimer = undefined;
    this.typingEvent?.remove(false);
    this.typingEvent = undefined;
    this.isTyping = false;
    this.fullBody = "";
  }

  /** 컨테이너와 그 컨테이너를 만든 원래 씬이 모두 렌더 가능한 동안에만 후속 연출을 허용한다. */
  private isRenderOwnerActive(): boolean {
    return !this.terminated && this.active && this.ownerScene.scene.isActive();
  }

  private buildChoices(choices: readonly DialogueChoice[]): void {
    if (choices.length === 0) return;
    const spec = DIALOGUE_PANEL.choice;
    // 선택지 뒤로 어둠을 한 겹 깔아 스탠딩·배경 위에서도 버튼과 글자가 먼저 읽히게 한다.
    const shadeSpan = dialogueChoiceShade(choices.length);
    const shade = this.scene.add.rectangle(BASE_WIDTH / 2, (shadeSpan.top + shadeSpan.bottom) / 2, BASE_WIDTH, shadeSpan.bottom - shadeSpan.top, 0x000000, spec.shadeAlpha).setDepth(609);
    this.choiceObjects.push(shade);
    playFadeIn(this.scene, [shade]);
    choices.forEach((choice, index) => {
      const button = new Button(this.scene, BASE_WIDTH / 2, dialogueChoiceY(index, choices.length), {
        width: spec.width, height: spec.height, label: choice.label, fontSize: spec.fontSize,
        onClick: () => {
          // 갈래를 고른 순간 — 대사 넘김(아무 소리 없음)과 갈리게 확정음을 낸다.
          audioManager?.playUi("ui.confirm");
          this.onAdvance(choice);
        },
      }).setDepth(610);
      this.choiceObjects.push(button);
      playFadeIn(this.scene, [button], { rise: 24 });
    });
  }

  private clearChoices(): void { this.choiceObjects.splice(0).forEach((object) => object.destroy()); }
}
