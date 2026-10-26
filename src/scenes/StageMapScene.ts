import { fitTextToBox } from "../ui/textFit";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import { STORY_DIFFICULTY, isStoryDifficultyUnlocked, storyBaseStageId, storyDifficultyOf, storyStageId, type StoryDifficulty } from "../core/storyDifficulty";
import { storyStages, ALL_STORY_STAGES } from "../data/stages";
import { openStoryDifficultyPicker } from "../ui/StoryDifficultyPopup";
import { selectStoryStage } from "../managers/StageSelectionManager";
import { followTutorialTarget } from "../ui/tutorialTarget";
import { tutorialManager } from "../managers/TutorialManager";
import { goRoute, partyRoute } from "./stageStoryRoute";
import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import type { StageDef } from "../core/types";
import { setDebugScene } from "../debug";
import { CHAPTERS, getBattleStage, getStageEnemies, stageEnemyGrowth } from "../data/stages";
import { latestUnlockedStage } from "../core/stageProgress";
import { EnemyInfoPopup } from "../ui/EnemyInfoPopup";
import { storyManager } from "../managers/StoryManager";
import { isStageUnlocked, session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { chipPoints, drawLayer, drawVignette } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { useBackgroundTexture, stageMapBackground } from "../ui/backgrounds";
import { NodeEnemyPreview } from "../ui/NodeEnemyPreview";
import { NodeStoryPreview } from "../ui/NodeStoryPreview";
import { isEnemyPreviewNodeVisible } from "../ui/nodeEnemyPreviewLayout";
import { stageChapterNavigationLayout } from "../ui/stageChapterLayout";
import { CONTENT_STAMINA_COSTS } from "../data/contentCosts";
import { stageFirstClearRewards } from "../core/stageRewards";
import { openStageRunePreview } from "../ui/StageRunePreviewPopup";
import { PopupLayer } from "../ui/PopupLayer";
import { StaminaPopup } from "../ui/StaminaPopup";
import { TopBar } from "../ui/TopBar";
import { openCurrencyGuide } from "../ui/currencyGuideEntry";
import { gameApi } from "../api/FakeServer";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { LOBBY_RETURN } from "./lobbyEntry";
import { showContentIntro } from "../ui/contentIntro";

/** 지도가 보이는 세로 구간. 위쪽 제목과 아래쪽 버튼을 침범하지 않는다. */
const WINDOW = { top: 500, bottom: 1560 } as const;
/** 스테이지 하나가 차지하는 세로 간격. */
const NODE_GAP = 230;
/** 드래그를 스크롤로 볼지 탭으로 볼지 가르는 거리. */
const DRAG_SLOP = TAP_DRAG_SLOP;

/** 챕터 제목 두 줄. 상단 재화 줄(y 40~136) 아래에 선다. */
const STAGE_MAP_TITLE = { titleY: 205, subtitleY: 278, titleSize: 62, subtitleSize: 36, titleWidth: 900, difficultyY: 392, bandHeight: 470 } as const;

/**
 * 전투·편성에서 돌아올 때 방금 보던 관문을 유지하기 위한 기억. 스토리를 완전히 나가면(뒤로가기) 지워서
 * 다음 입장은 다시 가장 최근에 열린 관문으로 올라간다. 모듈 변수라 저장에 섞이지 않는다.
 */
let resumeStageId: string | undefined;

/** 제목·출전·뒤로가기가 앉는 깊이. 비네트(40)보다 위, 적 편성 팝업(60)보다 아래다. */
const CHROME_DEPTH = 50;

/**
 * 스테이지 지도.
 *
 * 세로 게임이라 진행 경로가 아래에서 위로 뻗는다. 스테이지가 늘어나면 1-1은 화면 밖으로
 * 밀려나므로 지도 전체를 손으로 끌어 볼 수 있게 하고, 들어올 때는 가장 최근에 열린 곳으로
 * 자동으로 올라간다. 스테이지를 고르면 그 스테이지의 적이 위에서 내려온다.
 */
/** 지도 옆가지(SUB)로 서는 노드 — 이야기 서브와 전투 서브. 본편 세로축에 끼지 않는다. */
function drawTitleShade(scene: Phaser.Scene): void {
  const { bandHeight } = STAGE_MAP_TITLE;
  const g = scene.add.graphics().setDepth(CHROME_DEPTH - 1);
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    g.fillStyle(0x05070a, 0.62 * (1 - i / steps) ** 1.6);
    g.fillRect(0, i * (bandHeight / steps), BASE_WIDTH, bandHeight / steps + 1);
  }
}

