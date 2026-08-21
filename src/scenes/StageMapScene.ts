import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import type { StageDef } from "../core/types";
import { setDebugScene } from "../debug";
import { STAGES, getStageEnemies } from "../data/stages";
import { CharacterInfoManager, ROLE_LABEL } from "../managers/CharacterInfoManager";
import type { PuppetCreature } from "../puppets/assets";
import { battleAssetFor, spawnPuppet } from "../puppets/assets";
import { isStageUnlocked, session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { chipPoints, drawHairline, drawLayer, drawVignette } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { BACKGROUND } from "../ui/backgrounds";

/** 지도가 보이는 세로 구간. 위쪽 제목과 아래쪽 버튼을 침범하지 않는다. */
const WINDOW = { top: 500, bottom: 1560 } as const;
/** 스테이지 하나가 차지하는 세로 간격. */
const NODE_GAP = 230;
/** 드래그를 스크롤로 볼지 탭으로 볼지 가르는 거리. */
const DRAG_SLOP = 14;

/**
 * 고른 스테이지 바로 위에 뜨는 적 편성 팝업.
 *
 * 화면 위쪽에 붙은 큰 패널은 구역 제목과 자리를 다퉜다. 고른 노드는 언제나 창 한가운데로
 * 올라오므로, 그 바로 위에 작은 팝업을 띄우면 어느 스테이지의 적인지도 함께 읽힌다.
 */
const POPUP = { width: 840, height: 320, sdHeight: 168 } as const;
/** 팝업 가운데를 기준으로 한 세 칸의 가로 위치. */
const POPUP_COLUMNS = [-256, 0, 256];
/** 제목·출전·뒤로가기가 앉는 깊이. 비네트(40)보다 위, 적 편성 팝업(60)보다 아래다. */
const CHROME_DEPTH = 50;

/** 고른 노드가 멈추는 화면 높이. 팝업은 이 위에 뜬다. */
const NODE_FOCUS_Y = (WINDOW.top + WINDOW.bottom) / 2;

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

  /** 적 편성 팝업. */
  private panel!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
  private panelTail!: Phaser.GameObjects.Graphics;
  private panelSlots: {
    name: Phaser.GameObjects.Text;
    detail: Phaser.GameObjects.Text;
    hit: Phaser.GameObjects.Rectangle;
    creature?: PuppetCreature;
  }[] = [];
  private panelRequest = 0;
  private panelShown = false;
  /** 패널이 완전히 내려왔는지. SD는 그때부터 보인다. */
  private panelDown = false;

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
    this.panelSlots = [];
    this.panelShown = false;
    this.panelDown = false;
    this.panelRequest = 0;

    const cx = BASE_WIDTH / 2;
    // 장축 지도 밖의 여백만 어둡게 남기고, 실제 원화는 노드와 같은 컨테이너에서 함께 스크롤한다.
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-30);

    // 지도 원화의 가장자리를 눌러 노드와 글자가 먼저 읽히게 한다. 제목·출전·뒤로가기는
    // 이 위에 얹혀 눌리지 않는다(CHROME_DEPTH).
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: 40, strength: 0.5 });

    this.add.text(cx, 140, "제 1 구역", textStyle({ role: "display", size: 60 })).setOrigin(0.5).setDepth(CHROME_DEPTH);
    this.add
      .text(cx, 202, "격리 구역 — 이터널 시티 외곽", textStyle({ role: "body", size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5)
      .setDepth(CHROME_DEPTH);

    this.buildMap();
    this.buildPanel();

    this.sortieButton = new Button(this, cx, BASE_HEIGHT - 180, {
      width: 340,
      height: 108,
      variant: "primary",
      accentColor: COLOR.sortie,
      accentTextColor: COLOR.sortieText,
      label: "출  전",
      fontSize: 36,
      onClick: () => {
        session.selectedStageId = this.selected;
        this.scene.start("party");
      },
    });
    this.sortieButton.setDepth(CHROME_DEPTH);
    addBackButton(this, () => this.scene.start("lobby")).setDepth(CHROME_DEPTH);

    this.info = new CharacterInfoManager(this);
    // 들어오면 가장 최근에 열린 스테이지로 올라가 그 스테이지를 고른 상태로 시작한다.
    this.select(this.latestUnlocked(), true);
  }

  /** 클리어 상황에서 지금 도전할 수 있는 가장 뒤쪽 스테이지. */
  private latestUnlocked(): StageDef {
    const unlocked = STAGES.filter((stage) => isStageUnlocked(stage.id));
    return unlocked[unlocked.length - 1] ?? STAGES[0];
  }

  /** 아래에서 위로 이어지는 노드 줄. 창 밖으로 나가는 부분은 잘라 낸다. */
  private buildMap(): void {
    const cx = BASE_WIDTH / 2;
    this.map = this.add.container(0, 0);
    const height = (STAGES.length - 1) * NODE_GAP;
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

    STAGES.forEach((stage, index) => {
      const y = -index * NODE_GAP;
      // 좌우로 살짝 어긋나게 놓아 단조로운 일자 배치를 피한다.
      const x = cx + (index % 2 === 0 ? -110 : 110);
      const unlocked = isStageUnlocked(stage.id);
      const cleared = session.cleared.has(stage.id);

      this.map.add(this.add.line(0, 0, cx, y, x, y, COLOR.panelEdge).setOrigin(0).setLineWidth(4));
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
    this.enableDragScroll();
  }

  /** 손가락으로 끌어 지도를 굴린다. 휠도 같은 경로로 처리한다. */
  private enableDragScroll(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // 정보창이 떠 있으면 그 위에서의 손짓은 뒤의 지도를 건드리지 않는다.
      if (this.info?.isOpen) return;
      if (pointer.y < WINDOW.top || pointer.y > WINDOW.bottom) return;
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
      return;
    }
    this.tweens.add({ targets: this.map, y: clamped, duration: 420, ease: "Cubic.Out" });
  }

  /** 고른 노드 위에 뜨는 적 편성 팝업. 내용만 갈아 끼우고 한 번만 만든다. */
  private buildPanel(): void {
    // 노드보다 위, 지도보다 앞. 팝업 가운데가 원점이라 자리를 옮겨도 안쪽 좌표는 그대로다.
    this.panel = this.add.container(BASE_WIDTH / 2, NODE_FOCUS_Y - POPUP.height / 2 - 96).setDepth(60).setVisible(false);
    const unit = Math.min(POPUP.width, POPUP.height);
    const bevel = unit * 0.16;
    this.panel.add(drawLayer(this, 0, 0, chipPoints(POPUP.width, POPUP.height, {
      bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 },
    }), { fill: 0x0b0f15, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.55 }));
    // 팝업이 어느 노드에 붙은 것인지 짧은 선이 알려 준다. 방향은 붙는 자리에 따라 바뀐다.
    this.panelTail = this.add.graphics();
    this.panel.add(this.panelTail);

    // 제목도 잘린 왼쪽 위를 피해 안쪽에서 시작한다.
    this.panelTitle = this.add.text(-POPUP.width / 2 + bevel * 0.7, -POPUP.height / 2 + 24, "", textStyle({ role: "display", size: 32 })).setOrigin(0, 0);
    this.panel.add(this.panelTitle);
    this.panel.add(this.add.text(POPUP.width / 2 - 30, -POPUP.height / 2 + 28, "적 편성", textStyle({ role: "emphasis", size: 22, color: COLOR.dangerText })).setOrigin(1, 0));
    this.panel.add(drawHairline(this, 0, -POPUP.height / 2 + 74, POPUP.width - 60, { color: COLOR.accent, alpha: 0.35 }));

    POPUP_COLUMNS.forEach((x) => {
      const ground = POPUP.height / 2 - 70;
      this.panel.add(this.add.ellipse(x, ground + 4, 150, 26, COLOR.void, 0.5));
      const name = this.add.text(x, ground + 14, "", textStyle({ role: "display", size: 24 })).setOrigin(0.5, 0);
      const detail = this.add.text(x, ground + 44, "", textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5, 0);
      // SD는 그림이라 입력을 받지 않는다. 칸 전체를 눌러 상세를 연다.
      const hit = this.add.rectangle(x, ground - POPUP.sdHeight / 2, 230, POPUP.sdHeight + 100, 0xffffff, 0).setInteractive({ useHandCursor: true });
      this.panel.add([name, detail, hit]);
      this.panelSlots.push({ name, detail, hit });
    });
  }

  /** 스테이지를 고른다. 지도를 그 자리로 굴리고, 적 패널을 채워 내린다. */
  private select(stage: StageDef, instant = false): void {
    this.selected = stage.id;
    session.selectedStageId = stage.id;
    const index = STAGES.findIndex((s) => s.id === stage.id);

    for (const [id, node] of this.nodes) {
      const chosen = id === stage.id;
      // 고른 노드는 테두리가 아니라 크기와 색으로 알린다.
      node.label.setScale(chosen ? 1.25 : 1);
      node.label.setColor(chosen ? COLOR.accentText : session.cleared.has(id) ? COLOR.ink : COLOR.inkDim);
    }

    // 고른 노드를 창 한가운데로 올린다. 지도 끝에서는 더 굴러가지 않으므로 실제로 노드가
    // 멈추는 자리를 미리 계산해 팝업을 그 위에 붙인다.
    const scroll = Phaser.Math.Clamp((WINDOW.top + WINDOW.bottom) / 2 + index * NODE_GAP, this.scrollMin, this.scrollMax);
    this.scrollTo(scroll, !instant);
    this.anchorPanel(scroll - index * NODE_GAP);
    this.sortieButton.setSub("");
    this.showPanel(stage);
  }

  /**
   * 팝업을 노드 바로 위(자리가 없으면 아래)에 붙인다.
   *
   * 지도 위쪽 끝에서는 팝업이 구역 제목을 덮으므로, 그때만 노드 아래로 내려 붙인다.
   */
  private anchorPanel(nodeY: number): void {
    const above = nodeY - POPUP.height / 2 - 96;
    const fitsAbove = above >= WINDOW.top - 40;
    this.panel.setY(fitsAbove ? above : nodeY + POPUP.height / 2 + 96);
    // 꼬리는 팝업에서 노드 쪽으로 뻗는다. 컨테이너를 뒤집으면 글자까지 뒤집히므로 다시 긋는다.
    const edge = fitsAbove ? POPUP.height / 2 : -POPUP.height / 2;
    this.panelTail.clear();
    this.panelTail.lineStyle(3, COLOR.accent, 0.55);
    this.panelTail.lineBetween(0, edge, 0, edge + (fitsAbove ? 52 : -52));
  }

  /** 패널 내용을 지금 스테이지의 적으로 바꾸고, 아직 올라가 있으면 내린다. */
  private showPanel(stage: StageDef): void {
    const request = ++this.panelRequest;
    this.panelTitle.setText(`${stage.id}  ${stage.name}  ·  적 LV.${stage.enemyLevel}`);
    // 팝업이 새로 뜰 때마다 SD도 다시 세운다. 이전 스테이지의 SD는 여기서 지운다.

    getStageEnemies(stage).forEach((def, slot) => {
      const view = this.panelSlots[slot];
      view.name.setText(def.name);
      // 지도에서도 실제 전투에 투입될 레벨 보정 체력을 미리 보여준다.
      view.detail.setText(`LV.${stage.enemyLevel}  ${ROLE_LABEL[def.role]}  HP ${def.stats.hp}`);
      view.hit.removeAllListeners("pointerup");
      view.hit.on("pointerup", () => this.info.showRelic(def));
      view.creature?.destroy();
      view.creature = undefined;
      void this.standEnemy(def.id, slot, request);
    });

    if (this.panelShown) return;
    this.panelShown = true;
    // 노드에서 솟아오르듯 살짝 커지며 뜬다.
    this.panel.setVisible(true).setAlpha(0).setScale(0.94);
    this.tweens.add({
      targets: this.panel,
      alpha: 1,
      scale: 1,
      duration: 260,
      ease: "Cubic.Out",
      onComplete: () => {
        this.panelDown = true;
        this.panelSlots.forEach((view) => view.creature?.setVisible(true));
      },
    });
  }

  /**
   * 팝업 안 SD 하나.
   *
   * Puppet은 자체 GPU 경로로 그려서 컨테이너의 이동을 따라가지 않는다. 그래서 팝업이 자리
   * 잡은 화면 좌표에 직접 세우고, 떠오르는 동안에는 감춰 둔다. 늦게 도착한 로딩이 다른
   * 스테이지의 적을 세우지 않도록 요청 번호도 확인한다.
   */
  private async standEnemy(relicId: string, slot: number, request: number): Promise<void> {
    const creature = await spawnPuppet(this, battleAssetFor(relicId), {
      x: BASE_WIDTH / 2 + POPUP_COLUMNS[slot],
      groundY: this.panel.y + POPUP.height / 2 - 70,
      height: POPUP.sdHeight,
      flipX: true,
      // 적 번호별 원본 색을 그대로 보여 줘 토비·아모·리파 외형을 명확히 구분한다.
      tint: 0xffffff,
      depth: 61,
    });
    if (!this.scene.isActive() || request !== this.panelRequest) {
      creature.destroy();
      return;
    }
    creature.setVisible(this.panelDown);
    this.panelSlots[slot].creature = creature;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => creature.destroy());
  }
}
