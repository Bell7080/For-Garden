import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import type { StageDef } from "../core/types";
import { setDebugScene } from "../debug";
import { CHAPTERS, SIDE_STORY_STAGE, STAGES, getStageEnemies } from "../data/stages";
import { latestUnlockedStage } from "../core/stageProgress";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { storyManager } from "../managers/StoryManager";
import { isStageUnlocked, session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { chipPoints, drawLayer, drawVignette } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { BACKGROUND } from "../ui/backgrounds";
import { NodeEnemyPreview } from "../ui/NodeEnemyPreview";
import { isEnemyPreviewNodeVisible } from "../ui/nodeEnemyPreviewLayout";
import { stageChapterNavigationLayout } from "../ui/stageChapterLayout";

/** 지도가 보이는 세로 구간. 위쪽 제목과 아래쪽 버튼을 침범하지 않는다. */
const WINDOW = { top: 500, bottom: 1560 } as const;
/** 스테이지 하나가 차지하는 세로 간격. */
const NODE_GAP = 230;
/** 드래그를 스크롤로 볼지 탭으로 볼지 가르는 거리. */
const DRAG_SLOP = 14;

/** 제목·출전·뒤로가기가 앉는 깊이. 비네트(40)보다 위, 적 편성 팝업(60)보다 아래다. */
const CHROME_DEPTH = 50;

/**
 * 스테이지 지도.
 *
 * 세로 게임이라 진행 경로가 아래에서 위로 뻗는다. 스테이지가 늘어나면 1-1은 화면 밖으로
 * 밀려나므로 지도 전체를 손으로 끌어 볼 수 있게 하고, 들어올 때는 가장 최근에 열린 곳으로
 * 자동으로 올라간다. 스테이지를 고르면 그 스테이지의 적이 위에서 내려온다.
 */
export class StageMapScene extends Phaser.Scene {
  private info!: CharacterInfoManager;
  /** 스크롤되는 지도 본체. 노드와 경로선이 전부 이 안에 있다. */
  private map!: Phaser.GameObjects.Container;
  private nodes = new Map<string, { ring: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }>();
  private selected!: string;
  private sortieButton!: Button;
  /** 다시 그릴 때도 현재 보고 있는 구역을 잃지 않는 명시적 챕터 번호다. */
  private currentChapter = 1;
  private chapterTitle!: Phaser.GameObjects.Text;
  private chapterSubtitle!: Phaser.GameObjects.Text;
  private previousChapterButton!: Button;
  private nextChapterButton!: Button;

  /** 노드 편성의 렌더와 비동기 SD 수명은 공용 프리팹이 소유한다. */
  private enemyPreview!: NodeEnemyPreview;

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

    const cx = BASE_WIDTH / 2;
    // 장축 지도 밖의 여백만 어둡게 남기고, 실제 원화는 노드와 같은 컨테이너에서 함께 스크롤한다.
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-30);

    // 지도 원화의 가장자리를 눌러 노드와 글자가 먼저 읽히게 한다. 제목·출전·뒤로가기는
    // 이 위에 얹혀 눌리지 않는다(CHROME_DEPTH).
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: 40, strength: 0.5 });

    this.chapterTitle = this.add.text(cx, 140, "", textStyle({ role: "display", size: 60 })).setOrigin(0.5).setDepth(CHROME_DEPTH);
    this.chapterSubtitle = this.add
      .text(cx, 202, "", textStyle({ role: "body", size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5)
      .setDepth(CHROME_DEPTH);

    this.enemyPreview = new NodeEnemyPreview(this, { title: "", level: 1, enemies: [], top: WINDOW.top - 40, bottom: WINDOW.bottom + 40, onEnemyClick: () => undefined });

    this.sortieButton = new Button(this, cx, BASE_HEIGHT - 180, {
      width: 340,
      height: 108,
      variant: "primary",
      accentColor: COLOR.sortie,
      accentTextColor: COLOR.sortieText,
      label: "출  전",
      fontSize: 36,
      onClick: () => {
        // 선택 kind에 맞는 한 진입점만 호출해 스토리에서 편성 화면이 열리지 않게 한다.
        this.enterSelected();
      },
    });
    this.sortieButton.setDepth(CHROME_DEPTH);
    const navigation = stageChapterNavigationLayout(BASE_WIDTH, BASE_HEIGHT);
    this.previousChapterButton = new Button(this, navigation.previous.x, navigation.previous.y, {
      width: navigation.previous.width, height: navigation.previous.height, label: "이전 구역", fontSize: 28,
      onClick: () => this.showChapter(this.currentChapter - 1),
    }).setDepth(CHROME_DEPTH);
    this.nextChapterButton = new Button(this, navigation.next.x, navigation.next.y, {
      width: navigation.next.width, height: navigation.next.height, label: "다음 구역", fontSize: 28,
      onClick: () => this.showChapter(this.currentChapter + 1),
    }).setDepth(CHROME_DEPTH);
    addBackButton(this, () => this.scene.start("lobby")).setDepth(CHROME_DEPTH);

    this.info = new CharacterInfoManager(this, 1001, "enemy");
    // 들어오면 가장 최근에 열린 스테이지로 올라가 그 스테이지를 고른 상태로 시작한다.
    const latest = this.latestUnlocked();
    this.currentChapter = latest.chapter ?? 1;
    this.buildMap();
    this.enableDragScroll();
    this.select(latest, true);
  }

  /** 클리어 상황에서 지금 도전할 수 있는 가장 뒤쪽 스테이지. */
  private latestUnlocked(): StageDef {
    return latestUnlockedStage(STAGES, session.cleared) ?? STAGES[0];
  }

  /** 잠금 검증을 통과한 챕터로만 이동하고 그 챕터의 첫 도전 가능 노드를 선택한다. */
  private showChapter(chapterId: number): void {
    const chapter = CHAPTERS.find(({ id }) => id === chapterId);
    if (!chapter || (chapter.prerequisiteStageId && !session.cleared.has(chapter.prerequisiteStageId))) return;
    this.currentChapter = chapterId;
    this.enemyPreview.dismiss();
    this.map.destroy(true);
    this.nodes.clear();
    this.buildMap();
    const target = [...chapter.stages].reverse().find((stage) => isStageUnlocked(stage.id)) ?? chapter.stages[0];
    this.select(target, true);
  }

  /** 아래에서 위로 이어지는 노드 줄. 창 밖으로 나가는 부분은 잘라 낸다. */
  private buildMap(): void {
    const cx = BASE_WIDTH / 2;
    const chapter = CHAPTERS.find(({ id }) => id === this.currentChapter) ?? CHAPTERS[0];
    // 첫 구역만 본편 배열 옆에 선택 서사 노드를 합치며 원본 본편 순서는 그대로 둔다.
    const chapterStages = this.currentChapter === 1 ? [...chapter.stages, SIDE_STORY_STAGE] : [...chapter.stages];
    this.chapterTitle.setText(chapter.title);
    this.chapterSubtitle.setText(chapter.subtitle);
    this.previousChapterButton?.setEnabled(this.currentChapter > CHAPTERS[0].id);
    const next = CHAPTERS.find(({ id }) => id === this.currentChapter + 1);
    this.nextChapterButton?.setEnabled(!!next && (!next.prerequisiteStageId || session.cleared.has(next.prerequisiteStageId)));
    this.map = this.add.container(0, 0);
    const height = (chapterStages.length - 1) * NODE_GAP;
    // 원화 하단을 1-1보다 조금 아래에 고정한다. 위 스테이지로 스크롤할수록 배경도 같은 거리만큼
    // 올라간다. 지도가 화면을 가득 채워야 하므로, 폭에 맞춘 배율로 모자라면 세로를 기준으로 키운다.
    const artBottom = 460;
    const mapArt = this.add.image(cx, artBottom, BACKGROUND.stageMap).setOrigin(0.5, 1);
    // 가장 위 스테이지까지 굴렸을 때 화면 꼭대기가 비지 않는 길이.
    const needed = artBottom + WINDOW.top + 120 + height;
    mapArt.setScale(Math.max(BASE_WIDTH / mapArt.width, needed / mapArt.height));
    this.map.add(mapArt);
    // 어두운 투명막도 지도에 묶어 원화의 이동감을 보존하면서 노드와 글자의 대비를 일정하게 한다.
    this.map.add(this.add.rectangle(cx, -height / 2, BASE_WIDTH, height + BASE_HEIGHT, COLOR.void, 0.22));
    this.map.add(this.add.line(0, 0, cx, 0, cx, -height, COLOR.panelEdge).setOrigin(0).setLineWidth(6));

    chapterStages.forEach((stage, index) => {
      const mainIndex = stage.kind === "story" ? 4 : index;
      const y = -mainIndex * NODE_GAP;
      // 서브 칩은 1-5에서 옆으로 뻗고 본편은 기존 세로축의 교차 배치를 유지한다.
      const x = stage.kind === "story" ? cx + 360 : cx + (index % 2 === 0 ? -110 : 110);
      const unlocked = isStageUnlocked(stage.id);
      const cleared = stage.kind === "story" ? session.completedStoryIds.has(stage.storyId) : session.cleared.has(stage.id);

      // 가지도 기록 보상 길 규칙처럼 얇은 실선만 써 본편 장축보다 가볍게 보인다.
      this.map.add(this.add.line(0, 0, cx, y, x, y, COLOR.panelEdge).setOrigin(0).setLineWidth(stage.kind === "story" ? 2 : 4));
      // 노드도 카드와 같은 칩 언어를 쓴다. 원형 테두리 대신 깎인 조각으로 둔다.
      this.map.add(drawLayer(this, x, y, chipPoints(96, 96, {
        bevel: { topLeft: 30, topRight: 0, bottomRight: 30, bottomLeft: 0 },
      }), {
        fill: cleared ? 0x3a3016 : 0x141920,
        alpha: unlocked ? 0.94 : 0.6,
        edge: COLOR.accent,
        edgeAlpha: unlocked ? 0.8 : 0.25,
      }));
      // 입력과 선택 표시는 투명한 원이 계속 맡는다. 손가락이 모서리에서 빠지지 않게 한다.
      const ring = this.add.circle(x, y, 48, 0xffffff, 0);
      const label = this.add
        .text(x, y, stage.id, textStyle({ role: "emphasis", size: 30, color: cleared ? "#1a1d21" : unlocked ? COLOR.ink : COLOR.inkDim }))
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
      if (this.info?.isOpen) return;
      if (pointer.y < WINDOW.top || pointer.y > WINDOW.bottom) return;
      // 편성판 밖 지도 탭은 현재 판을 먼저 닫고, 노드 탭이면 pointerup에서 새 판을 연다.
      if (this.enemyPreview?.containsScreenPoint(pointer.worldX, pointer.worldY)) return;
      this.enemyPreview?.dismiss();
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
    const main = CHAPTERS.find(({ id }) => id === this.currentChapter)?.stages ?? [];
    const chapterStages = this.currentChapter === 1 ? [...main, SIDE_STORY_STAGE] : [...main];
    const index = chapterStages.findIndex((stage) => stage.id === this.selected);
    const nodeY = this.map.y - (chapterStages[index]?.kind === "story" ? 4 : index) * NODE_GAP;
    this.enemyPreview.trackNode(nodeY, isEnemyPreviewNodeVisible(nodeY, WINDOW.top, WINDOW.bottom));
  }

  /** 고른 스테이지를 중앙으로 옮기고 공용 노드 미리보기의 내용과 꼬리를 함께 갱신한다. */
  private select(stage: StageDef, instant = false): void {
    this.selected = stage.id;
    // 저장의 전투 선택에는 스토리 노드를 넣지 않아 BattleScene이 잘못 열 가능성을 없앤다.
    session.selectedStageId = stage.kind === "battle" ? stage.id : null;
    const main = CHAPTERS.find(({ id }) => id === this.currentChapter)?.stages ?? [];
    const chapterStages = this.currentChapter === 1 ? [...main, SIDE_STORY_STAGE] : [...main];
    const index = chapterStages.findIndex((candidate) => candidate.id === stage.id);
    for (const [id, node] of this.nodes) {
      const chosen = id === stage.id;
      // 선택은 외곽선 추가가 아니라 기존 홀로그램 규칙의 확대와 글자색으로만 알린다.
      node.label.setScale(chosen ? 1.25 : 1);
      const nodeStage = STAGES.find((candidate) => candidate.id === id);
      const completed = nodeStage?.kind === "story" ? session.completedStoryIds.has(nodeStage.storyId) : session.cleared.has(id);
      node.label.setColor(chosen ? COLOR.accentText : completed ? COLOR.ink : COLOR.inkDim);
    }
    const visualIndex = stage.kind === "story" ? 4 : index;
    const scroll = Phaser.Math.Clamp((WINDOW.top + WINDOW.bottom) / 2 + visualIndex * NODE_GAP, this.scrollMin, this.scrollMax);
    this.scrollTo(scroll, !instant);
    this.sortieButton.setSub("");
    if (stage.kind === "story") {
      this.enemyPreview.dismiss();
      this.sortieButton.setLabel(storyManager.isCompleted(stage.storyId) ? "다시 보기" : "기록 읽기");
      return;
    }
    this.sortieButton.setLabel("출  전");
    const enemies = getStageEnemies(stage);
    this.enemyPreview.showAt(scroll - index * NODE_GAP, {
      title: `${stage.id}  ${stage.name}`, level: stage.enemyLevel, enemies,
      // 전투 전에도 전투와 동일한 공용 적 정보창으로 연결한다.
      onEnemyClick: (enemy) => this.info.showEnemy(enemy, { level: stage.enemyLevel }),
    });
  }

  /** 버튼 인스턴스와 시각 테마는 재사용하고 선택된 판별 유니온에 따라 목적지만 바꾼다. */
  private enterSelected(): void {
    const stage = STAGES.find(({ id }) => id === this.selected);
    if (!stage) return;
    if (stage.kind === "story") this.scene.start("stageStory", { storyId: stage.storyId });
    else { session.selectedStageId = stage.id; this.scene.start("party"); }
  }

}