function isSubNode(stage: StageDef): boolean {
  return stage.kind === "story" || stage.sub === true;
}

export class StageMapScene extends Phaser.Scene {
  private info!: EnemyInfoPopup;
  /** 적 팝업과 그 위에 쌓이는 스킬·용어 쪽지가 함께 사는 층이다. */
  private enemyPopups!: PopupLayer;
  /** 스크롤되는 지도 본체. 노드와 경로선이 전부 이 안에 있다. */
  private map!: Phaser.GameObjects.Container;
  private nodes = new Map<string, { ring: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }>();
  private selected!: string;
  private sortieButton!: Button;
  /** 다시 그릴 때도 현재 보고 있는 구역을 잃지 않는 명시적 챕터 번호다. */
  private currentChapter = 1;
  private difficulty: StoryDifficulty = "easy";
  private difficultyButton?: Button;
  private chapterTitle!: Phaser.GameObjects.Text;
  private chapterSubtitle!: Phaser.GameObjects.Text;
  private previousChapterButton!: Button;
  private nextChapterButton!: Button;

  /** 노드 편성의 렌더와 비동기 SD 수명은 공용 프리팹이 소유한다. */
  private enemyPreview!: NodeEnemyPreview;
  /** 서브(SUB) 노드의 줄거리 판. 전투 판과 한 번에 하나만 선다. */
  private storyPreview!: NodeStoryPreview;
  /** 서사 노드용 출전 버튼. 전투 버튼과 같은 자리에 서고 비용이 없다. */
  private storyButton!: Button;

  private scrollMin = 0;
  private scrollMax = 0;
  private dragging = false;
  private dragMoved = 0;
  private dragOrigin = 0;

  constructor() {
    super("stageMap");
  }

  create(): void {
    setDebugScene("stageMap");
    this.nodes.clear();
    this.difficulty = storyDifficultyOf(session.selectedStageId);
    if (!isStoryDifficultyUnlocked(this.difficulty, session.cleared)) this.difficulty = "easy";

    const cx = BASE_WIDTH / 2;
    // 장축 지도 밖의 여백만 어둡게 남기고, 실제 원화는 노드와 같은 컨테이너에서 함께 스크롤한다.
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-30);

