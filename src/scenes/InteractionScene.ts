import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { INTERACTION_DEPARTMENT_LABEL, interactionDurationLabel } from "../data/interactionCities";
import { interactionManager } from "../managers/InteractionManager";
import { session } from "../state/session";
import type { InteractionDispatchSnapshot } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { drawFrameVignette, drawGlassFade, drawHairline, drawLayer, HOLO, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { setDebugScene, setDebugStorefrontControls } from "../debug";
import { PopupLayer } from "../ui/PopupLayer";
import { InteractionExchangePopup } from "../ui/InteractionExchangePopup";
import { InteractionCityPopup } from "../ui/InteractionCityPopup";
import { InteractionJournalPopup } from "../ui/InteractionJournalPopup";
import { INTERACTION_LAYER, interactionLayersHeight, interactionLayerSpot } from "../ui/interactionLayerLayout";
import { interactionLayerViews, interactionRemainingLabel, type InteractionLayerView } from "../ui/interactionLayerModel";

const BLUE = 0x55b9e8;

/** 층을 덮는 원화의 진하기. 글자가 그 위에서 읽혀야 하므로 절반을 넘기지 않는다. */
const ART_ALPHA = 0.5;
/** 양 끝에서 판 색으로 녹는 폭(px)과 그 끝의 진하기. */
const ART_FADE_WIDTH = 300;
const ART_FADE_ALPHA = 0.98;

/**
 * 교류 — 외부 도시를 층으로 쌓아 위에서 아래로 고른다.
 *
 * 층은 좌우에서 뻗어 나오고, 열리는 순서가 곧 성장 순서다. 한 층을 누르면 그 도시의 쪽지가
 * 열리고 거기서 파견대를 세운다. 씬은 표시와 입력만 맡고 상태 변경은 `InteractionManager`로
 * 보낸다 — 어느 렐릭이 어디에 나가 있는지는 서버가 확정한 목록 하나가 소유한다.
 */
export class InteractionScene extends Phaser.Scene {
  private readonly popups = new PopupLayer(this, 2600);
  private serverNow = Date.now();
  private layers?: Phaser.GameObjects.Container;
  private layerMask?: Phaser.GameObjects.Graphics;
  private scrollY = 0;
  private minScroll = 0;
  private cityPopup?: InteractionCityPopup;
  /** 도시 일지는 쪽지에서 열리지만 대사 분기는 씬 위에 서므로 씬이 소유한다. */
  private journalPopup?: InteractionJournalPopup;
  /** 교환소는 버튼과 재화 안내 자동 이동이 공유하는 한 인스턴스만 유지한다. */
  private exchangePopup?: InteractionExchangePopup;

  constructor() { super("interaction"); }

  create(data: { openExchange?: boolean } = {}): void {
    setDebugScene("interaction", "교류");
    // TODO(art): 전용 원화 전까지 loadingSteps가 이미 읽는 로비 배경을 임시 사용한다.
    addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.66);
    new TopBar(this, 40, { currencies: "none", onSettings: () => this.scene.start("settings", { returnScene: "interaction" }) });
    this.add.text(52, 150, "교류", textStyle({ role: "display", size: 50, color: "#a8ddf5" }));
    this.add.text(56, 216, "도시마다 한 팀씩 보낼 수 있다", textStyle({ role: "body", size: 24, color: COLOR.inkDim }));
    // 파견 목록이 다시 그려져도 파괴되지 않는 씬 고정 진입점이라 항상 교환소를 찾을 수 있다.
    this.add.existing(new Button(this, 875, 185, { width: 300, height: 86, label: "교환소", accentColor: BLUE, onClick: () => this.openExchange() }));
    // 자동화도 런타임과 같은 고정 버튼을 누르도록 최소 입력 중심만 공개한다.
    setDebugStorefrontControls({ interaction: { exchange: { x: 875, y: 185 } } });
    // 재화 안내에서 온 경우에도 별도 팝업 경로를 만들지 않고 같은 공개 진입점을 호출한다.
    if (data.openExchange) this.openExchange();

    this.buildScrollArea();
    this.buildBackArea();

    void interactionManager.refresh().then((response) => { this.serverNow = Date.parse(response.serverTime); this.drawLayers(); });
    // 남은 시간은 초마다 흐른다. 층이 다시 그려져도 스크롤 위치는 그대로 남는다.
    this.time.addEvent({ delay: 1000, loop: true, callback: () => { this.serverNow += 1000; this.drawLayers(); } });
  }

  /** 버튼과 외부 씬 이동 계약이 공유하는 교환소의 단일 진입점이다. */
  private openExchange(): void {
    this.exchangePopup ??= new InteractionExchangePopup(this, this.popups, interactionManager);
    this.exchangePopup.open();
  }

  /**
   * 우하단 뒤로가기 자리.
   *
   * **층이 이 자리를 침범하지 않게 그라데이션으로 풀어 둔다.** 단단한 판을 깔면 화면 아래가
   * 통째로 상자가 되어 배경 원화가 잘려 보이므로, 아래로 갈수록 짙어지는 투명 그라데이션만 둔다.
   */
  private buildBackArea(): void {
    const height = BASE_HEIGHT - INTERACTION_LAYER.viewport.bottom;
    drawGlassFade(this, BASE_WIDTH / 2, BASE_HEIGHT - height / 2, BASE_WIDTH, height, { topAlpha: 0, bottomAlpha: 0.92 }).setDepth(40);
    drawHairline(this, BASE_WIDTH / 2, INTERACTION_LAYER.viewport.bottom, BASE_WIDTH, { color: BLUE, alpha: 0.22 }).setDepth(40);
    addBackButton(this, () => this.scene.start("lobby")).setDepth(41);
  }

  /** 층이 흐르는 창. 목록이 창보다 길면 그 안에서만 움직인다. */
  private buildScrollArea(): void {
    const { top, bottom } = INTERACTION_LAYER.viewport;
    this.layers = this.add.container(0, 0).setDepth(10);
    this.layerMask = this.make.graphics({});
    this.layerMask.fillStyle(0xffffff, 1).fillRect(0, top, BASE_WIDTH, bottom - top);
    this.layers.setMask(this.layerMask.createGeometryMask());

    const inViewport = (pointer: Phaser.Input.Pointer): boolean => pointer.worldY >= top && pointer.worldY <= bottom;
    let dragging = false; let origin = 0;
    const onDown = (pointer: Phaser.Input.Pointer): void => { if (inViewport(pointer) && this.minScroll < 0) { dragging = true; origin = this.scrollY - pointer.y; } };
    const onMove = (pointer: Phaser.Input.Pointer): void => { if (dragging && pointer.isDown) this.scrollTo(origin + pointer.y); };
    const onUp = (): void => { dragging = false; };
    const onWheel = (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => { if (inViewport(pointer)) this.scrollTo(this.scrollY - dy); };
    this.input.on("pointerdown", onDown); this.input.on("pointermove", onMove);
    this.input.on("pointerup", onUp); this.input.on("pointerupoutside", onUp); this.input.on("wheel", onWheel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", onDown); this.input.off("pointermove", onMove);
      this.input.off("pointerup", onUp); this.input.off("pointerupoutside", onUp); this.input.off("wheel", onWheel);
      this.layerMask?.destroy(); this.layerMask = undefined;
    });
  }

  private scrollTo(value: number): void {
    this.scrollY = Phaser.Math.Clamp(value, this.minScroll, 0);
    this.layers?.setY(this.scrollY);
  }

  /** 서버가 확정한 파견 목록만 읽어 층 상태를 다시 그린다. */
  private drawLayers(): void {
    const container = this.layers;
    if (!container) return;
    container.removeAll(true);
    const dispatches = session.interaction.slots.filter((slot): slot is InteractionDispatchSnapshot => slot !== null);
    const views = interactionLayerViews(session.playerResearch.level, dispatches, this.serverNow);
    views.forEach((view, index) => container.add(this.buildLayer(view, index)));

    const viewportHeight = INTERACTION_LAYER.viewport.bottom - INTERACTION_LAYER.viewport.top;
    const contentBottom = INTERACTION_LAYER.firstY + interactionLayersHeight(views.length) - INTERACTION_LAYER.height / 2;
    this.minScroll = Math.min(0, viewportHeight + INTERACTION_LAYER.viewport.top - contentBottom - 40);
    this.scrollTo(this.scrollY);
  }

  /**
   * 층 한 장.
   *
   * 잠긴 층은 무엇이 열릴지만 말하고 눌리지 않는다. 나가 있는 층은 **검은 반투명을 한 겹 더
   * 쌓아** 남은 시간을 그 위에 적는다 — 층을 지우지 않는 이유는 지금 어디에 누가 나가 있는지가
   * 목록에서 바로 읽혀야 하기 때문이다.
   */
  private buildLayer(view: InteractionLayerView, index: number): Phaser.GameObjects.Container {
    const spot = interactionLayerSpot(index);
    const layer = this.add.container(spot.x, spot.y);
    const { width, height, padding, textInset } = INTERACTION_LAYER;
    const locked = view.state === "locked";
    const shape = slantedRect(width, height, 30);
    layer.add(drawLayer(this, 0, 0, shape, {
      fill: locked ? COLOR.void : COLOR.panel,
      alpha: locked ? 0.72 : HOLO.glass,
      edge: view.state === "done" ? 0xe0a83e : BLUE,
      edgeAlpha: locked ? 0.28 : 0.85,
    }));

    // **원화가 층 전체를 덮는다.** 왼쪽 한 칸에만 눕히면 나머지가 빈 띠로 남아 도시마다 다른
    // 곳이라는 것이 이름으로만 읽혔다. 대신 **양 끝으로 갈수록 판 색에 녹여** 가운데만 그림이
    // 남게 한다 — 그 덕에 기울어진 좌우 변도 이미 투명한 자리라 마스크가 필요 없다. 마스크를
    // 쓰지 않는 것이 중요한데, 이 목록은 세로로 흐르고 기하 마스크는 컨테이너 이동을 물려받지
    // 않아 스크롤하는 순간 원화만 제자리에 남기 때문이다.
    if (!locked && this.textures.exists(view.city.illustration)) {
      const art = this.add.image(0, 0, view.city.illustration);
      art.setDisplaySize(width, height);
      art.setAlpha(ART_ALPHA);
      layer.add(art);
      const fade = this.add.graphics();
      // 왼쪽은 불투명 → 투명, 오른쪽은 투명 → 불투명. 두 끝이 판 색으로 녹아 붙여 넣은
      // 섬네일처럼 각진 경계가 남지 않는다. 위아래로 흐르는 공용 `drawGlassFade`는 쓰지 않는다.
      fade.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, ART_FADE_ALPHA, 0, ART_FADE_ALPHA, 0);
      fade.fillRect(-width / 2, -height / 2, ART_FADE_WIDTH, height);
      fade.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, 0, ART_FADE_ALPHA, 0, ART_FADE_ALPHA);
      fade.fillRect(width / 2 - ART_FADE_WIDTH, -height / 2, ART_FADE_WIDTH, height);
      layer.add(fade);
    }

    // **가장자리를 눌러 층 하나를 버튼으로 떼어 놓는다.** 원화가 판을 가득 채우면 어디까지가
    // 한 층인지 흐려지므로, 네 변을 고르게 누르는 액자 비네트를 한 겹 얹는다. 같은 도형을
    // 줄여 가며 두르는 `drawInnerVignette`은 가로로 긴 판에서 좌우가 더 많이 줄어 검은 줄이
    // 여러 겹 어긋난 잔상으로 남는다.
    layer.add(drawFrameVignette(this, 0, 0, width, height, { strength: 0.5 }));

    // **글은 잠기든 말든 같은 x에서 시작한다.** 층이 화면보다 넓어 왼쪽 여백은 화면 밖에 있고,
    // 거기서 시작하면 잠긴 층의 이름이 화면 왼쪽으로 잘려 나간다. 같은 시작선이 목록을 목록으로
    // 읽히게 하는 것이기도 하다.
    // 층이 화면(1080)보다 넓어 왼쪽 여백은 화면 밖에 있다. 판 왼쪽 변에서 시작하면 이름이
    // 화면 왼쪽으로 잘려 나가므로, 화면 안으로 들어오는 자리를 시작선으로 삼는다.
    const textX = -width / 2 + padding + textInset;
    const name = `${view.city.displayName} ${INTERACTION_DEPARTMENT_LABEL[view.city.department]}`;
    layer.add(this.add.text(textX, -44, name, textStyle({ role: "display", size: 36, color: locked ? COLOR.inkDim : "#dff2ff" })).setOrigin(0, 0.5));
    layer.add(this.add.text(textX, 6, locked ? `연구 Lv.${view.city.unlock.researchLevel}에 열린다` : interactionDurationLabel(view.city.durationMinutes), textStyle({ role: "emphasis", size: 26, color: locked ? COLOR.inkDim : COLOR.accentText })).setOrigin(0, 0.5));

    if (view.state === "away" || view.state === "done") {
      // 나가 있는 동안에는 층 위에 한 겹을 더 덮는다. 완료는 덮지 않고 색으로 알린다.
      if (view.state === "away") layer.add(drawLayer(this, 0, 0, shape, { fill: COLOR.void, alpha: 0.62 }));
      const label = view.state === "away" ? `파견 중 · ${interactionRemainingLabel(view.remainingMs ?? 0)}` : "수령 대기";
      layer.add(this.add.text(textX, 52, label, textStyle({ role: "emphasis", size: 28, color: view.state === "away" ? "#a8ddf5" : "#e0a83e" })).setOrigin(0, 0.5));
    }

    if (!locked) {
      const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => this.openCity(view));
      layer.add(hit);
    }
    return layer;
  }

  /** 층을 누르면 그 도시의 쪽지가 열린다. 완료한 층은 바로 보상으로 이어진다. */
  private openCity(view: InteractionLayerView): void {
    this.cityPopup ??= new InteractionCityPopup(this, this.popups, interactionManager);
    this.journalPopup ??= new InteractionJournalPopup(this, this.popups, interactionManager);
    this.cityPopup.open(view, {
      onChanged: () => { void interactionManager.refresh().then((response) => { this.serverNow = Date.parse(response.serverTime); this.drawLayers(); }); },
      onOpenJournal: (cityId) => this.journalPopup!.open(cityId),
    });
  }
}
