import Phaser from "phaser";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { ANCIENT_FLOORS_PER_BLOCK, ancientBlockBackdrop, ancientBlockFloors, isAncientGate } from "../core/ancientStrata";
import { getAncientStrataFloor } from "../core/ancientStrataBattle";
import { ancientStageId, ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";
import { motionPolicy } from "../core/settings";
import { isStageUnlocked, session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { NodeEnemyPreview } from "../ui/NodeEnemyPreview";
import { EnemyInfoPopup } from "../ui/EnemyInfoPopup";
import { PopupLayer } from "../ui/PopupLayer";
import { ancientBackground, useBackgroundTexture } from "../ui/backgrounds";
import { ANCIENT_MAP, ancientNodePoint, ancientNodeSize, ancientScrollLimits } from "../ui/ancientStrataLayout";
import { chipPoints, drawLayer, drawVignette } from "../ui/holo";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { stageChapterNavigationLayout } from "../ui/stageChapterLayout";
import { COLOR, textStyle } from "../ui/theme";
import { LOBBY_RETURN } from "./lobbyEntry";

/** 제목·구간 버튼·뒤로가기가 앉는 깊이. 비네트(40)보다 위다. */
const CHROME_DEPTH = 50;
/** 드래그를 스크롤로 볼지 탭으로 볼지 가르는 거리. */
const DRAG_SLOP = TAP_DRAG_SLOP;
/** 길의 점선 한 토막과 틈. */
const DASH = { on: 22, off: 16 } as const;
/** 진행 기록에서 아직 클리어하지 않은 첫 층을 찾는다. */
function currentFloor(): number {
  for (let floor=1;floor<=ANCIENT_STRATA_MAX_FLOOR;floor++) if(!session.cleared.has(ancientStageId(floor)))return floor;
  return ANCIENT_STRATA_MAX_FLOOR;
}

/**
 * 고대 지층 — 끝없이 내려가는 지층 탐사.
 *
 * 열 층이 한 구간(한 장의 지도)이고, 구간마다 원화가 바뀐다(`ancientBlockBackdrop`). 층은 위에서 아래로
 * 내려가며 노드가 가운데 축 양옆을 번갈아 오가는 긴 길이다. 노드에서 200층의 실제 적·배율을 미리 볼 수 있으며,
 * 공용 서버 전투 검증과 초회 정산을 사용한다.
 * 출격판에서 진입하며 첫 층은 쉬움 1-10 클리어 후 열린다.
 */
export class AncientStrataScene extends Phaser.Scene {
  private block = 0;
  private map?: Phaser.GameObjects.Container;
  private range!: Phaser.GameObjects.Text;
  private previousButton!: Button;
  private startButton!: Button;
  private selectedFloor?: number;
  private nextButton!: Button;
  private enemyPreview?: NodeEnemyPreview;
  private enemyInfo?: EnemyInfoPopup;
  private selectedNodeY?: number;
  private dragging = false;
  private dragMoved = 0;
  private dragOrigin = 0;
  private limits = ancientScrollLimits();

  constructor() {
    super("ancientStrata");
  }

  create(): void {
    setDebugScene("ancientStrata");
    this.block = Math.floor((currentFloor()-1)/ANCIENT_FLOORS_PER_BLOCK);
    this.dragging = false;
    this.selectedNodeY = undefined;
    this.enemyPreview?.destroy();
    this.enemyPreview = new NodeEnemyPreview(this, { title: "", enemies: [], growth: [], top: ANCIENT_MAP.window.top,
      bottom: ANCIENT_MAP.window.bottom, depth: 100, onEnemyClick: () => undefined });
    this.enemyInfo = new EnemyInfoPopup(this, new PopupLayer(this, 2200));
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-30);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: 40, strength: 0.5 });

    this.add.text(BASE_WIDTH / 2, 190, t("ancient.title"), textStyle({ role: "display", size: 52 })).setOrigin(0.5).setDepth(CHROME_DEPTH);
    this.range = this.add.text(BASE_WIDTH / 2, 262, "", textStyle({ role: "body", size: 30, color: COLOR.inkDim })).setOrigin(0.5).setDepth(CHROME_DEPTH);
    this.selectedFloor=undefined;
    this.startButton=new Button(this,BASE_WIDTH/2,BASE_HEIGHT-190,{width:390,height:94,label:t("stageMap.sortie"),fontSize:32,onClick:()=>{
      if(this.selectedFloor===undefined||!isStageUnlocked(ancientStageId(this.selectedFloor)))return;
      session.selectedStageId=ancientStageId(this.selectedFloor);
      startScene(this,"party",{content:"stage"});
    }}).setDepth(CHROME_DEPTH).setEnabled(false);

    const navigation = stageChapterNavigationLayout(BASE_WIDTH, BASE_HEIGHT);
    this.previousButton = new Button(this, navigation.previous.x, navigation.previous.y, {
      width: navigation.previous.width, height: navigation.previous.height, label: t("ancient.prev"), fontSize: 28,
      onClick: () => this.showBlock(this.block - 1),
    }).setDepth(CHROME_DEPTH);
    this.nextButton = new Button(this, navigation.next.x, navigation.next.y, {
      width: navigation.next.width, height: navigation.next.height, label: t("ancient.next"), fontSize: 28,
      onClick: () => this.showBlock(this.block + 1),
    }).setDepth(CHROME_DEPTH);
    addBackButton(this, () => startScene(this, "lobby", LOBBY_RETURN.sortie)).setDepth(CHROME_DEPTH);

    this.buildMap();
    this.enableDragScroll();
    // 화면이 한 뼘 아래에서 떠오르며 들어온다 — 조각마다 트윈을 걸지 않으므로 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  private showBlock(block: number): void {
    if (block < 0 || block >= ANCIENT_STRATA_MAX_FLOOR / ANCIENT_FLOORS_PER_BLOCK || block === this.block) return;
    this.enemyPreview?.dismiss();
    this.selectedFloor=undefined;this.startButton.setEnabled(false).setLabel(t("stageMap.sortie"));
    this.selectedNodeY = undefined;
    this.block = block;
    this.map?.destroy(true);
    this.buildMap();
  }

  /** 이 구간의 원화·길·노드를 한 컨테이너에 세운다. 컨테이너를 굴리면 모두 함께 움직인다. */
  private buildMap(): void {
    const { first, last } = ancientBlockFloors(this.block);
    this.range.setText(`B${first} – B${last}`);
    this.previousButton.setEnabled(this.block > 0);
    this.nextButton.setEnabled(last < ANCIENT_STRATA_MAX_FLOOR);
    this.limits = ancientScrollLimits();
    const cx = BASE_WIDTH / 2;
    const map = this.add.container(0, this.limits.max);
    this.map = map;

    // 원화는 컨테이너와 함께 굴러 화면이 어디를 비추든 비지 않는 길이로 키운다.
    const art = this.add.image(cx, this.limits.artTop, "__DEFAULT").setOrigin(0.5, 0);
    useBackgroundTexture(this, art, ancientBackground(ancientBlockBackdrop(this.block)), (image) => {
      image.setScale(Math.max(BASE_WIDTH / image.width, this.limits.artHeight / image.height));
    });
    map.add(art);
    map.add(this.add.rectangle(cx, this.limits.artTop + this.limits.artHeight / 2, BASE_WIDTH, this.limits.artHeight, COLOR.void, 0.3));

    const points = Array.from({ length: ANCIENT_FLOORS_PER_BLOCK }, (_, index) => ancientNodePoint(index, cx));
    const path = this.add.graphics();
    path.lineStyle(6, COLOR.accent, 0.55);
    // 위·아래로 이어지는 토막은 끝없이 내려간다는 표식이다.
    const head = { x: points[0].x, y: points[0].y - ANCIENT_MAP.stub };
    const tail = { x: points[points.length - 1].x, y: points[points.length - 1].y + ANCIENT_MAP.stub };
    [head, ...points, tail].forEach((point, index, all) => { if (index > 0) this.dashedLine(path, all[index - 1], point); });
    map.add(path);

    points.forEach((point, index) => {
      const floor = first + index;
      const gate = isAncientGate(floor);
      const size = ancientNodeSize(floor);
      const current = floor === currentFloor();
      const reachable = floor <= currentFloor();
      const bevel = size * 0.3;
      map.add(drawLayer(this, point.x, point.y, chipPoints(size, size, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } }), {
        fill: current ? COLOR.accent : gate ? 0x2a2230 : 0x141920,
        alpha: reachable || gate ? 0.94 : 0.7,
        edge: gate ? COLOR.accent : COLOR.panelEdge,
        edgeAlpha: reachable || gate ? 0.9 : 0.5,
      }));
      const label = this.add.text(point.x, point.y, `B${floor}`, textStyle({ role: "emphasis", size: gate ? 38 : 32, color: current ? "#1a1d21" : reachable || gate ? COLOR.ink : COLOR.inkDim })).setOrigin(0.5);
      map.add(label);
      if (gate) map.add(this.add.text(point.x, point.y + size / 2 + 18, t("ancient.gate"), textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0.5, 0));
      if (current && motionPolicy(session.settings).nonEssentialDistanceFactor > 0) {
        this.tweens.add({ targets: label, scale: 1.18, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      const hit = this.add.rectangle(point.x, point.y, size + 24, size + 24, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        // 지도를 끌던 손가락이 노드 위에서 떨어져도 안내가 뜨지 않게 한다.
        if (this.dragMoved > DRAG_SLOP) return;
        const definition = getAncientStrataFloor(floor), multiplier = definition.multipliers;
        this.selectedNodeY = point.y;
        this.selectedFloor=floor;
        const unlocked=isStageUnlocked(ancientStageId(floor));
        this.startButton.setEnabled(unlocked).setLabel(unlocked?t("stageMap.sortie"):t("ancient.requirement",{stage:floor===1?"1-10":`B${floor-1}`}));
        this.enemyPreview?.showAt(point.y + map.y, { title: `B${floor}`,
          situation: `${t(`ancient.trial.${definition.trialId}`)}${floor>120?`\n${t("ancient.deepTrial")}`:""}\n${t("ancient.depthMultiplier")} · ${t("stat.hp")} ×${multiplier.hp.toFixed(2)} · ${t("stat.atk")}/${t("stat.ap")} ×${multiplier.attack.toFixed(2)} · ${t("stat.def")}/${t("stat.res")} ×${multiplier.defense.toFixed(2)}`,
          enemies: definition.enemies, growth: definition.enemies.map(() => ({ level: definition.level, breakthrough: definition.breakthrough })),
          elite: definition.encounterKind === "elite",
          sections: { informationLabel:t("ancient.trials"),informationAlwaysOpen:true,rewards: definition.firstClearRewards, rewardsClaimed: session.cleared.has(`ancient:${floor}`) },
          onEnemyClick: (enemy, growth) => this.enemyInfo?.show({ def: enemy, ...growth }),
        });
      });
      map.add(hit);
    });
  }

  /** 점선을 그린다. 실선 한 줄보다 「지나온 길」로 읽히고, 끝없이 이어지는 토막과 한 문법이다. */
  private dashedLine(graphics: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }): void {
    const length = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const dx = (to.x - from.x) / length;
    const dy = (to.y - from.y) / length;
    for (let at = 0; at < length; at += DASH.on + DASH.off) {
      const end = Math.min(at + DASH.on, length);
      graphics.lineBetween(from.x + dx * at, from.y + dy * at, from.x + dx * end, from.y + dy * end);
    }
  }

  /** 손가락으로 끌어 지도를 굴린다. 휠도 같은 경로다. */
  private enableDragScroll(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if(this.enemyPreview?.containsScreenPoint(pointer.worldX,pointer.worldY))return;
      if(this.startButton.getBounds().contains(pointer.worldX,pointer.worldY))return;
      this.enemyPreview?.dismiss();this.selectedFloor=undefined;this.selectedNodeY=undefined;this.startButton.setEnabled(false).setLabel(t("stageMap.sortie"));
      if (pointer.y < ANCIENT_MAP.window.top - 100 || pointer.y > ANCIENT_MAP.window.bottom + 40) return;
      this.dragging = true;
      this.dragMoved = 0;
      this.dragOrigin = (this.map?.y ?? 0) - pointer.y;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      this.dragMoved += Math.abs(pointer.velocity.y);
      this.scrollTo(this.dragOrigin + pointer.y);
    });
    this.input.on("pointerup", () => { this.dragging = false; });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollTo((this.map?.y ?? 0) - dy));
  }

  private scrollTo(y: number): void {
    if (this.map) this.map.y = Phaser.Math.Clamp(y, this.limits.min, this.limits.max);
    if (this.selectedNodeY !== undefined && this.map) {
      const nodeY = this.selectedNodeY + this.map.y;
      this.enemyPreview?.trackNode(nodeY, nodeY >= ANCIENT_MAP.window.top && nodeY <= ANCIENT_MAP.window.bottom);
    }
  }
}