    // 지도 원화의 가장자리를 눌러 노드와 글자가 먼저 읽히게 한다. 제목·출전·뒤로가기는
    // 이 위에 얹혀 눌리지 않는다(CHROME_DEPTH).
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: 40, strength: 0.5 });

    // 스토리 입장은 스테미나를 쓰므로 위에 재화 줄을 세운다 — 다른 던전 입구와 같은 한 장이다.
    // 스테미나 칸을 누르면 그 자리에서 충전 창이 열린다. 제목은 그 줄 아래로 내려선다.
    // 제목 뒤에 위에서 내려오는 어둠을 한 겹 깐다 — 판때기 없이 가장자리가 스며들어 원화 위에서도 글이 먼저 읽힌다.
    drawTitleShade(this);
    new TopBar(this, 40, { profile: false, depth: CHROME_DEPTH, onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.enemyPopups }, currency) });
    this.chapterTitle = this.add.text(cx, STAGE_MAP_TITLE.titleY, "", textStyle({ role: "display", size: STAGE_MAP_TITLE.titleSize })).setOrigin(0.5).setDepth(CHROME_DEPTH).setShadow(0, 4, "#05070a", 8, false, true);
    this.chapterSubtitle = this.add
      .text(cx, STAGE_MAP_TITLE.subtitleY, "", textStyle({ role: "emphasis", size: STAGE_MAP_TITLE.subtitleSize, color: COLOR.ink }))
      .setOrigin(0.5)
      .setDepth(CHROME_DEPTH)
      .setShadow(0, 3, "#05070a", 6, false, true);

    this.enemyPreview = new NodeEnemyPreview(this, { title: "", growth: [], enemies: [], top: WINDOW.top - 40, bottom: WINDOW.bottom + 40, onEnemyClick: () => undefined });
    this.storyPreview = new NodeStoryPreview(this, { title: "", summary: "", read: false, top: WINDOW.top - 40, bottom: WINDOW.bottom + 40 });

    // **전투 관문의 출전은 드는 스테미나를 버튼 위에 박는다** — 던전 입구·레이드 판과 같은 비용 표기다.
    // 이긴 판에서만 빠지지만(`charged-on-victory`) 얼마가 걸려 있는지는 누르기 전에 읽혀야 한다.
    // 서사 노드는 스테미나를 쓰지 않으므로 비용 없는 버튼이 같은 자리에서 갈아 선다.
    const stageCost = CONTENT_STAMINA_COSTS.normalStage;
    this.sortieButton = new Button(this, cx, BASE_HEIGHT - 180, {
      width: 380,
      height: 108,
      variant: "primary",
      accentColor: COLOR.sortie,
      accentTextColor: COLOR.sortieText,
      label: t("stageMap.sortie"),
      fontSize: 36,
      cost: { icon: "currency-stamina", amount: stageCost, affordable: session.wallet.stamina >= stageCost },
      // 선택 kind에 맞는 한 진입점만 호출해 스토리에서 편성 화면이 열리지 않게 한다.
      onClick: () => this.enterSelected(),
    });
    this.sortieButton.setDepth(CHROME_DEPTH);
    this.storyButton = new Button(this, cx, BASE_HEIGHT - 180, {
      width: 380, height: 108, variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText,
      label: t("stageMap.readRecord"), fontSize: 36,
      onClick: () => this.enterSelected(),
    });
    this.storyButton.setDepth(CHROME_DEPTH).setVisible(false).setEnabled(false);
    const navigation = stageChapterNavigationLayout(BASE_WIDTH, BASE_HEIGHT);
    this.previousChapterButton = new Button(this, navigation.previous.x, navigation.previous.y, {
      width: navigation.previous.width, height: navigation.previous.height, label: t("stageMap.prevZone"), fontSize: 28,
      onClick: () => this.showChapter(this.currentChapter - 1),
    }).setDepth(CHROME_DEPTH);
    this.nextChapterButton = new Button(this, navigation.next.x, navigation.next.y, {
      width: navigation.next.width, height: navigation.next.height, label: t("stageMap.nextZone"), fontSize: 28,
      onClick: () => this.showChapter(this.currentChapter + 1),
    }).setDepth(CHROME_DEPTH);
    addBackButton(this, () => { resumeStageId = undefined; startScene(this, "lobby", LOBBY_RETURN.sortie); }).setDepth(CHROME_DEPTH);

    // 적은 정보창 씬이 아니라 팝업 한 장으로 연다 — 유대·급여·룬이 없어 판을 다 쓰면 초라하다.
    this.enemyPopups = new PopupLayer(this, 2200);
    this.info = new EnemyInfoPopup(this, this.enemyPopups);
    // 들어오면 가장 최근에 열린 스테이지로 올라가 그 스테이지를 고른 상태로 시작한다.
    const tutorialStage = tutorialManager.battleStage();
    if (tutorialStage) this.difficulty = "easy";
    const resumed = resumeStageId ? storyStages(this.difficulty).find(({ id }) => id === resumeStageId) : undefined;
    const latest = tutorialStage ? getBattleStage(tutorialStage) : resumed && isStageUnlocked(resumed.id) ? resumed : this.latestUnlocked();
    this.currentChapter = latest.chapter ?? 1;
    this.buildMap();
    this.enableDragScroll();
    this.select(latest, true);
    this.refreshDifficultyButton();
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
    showContentIntro(this, "stageMap");
    followTutorialTarget(this, {
      enabled: () => tutorialManager.battleStage() !== undefined,
      blocked: () => this.enemyPopups.isOpen,
      rect: () => this.sortieButton.getBounds(), text: () => t("tutorial.stage.enter", { stage: tutorialManager.battleStage() ?? "" }),
    });
  }

  /** 클리어 상황에서 지금 도전할 수 있는 가장 뒤쪽 스테이지. */
  private latestUnlocked(): StageDef {
    return latestUnlockedStage(storyStages(this.difficulty), session.cleared) ?? storyStages(this.difficulty)[0];
  }

  private chapters() {
    return CHAPTERS.map(chapter => ({ ...chapter,
      prerequisiteStageId: chapter.prerequisiteStageId ? storyStageId(this.difficulty, chapter.prerequisiteStageId) : undefined,
      stages: storyStages(this.difficulty).filter(stage => stage.chapter === chapter.id && !isSubNode(stage)),
    }));
  }

  private refreshDifficultyButton(): void {
    this.difficultyButton?.destroy();
    const tone = STORY_DIFFICULTY[this.difficulty];
    this.difficultyButton = new Button(this, BASE_WIDTH / 2, STAGE_MAP_TITLE.difficultyY, { width: 270, height: 82,
      label: `${t(`storyDifficulty.${this.difficulty}`)} ▾`, fontSize: 30, accentColor: tone.color, accentTextColor: tone.text,
      onClick: () => openStoryDifficultyPicker(this, this.enemyPopups, this.difficulty, difficulty => this.changeDifficulty(difficulty)),
    }).setDepth(CHROME_DEPTH);
  }

  private changeDifficulty(difficulty: StoryDifficulty): void {
    if (!isStoryDifficultyUnlocked(difficulty, session.cleared) || difficulty === this.difficulty) return;
    this.difficulty = difficulty;
    const tutorialStage = tutorialManager.battleStage();
    if (tutorialStage) this.difficulty = "easy";
    const latest = tutorialStage ? getBattleStage(tutorialStage) : this.latestUnlocked();
    this.currentChapter = latest.chapter ?? 1;
    this.enemyPreview.dismiss(); this.storyPreview.dismiss();
    this.tweens.killTweensOf(this.map);
    this.map.destroy(true); this.nodes.clear();
    this.buildMap(); this.select(latest, true); this.refreshDifficultyButton();
  }

  /** 잠금 검증을 통과한 챕터로만 이동하고 그 챕터의 첫 도전 가능 노드를 선택한다. */
  private showChapter(chapterId: number): void {
    const chapter = this.chapters().find(({ id }) => id === chapterId);
    if (!chapter || (chapter.prerequisiteStageId && !session.cleared.has(chapter.prerequisiteStageId))) return;
    this.currentChapter = chapterId;
    this.enemyPreview.dismiss();
    this.storyPreview.dismiss();
    this.map.destroy(true);
    this.nodes.clear();
    this.buildMap();
    const target = [...chapter.stages].reverse().find((stage) => isStageUnlocked(stage.id)) ?? chapter.stages[0];
    this.select(target, true);
  }

  /** 그 구역의 지도 노드 — 본편 관문에 서브(SUB)를 더한 것이다. 본편 순서는 그대로 둔다. */
  private chapterStages(chapterId: number): StageDef[] {
    return storyStages(this.difficulty).filter(stage => stage.chapter === chapterId);
  }

  /** 노드가 서는 세로 칸. 서브는 갈라져 나온 본편 관문과 같은 높이다. */
  private rowOf(stage: StageDef, index: number): number {
    return isSubNode(stage) ? (stage.chapterOrder ?? 1) - 1 : index;
  }

  /**
   * 노드의 가로 자리. 본편은 세로축 양옆으로 교차하고, 서브는 **갈라져 나온 본편 관문의 반대편**으로 뻗는다 —
   * 같은 쪽으로 뻗으면 서브의 가지선이 그 본편 노드를 지나가 두 길이 한 줄로 겹쳐 보인다.
   */
  private nodeX(stage: StageDef, index: number): number {
    const cx = BASE_WIDTH / 2;
    const mainOffset = (row: number): number => (row % 2 === 0 ? -110 : 110);
    if (!isSubNode(stage)) return cx + mainOffset(index);
    return cx + (mainOffset(this.rowOf(stage, index)) < 0 ? 360 : -360);
  }

  /** 서브 노드가 열려 있는가·읽었는가. 전투 관문은 클리어 기록이 말한다. */
  private isCompleted(stage: StageDef): boolean {
    return stage.kind === "story" ? session.completedStoryIds.has(stage.storyId) : session.cleared.has(stage.id);
  }

  /** 아래에서 위로 이어지는 노드 줄. 창 밖으로 나가는 부분은 잘라 낸다. */
  private buildMap(): void {
    const cx = BASE_WIDTH / 2;
    const tone = STORY_DIFFICULTY[this.difficulty];
    const chapter = this.chapters().find(({ id }) => id === this.currentChapter) ?? this.chapters()[0];
    const chapterStages = this.chapterStages(this.currentChapter);
    this.chapterTitle.setText(chapter.title).setColor(tone.text);
    fitTextToBox(this.chapterTitle, { width: STAGE_MAP_TITLE.titleWidth, height: 80 }, { size: STAGE_MAP_TITLE.titleSize, minSize: 32 });
    this.chapterSubtitle.setText(chapter.subtitle);
    this.previousChapterButton?.setEnabled(this.currentChapter > this.chapters()[0].id);
    const next = this.chapters().find(({ id }) => id === this.currentChapter + 1);
    this.nextChapterButton?.setEnabled(!!next && (!next.prerequisiteStageId || session.cleared.has(next.prerequisiteStageId)));
    this.map = this.add.container(0, 0);
    const height = (chapter.stages.length - 1) * NODE_GAP;
    // 원화 하단을 1-1보다 조금 아래에 고정한다. 위 스테이지로 스크롤할수록 배경도 같은 거리만큼
    // 올라간다. 지도가 화면을 가득 채워야 하므로, 폭에 맞춘 배율로 모자라면 세로를 기준으로 키운다.
    const artBottom = 460;
    const mapArt = this.add.image(cx, artBottom, "__DEFAULT").setOrigin(0.5, 1);
    // 가장 위 스테이지까지 굴렸을 때 화면 꼭대기가 비지 않는 길이.
    const needed = artBottom + WINDOW.top + 120 + height;
    // 지도 원화는 25MB짜리라 이 화면에 들어올 때 읽고 나갈 때 내린다. 늦게 도착해도 배율
    // 규칙을 같은 자리에서 다시 적용해야 화면마다 값이 갈리지 않는다.
    useBackgroundTexture(this, mapArt, stageMapBackground(this.currentChapter), (art) => {
      art.setTint(this.difficulty === "easy" ? 0xfff4d9 : this.difficulty === "normal" ? 0xffceb0 : 0xffadb8);
      art.setScale(Math.max(BASE_WIDTH / art.width, needed / art.height));
    });
    this.map.add(mapArt);
    // 어두운 투명막도 지도에 묶어 원화의 이동감을 보존하면서 노드와 글자의 대비를 일정하게 한다.
    this.map.add(this.add.rectangle(cx, -height / 2, BASE_WIDTH, height + BASE_HEIGHT, COLOR.void, 0.22));
    this.map.add(this.add.line(0, 0, cx, 0, cx, -height, COLOR.panelEdge).setOrigin(0).setLineWidth(6));

    chapterStages.forEach((stage, index) => {
      const mainIndex = this.rowOf(stage, index);
      const y = -mainIndex * NODE_GAP;
      // 서브 칩은 갈라진 본편 관문의 반대편으로 뻗고 본편은 기존 세로축의 교차 배치를 유지한다.
      const x = this.nodeX(stage, index);
      const unlocked = isStageUnlocked(stage.id);
      const cleared = this.isCompleted(stage);

      // 가지도 기록 보상 길 규칙처럼 얇은 실선만 써 본편 장축보다 가볍게 보인다.
      this.map.add(this.add.line(0, 0, cx, y, x, y, COLOR.panelEdge).setOrigin(0).setLineWidth(isSubNode(stage) ? 2 : 4));
      // 노드도 카드와 같은 칩 언어를 쓴다. 원형 테두리 대신 깎인 조각으로 둔다.
      this.map.add(drawLayer(this, x, y, chipPoints(96, 96, {
        bevel: { topLeft: 30, topRight: 0, bottomRight: 30, bottomLeft: 0 },
      }), {
        fill: cleared ? tone.fill : 0x141920,
        alpha: unlocked ? 0.94 : 0.6,
        edge: tone.color,
        edgeAlpha: unlocked ? 0.8 : 0.25,
      }));
      // 입력과 선택 표시는 투명한 원이 계속 맡는다. 손가락이 모서리에서 빠지지 않게 한다.
      const ring = this.add.circle(x, y, 48, 0xffffff, 0);
      const label = this.add
        .text(x, y, isSubNode(stage) ? t("stageMap.sub") : storyBaseStageId(stage.id), textStyle({ role: "emphasis", size: 30, color: cleared ? "#1a1d21" : unlocked ? COLOR.ink : COLOR.inkDim }))
        .setOrigin(0.5);
      const name = this.add
        .text(x, y + 66, stage.name, textStyle({ role: "display", size: 28, color: unlocked ? COLOR.ink : COLOR.inkDim }))
        .setOrigin(0.5, 0);
      this.map.add([ring, label, name]);
      this.nodes.set(stage.id, { ring, label });

      if (!unlocked) {
        name.setAlpha(0.5);
        return;
      }
      ring.setInteractive({ useHandCursor: true }).on("pointerup", () => {
        // 지도를 끌던 손가락이 노드 위에서 떨어져도 스테이지가 바뀌지 않게 한다.
        if (this.dragMoved > DRAG_SLOP) return;
        this.select(stage);
      });
    });

    // 창 밖(제목·버튼 자리)으로 넘어간 노드는 그리지 않는다.
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    // 지도는 화면을 가득 채운다. 제목과 출전 버튼은 그 위에 얹히므로 잘라 낼 이유가 없다.
    mask.fillStyle(0xffffff).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    this.map.setMask(mask.createGeometryMask());

    // 1-1이 창 아래에 걸릴 때와 마지막 스테이지가 창 위에 걸릴 때가 스크롤의 양 끝이다.
    this.scrollMin = WINDOW.bottom - 90;
    this.scrollMax = Math.max(this.scrollMin, WINDOW.top + 120 + height);
  }

  /** 손가락으로 끌어 지도를 굴린다. 휠도 같은 경로로 처리한다. */
  private enableDragScroll(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // 정보창이 떠 있으면 그 위에서의 손짓은 뒤의 지도를 건드리지 않는다.
      if (this.enemyPopups?.isOpen) return;
      if (pointer.y < WINDOW.top || pointer.y > WINDOW.bottom) return;
      // 편성판 밖 지도 탭은 현재 판을 먼저 닫고, 노드 탭이면 pointerup에서 새 판을 연다.
      if (this.enemyPreview?.containsScreenPoint(pointer.worldX, pointer.worldY) || this.storyPreview?.containsScreenPoint(pointer.worldX, pointer.worldY)) return;
      this.enemyPreview?.dismiss();
      this.storyPreview?.dismiss();
      this.dragging = true;
      this.dragMoved = 0;
      this.dragOrigin = this.map.y - pointer.y;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      this.dragMoved += Math.abs(pointer.velocity.y);
      this.scrollTo(this.dragOrigin + pointer.y);
    });
    this.input.on("pointerup", () => {
      this.dragging = false;
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollTo(this.map.y - dy));
  }

  private scrollTo(y: number, tween = false): void {
    const clamped = Phaser.Math.Clamp(y, this.scrollMin, this.scrollMax);
    if (!tween) {
      this.map.y = clamped;
      this.trackSelectedPreview();
      return;
    }
    this.tweens.add({ targets: this.map, y: clamped, duration: 420, ease: "Cubic.Out", onUpdate: () => this.trackSelectedPreview() });
  }

  /** 지도 이동 중 선택 노드의 실제 화면 Y를 계산해 판과 SD를 계속 같은 노드에 붙인다. */
  private trackSelectedPreview(): void {
    if (!this.enemyPreview || !this.selected) return;
    const chapterStages = this.chapterStages(this.currentChapter);
    const index = chapterStages.findIndex((stage) => stage.id === this.selected);
    const nodeY = this.map.y - this.rowOf(chapterStages[index], index) * NODE_GAP;
    const visible = isEnemyPreviewNodeVisible(nodeY, WINDOW.top, WINDOW.bottom);
    if (chapterStages[index]?.kind === "story") this.storyPreview.trackNode(nodeY, visible);
    else this.enemyPreview.trackNode(nodeY, visible);
  }

  /** 고른 스테이지를 중앙으로 옮기고 공용 노드 미리보기의 내용과 꼬리를 함께 갱신한다. */
  private select(stage: StageDef, instant = false): void {
    this.selected = stage.id;
    resumeStageId = stage.id;
    // 저장의 전투 선택에는 스토리 노드를 넣지 않아 BattleScene이 잘못 열 가능성을 없앤다.
    if (stage.kind === "battle") selectStoryStage(stage.id);
    const index = this.chapterStages(this.currentChapter).findIndex((candidate) => candidate.id === stage.id);
    for (const [id, node] of this.nodes) {
      const chosen = id === stage.id;
      // 선택은 외곽선 추가가 아니라 기존 홀로그램 규칙의 확대와 글자색으로만 알린다.
      node.label.setScale(chosen ? 1.25 : 1);
      const nodeStage = ALL_STORY_STAGES.find((candidate) => candidate.id === id);
      const completed = nodeStage ? this.isCompleted(nodeStage) : false;
      node.label.setColor(chosen ? STORY_DIFFICULTY[this.difficulty].text : completed ? COLOR.ink : COLOR.inkDim);
    }
    const visualIndex = this.rowOf(stage, index);
    // **전투 관문은 창 아래쪽에 세운다.** 스토리 판은 적 칸·줄거리·초회 보상까지 서서 원정 판보다
    // 한참 높아, 노드를 창 가운데에 두면 위에도 아래에도 자리가 모자라 판이 노드를 덮는다. 아래에
    // 두면 판이 노드 위로 온전히 선다(맨 위 관문은 스크롤 끝에 걸려 판이 아래로 뒤집힌다).
    const anchorY = stage.kind === "battle" ? WINDOW.bottom - 90 : (WINDOW.top + WINDOW.bottom) / 2;
    const scroll = Phaser.Math.Clamp(anchorY + visualIndex * NODE_GAP, this.scrollMin, this.scrollMax);
    this.scrollTo(scroll, !instant);
    const story = stage.kind === "story";
    this.sortieButton.setVisible(!story).setEnabled(!story);
    this.storyButton.setVisible(story).setEnabled(story);
    if (stage.kind === "story") {
      this.enemyPreview.dismiss();
      this.storyButton.setLabel(storyManager.isCompleted(stage.storyId) ? t("stageMap.replay") : t("stageMap.readRecord"));
      // 전투 판에서 캐릭터를 뺀 모양 — 이름과 줄거리가 판으로 선다.
      this.storyPreview.showAt(scroll - visualIndex * NODE_GAP, {
        title: `${t("stageMap.sub")}  ${stage.name}`,
        summary: t(`recollection.summary.${stage.storyId}` as TextKey),
        read: storyManager.isCompleted(stage.storyId),
      });
      return;
    }
    this.storyPreview.dismiss();
    const enemies = getStageEnemies(stage);
    this.enemyPreview.showAt(scroll - visualIndex * NODE_GAP, {
      // 성장 스냅샷은 능력치 사본과 **같은 자리 순서**로 넘긴다 — 배열 순서로 넘기면 아모의
      // 레벨이 리파 밑에 적힌다.
      title: stage.sub ? `${t("stageMap.sub")}  ${stage.name}` : `${storyBaseStageId(stage.id)}  ${stage.name}`, growth: stageEnemyGrowth(stage), enemies, elite: stage.elite === true,
      // 서사가 없는 관문은 `undefined`가 그대로 넘어가 직전 노드의 줄이 남지 않는다.
      situation: stage.situation,
      // 초회 보상은 판 맨 아래 한 줄로 늘 선다. 이미 깬 관문이면 받은 표시(검은 막 + 노란 체크)다.
      sections: {
        rewards: stageFirstClearRewards(stage), rewardsClaimed: session.cleared.has(stage.id),
        onRuneClick: (reward, point) => openStageRunePreview(this, this.enemyPopups, reward, point),
      },
      // 전투 전에도 전투와 동일한 공용 적 정보창으로 연결한다.
      // 미리보기가 그 칸의 성장 상태를 함께 넘긴다 — 화면이 배열에서 다시 찾지 않는다.
      onEnemyClick: (enemy, growth) => this.info.show({ def: enemy, level: growth.level, breakthrough: growth.breakthrough }),
    });
  }

  /** 버튼 인스턴스와 시각 테마는 재사용하고 선택된 판별 유니온에 따라 목적지만 바꾼다. */
  private enterSelected(): void {
    const stage = ALL_STORY_STAGES.find(({ id }) => id === this.selected);
    if (!stage) return;
    if (stage.kind === "story") startScene(this, "stageStory", { storyId: stage.storyId });
    else {
      // 편성 화면에 들어가기 전 출전 버튼에서 먼저 막아, 부족함을 확인한 사용자가 헛된 편성을 하지 않게 한다.
      if (session.wallet.stamina < CONTENT_STAMINA_COSTS.normalStage) {
        new StaminaPopup(this, new PopupLayer(this, 2200), gameApi).open();
        return;
      }
      if (!selectStoryStage(stage.id)) return;
      goRoute(this, partyRoute(stage.id));
    }
  }

}
