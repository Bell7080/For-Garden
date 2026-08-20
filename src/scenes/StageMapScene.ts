import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import type { StageDef } from "../core/types";
import { setDebugScene } from "../debug";
import { getRelic } from "../data/relics";
import { STAGES } from "../data/stages";
import { CharacterInfoManager, ROLE_LABEL } from "../managers/CharacterInfoManager";
import type { PuppetCreature } from "../puppets/assets";
import { battleAssetFor, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { isStageUnlocked, session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";

/** 지도가 보이는 세로 구간. 위쪽 제목과 아래쪽 버튼을 침범하지 않는다. */
const WINDOW = { top: 500, bottom: 1560 } as const;
/** 스테이지 하나가 차지하는 세로 간격. */
const NODE_GAP = 230;
/** 드래그를 스크롤로 볼지 탭으로 볼지 가르는 거리. */
const DRAG_SLOP = 14;

/** 위에서 내려오는 적 정보 패널. */
const PANEL = { height: 470, sdHeight: 170 } as const;
/** 패널 안 세 칸의 가로 위치. */
const PANEL_COLUMNS = [270, 540, 810];

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

  /** 적 정보 패널. */
  private panel!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
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
    // 출전 이후 지도부터는 background_004를 공통 전투 에리어로 이어 쓴다.
    addSceneBackground(this, BACKGROUND.battleArea);
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.38).setDepth(-29);

    this.add.text(cx, 140, "제 1 구역", textStyle({ size: 60 })).setOrigin(0.5);
    this.add
      .text(cx, 202, "격리 구역 — 이터널 시티 외곽", textStyle({ size: 28, color: COLOR.inkDim }))
      .setOrigin(0.5);

    this.buildMap();
    this.buildPanel();

    this.sortieButton = new Button(this, cx, BASE_HEIGHT - 180, {
      width: 340,
      height: 108,
      label: "출  전",
      fontSize: 36,
      onClick: () => {
        session.selectedStageId = this.selected;
        this.scene.start("party");
      },
    });
    addBackButton(this, () => this.scene.start("lobby"));

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
    this.map.add(this.add.line(0, 0, cx, 0, cx, -height, COLOR.panelEdge).setOrigin(0).setLineWidth(6));

    STAGES.forEach((stage, index) => {
      const y = -index * NODE_GAP;
      // 좌우로 살짝 어긋나게 놓아 단조로운 일자 배치를 피한다.
      const x = cx + (index % 2 === 0 ? -110 : 110);
      const unlocked = isStageUnlocked(stage.id);
      const cleared = session.cleared.has(stage.id);

      this.map.add(this.add.line(0, 0, cx, y, x, y, COLOR.panelEdge).setOrigin(0).setLineWidth(4));
      const ring = this.add.circle(x, y, 46, cleared ? COLOR.accent : COLOR.panel).setStrokeStyle(4, unlocked ? COLOR.accent : COLOR.panelEdge);
      const label = this.add
        .text(x, y, stage.id, textStyle({ size: 30, color: cleared ? "#1a1d21" : unlocked ? COLOR.ink : COLOR.inkDim }))
        .setOrigin(0.5);
      const name = this.add
        .text(x, y + 66, stage.name, textStyle({ size: 28, color: unlocked ? COLOR.ink : COLOR.inkDim }))
        .setOrigin(0.5, 0);
      this.map.add([ring, label, name]);
      this.nodes.set(stage.id, { ring, label });

      if (!unlocked) {
        ring.setAlpha(0.4);
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
    mask.fillStyle(0xffffff).fillRect(0, WINDOW.top, BASE_WIDTH, WINDOW.bottom - WINDOW.top);
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

  /** 위에서 미끄러져 내려오는 적 정보 패널. 내용만 갈아 끼우고 한 번만 만든다. */
  private buildPanel(): void {
    this.panel = this.add.container(0, -PANEL.height).setDepth(60);
    const plate = this.add.graphics();
    plate.fillStyle(COLOR.void, 0.93).fillRoundedRect(-20, -40, BASE_WIDTH + 40, PANEL.height + 40, 34);
    plate.fillStyle(COLOR.accent, 0.85).fillRect(0, PANEL.height - 4, BASE_WIDTH, 4);
    this.panel.add(plate);

    this.panelTitle = this.add.text(40, 34, "", textStyle({ size: 40 })).setOrigin(0, 0);
    this.panel.add(this.panelTitle);
    this.panel.add(this.add.text(BASE_WIDTH - 40, 46, "적 편성", textStyle({ size: 26, color: COLOR.dangerText })).setOrigin(1, 0));

    PANEL_COLUMNS.forEach((x) => {
      const ground = PANEL.height - 130;
      this.panel.add(this.add.ellipse(x, ground + 4, 170, 30, COLOR.panel, 0.6));
      const name = this.add.text(x, ground + 22, "", textStyle({ size: 26 })).setOrigin(0.5, 0);
      const detail = this.add.text(x, ground + 56, "", textStyle({ size: 21, color: COLOR.inkDim })).setOrigin(0.5, 0);
      // SD는 그림이라 입력을 받지 않는다. 칸 전체를 눌러 상세를 연다.
      const hit = this.add.rectangle(x, ground - PANEL.sdHeight / 2 + 20, 240, PANEL.sdHeight + 120, 0xffffff, 0).setInteractive({ useHandCursor: true });
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
      node.ring.setStrokeStyle(chosen ? 8 : 4, chosen || session.cleared.has(id) ? COLOR.accent : COLOR.panelEdge);
      node.label.setScale(chosen ? 1.1 : 1);
    }

    // 고른 노드를 창 한가운데로 올린다.
    this.scrollTo((WINDOW.top + WINDOW.bottom) / 2 + index * NODE_GAP, !instant);
    this.sortieButton.setSub("");
    this.showPanel(stage);
  }

  /** 패널 내용을 지금 스테이지의 적으로 바꾸고, 아직 올라가 있으면 내린다. */
  private showPanel(stage: StageDef): void {
    const request = ++this.panelRequest;
    this.panelTitle.setText(`${stage.id}  ${stage.name}`);

    stage.enemies.forEach((id, slot) => {
      const def = getRelic(id);
      const view = this.panelSlots[slot];
      view.name.setText(def.name);
      view.detail.setText(`${ROLE_LABEL[def.role]}  HP ${def.stats.hp}`);
      view.hit.removeAllListeners("pointerup");
      view.hit.on("pointerup", () => this.info.showRelic(def));
      view.creature?.destroy();
      view.creature = undefined;
      void this.standEnemy(def.id, slot, request);
    });

    if (this.panelShown) return;
    this.panelShown = true;
    this.tweens.add({
      targets: this.panel,
      y: 0,
      duration: 380,
      ease: "Cubic.Out",
      onComplete: () => {
        this.panelDown = true;
        this.panelSlots.forEach((view) => view.creature?.setVisible(true));
      },
    });
  }

  /**
   * 패널 안 SD 하나.
   *
   * Puppet은 자체 GPU 경로로 그려서 컨테이너의 이동을 따라가지 않는다. 그래서 패널이 다 내려온
   * 자리의 화면 좌표에 직접 세우고, 내려오는 동안에는 감춰 둔다. 늦게 도착한 로딩이 다른
   * 스테이지의 적을 세우지 않도록 요청 번호도 확인한다.
   */
  private async standEnemy(relicId: string, slot: number, request: number): Promise<void> {
    const creature = await spawnPuppet(this, battleAssetFor(relicId), {
      x: PANEL_COLUMNS[slot],
      groundY: PANEL.height - 130,
      height: PANEL.sdHeight,
      flipX: true,
      tint: relicId.startsWith("husk-") ? tintFor(relicId) : undefined,
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
