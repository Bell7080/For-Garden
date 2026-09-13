import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { INTERACTION_DEPARTMENT_LABEL, interactionDurationLabel } from "../data/interactionCities";
import { interactionManager } from "../managers/InteractionManager";
import { session } from "../state/session";
import type { InteractionDispatchSnapshot } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { addSceneBackground, BACKGROUND, useBackgroundTexture } from "../ui/backgrounds";
import { drawFrameVignette, drawGlassFade, drawHairline, drawLayer, drawShapeOutline, drawVignette, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";
import { setDebugScene, setDebugStorefrontControls } from "../debug";
import { PopupLayer } from "../ui/PopupLayer";
import { bindCurrencyGuide } from "../ui/currencyGuideEntry";
import { InteractionExchangePopup } from "../ui/InteractionExchangePopup";
import { InteractionCityPopup } from "../ui/InteractionCityPopup";
import { InteractionJournalPopup } from "../ui/InteractionJournalPopup";
import { INTERACTION_LAYER, interactionLayersHeight, interactionLayerSpot } from "../ui/interactionLayerLayout";
import { interactionLayerViews, interactionRemainingLabel, type InteractionLayerView } from "../ui/interactionLayerModel";
import { coverCrop } from "../ui/coverCrop";
import { drawGlyph } from "../ui/glyphs";
import { STAGES } from "../data/stages";

/**
 * 여는 조건에 적을 관문 이름.
 *
 * 화면이 `1-4` 같은 ID를 그대로 적지 않는다 — 그 수는 데이터의 자리 번호이지 플레이어가
 * 스테이지 화면에서 읽는 이름이 아니다. 알 수 없는 ID는 그 ID를 그대로 돌려주어 빠진 조건이
 * 조용히 사라지지 않게 한다.
 */
function stageDisplayName(stageId: string | undefined): string {
  if (!stageId) return "";
  const stage = STAGES.find((candidate) => candidate.id === stageId);
  return stage ? `${stage.id} ${stage.name}` : stageId;
}

const BLUE = 0x55b9e8;

/**
 * 카드를 채우는 원화의 진하기.
 *
 * **원화가 이 화면의 본질이다.** 0.5로 눌러 두었을 때는 어느 도시나 같은 잿빛 판으로 보여
 * 목록을 훑을 이유가 없었다 — 글은 아래에서 올라오는 어둠이 받쳐 주므로 그림은 밝게 둔다.
 */
const ART_ALPHA = 0.92;
/** 잠긴 카드의 원화. 검은 베일이 한 겹 더 덮이므로 조금만 눌러 둔다. */
const ART_LOCKED_ALPHA = 0.8;
/** 글이 서는 아래쪽만 덮는 어둠의 진하기. */
const SCRIM_ALPHA = 0.92;
/** 가장자리를 누르는 세기. 세게 두면 원화의 본질이 흐려진다. */
const FRAME_VIGNETTE = 0.26;
/** 잠긴 카드를 덮는 한 겹. 이름과 원화는 그 위로도 읽혀야 한다. */
const LOCKED_VEIL = 0.52;
/** 남은 시간이 초까지 도는 시계라 초가 바뀌는 순간을 놓치지 않을 만큼만 자주 본다. */
const CLOCK_TICK_MS = 200;

/**
 * 교류 — 외부 도시를 층으로 쌓아 위에서 아래로 고른다.
 *
 * 층은 좌우에서 뻗어 나오고, 열리는 순서가 곧 성장 순서다. 한 층을 누르면 그 도시의 쪽지가
 * 열리고 거기서 파견대를 세운다. 씬은 표시와 입력만 맡고 상태 변경은 `InteractionManager`로
 * 보낸다 — 어느 렐릭이 어디에 나가 있는지는 서버가 확정한 목록 하나가 소유한다.
 */
export class InteractionScene extends Phaser.Scene {
  private readonly popups = new PopupLayer(this, 2600);
  /**
   * 서버 시계와 이 기기 시계의 차이.
   *
   * 남은 시간을 초마다 1000씩 빼면 화면이 멈췄다 돌아오는 사이(탭 전환·잠금)에 흐른 시간을
   * 통째로 잃어 시계가 실제보다 느려진다. 기준 하나만 잡아 두고 **읽을 때마다 지금 시각을**
   * 더한다 — 그래야 몇 시간 뒤에 다시 봐도 남은 시간이 어긋나지 않는다.
   */
  private serverOffset = 0;
  private layers?: Phaser.GameObjects.Container;
  /** 지금 그려 둔 층 목록이 무엇이었는지. 상태가 바뀐 순간에만 다시 그린다. */
  private layerSignature = "";
  /** 초마다 글자만 갈아 끼우는 남은 시간 줄. 층 순서와 같은 자리에 들어간다. */
  private remainingLabels: (Phaser.GameObjects.Text | undefined)[] = [];
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
    setDebugScene("interaction", t("interaction.title"));
    // TODO(art): 전용 원화 전까지 loadingSteps가 이미 읽는 로비 배경을 임시 사용한다.
    addSceneBackground(this, BACKGROUND.lobby);
    // **평평한 검은 판 한 장으로만 누르지 않는다.** 0.66짜리 면을 화면 전체에 깔면 배경 원화가
    // 통째로 잿빛이 되어 층 안의 도시 원화만 홀로 밝게 떠오른다. 고르게 누르는 몫은 한 뼘
    // 덜어 내고, 나머지는 네 변에서 안으로 사라지는 비네트가 맡는다 — 가운데의 목록으로 눈이
    // 먼저 가고, 가장자리의 제목·뒤로가기는 그 어둠 위에서 읽힌다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-27);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -26, strength: 0.7 });
    bindCurrencyGuide({ scene: this, popups: this.popups });
    new TopBar(this, 40, { currencies: "none", onSettings: () => this.scene.start("settings", { returnScene: "interaction" }) });
    this.add.text(52, 150, t("interaction.title"), textStyle({ role: "display", size: 50, color: "#a8ddf5" }));
    this.add.text(56, 216, t("interaction.subtitle"), textStyle({ role: "body", size: 24, color: COLOR.inkDim }));
    // 파견 목록이 다시 그려져도 파괴되지 않는 씬 고정 진입점이라 항상 교환소를 찾을 수 있다.
    this.add.existing(new Button(this, 875, 185, { width: 300, height: 86, label: t("interaction.exchange"), accentColor: BLUE, onClick: () => this.openExchange() }));
    // 자동화도 런타임과 같은 고정 버튼을 누르도록 최소 입력 중심만 공개한다.
    setDebugStorefrontControls({ interaction: { exchange: { x: 875, y: 185 } } });
    // 재화 안내에서 온 경우에도 별도 팝업 경로를 만들지 않고 같은 공개 진입점을 호출한다.
    if (data.openExchange) this.openExchange();

    this.buildScrollArea();
    this.buildBackArea();

    void interactionManager.refresh().then((response) => { this.syncClock(response.serverTime); this.drawLayers(); });
    // 남은 시간은 실시간으로 흐른다. 시계만 도는 동안에는 글자만 갈아 끼우고 층은 그대로 두어
    // 스크롤 위치도, 읽고 있던 원화도 흔들리지 않는다.
    this.time.addEvent({ delay: CLOCK_TICK_MS, loop: true, callback: () => this.tickClock() });
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

  /** 서버가 확정한 시각에 맞춰 기기 시계와의 차이만 잡아 둔다. */
  private syncClock(serverTime: string): void {
    const parsed = Date.parse(serverTime);
    this.serverOffset = Number.isFinite(parsed) ? parsed - Date.now() : 0;
  }

  /** 지금 서버 시각. 읽을 때마다 흐른 시간이 그대로 반영된다. */
  private serverNow(): number {
    return Date.now() + this.serverOffset;
  }

  private currentViews(): InteractionLayerView[] {
    const dispatches = session.interaction.slots.filter((slot): slot is InteractionDispatchSnapshot => slot !== null);
    return interactionLayerViews(session.cleared, dispatches, this.serverNow());
  }

  /**
   * 층이 무엇이고 어떤 상태인지만 추린 것.
   *
   * 이 줄이 그대로면 다시 그릴 이유가 없다 — 초가 흐르는 동안 층을 통째로 새로 만들면 원화를
   * 매초 다시 세우고 스크롤도 함께 흔들린다.
   */
  private static signature(views: readonly InteractionLayerView[]): string {
    return views.map((view) => `${view.city.id}:${view.state}:${view.dispatch?.dispatchId ?? ""}`).join("|");
  }

  /** 초가 흐른 결과. 상태가 바뀐 순간에만 다시 그리고, 그 밖에는 시계 글자만 갈아 끼운다. */
  private tickClock(): void {
    if (!this.layers) return;
    const views = this.currentViews();
    if (InteractionScene.signature(views) !== this.layerSignature) { this.drawLayers(); return; }
    views.forEach((view, index) => {
      if (view.state !== "away") return;
      this.remainingLabels[index]?.setText(t("interaction.dispatched", { remaining: interactionRemainingLabel(view.remainingMs ?? 0) }));
    });
  }

  /** 서버가 확정한 파견 목록만 읽어 층 상태를 다시 그린다. */
  private drawLayers(): void {
    const container = this.layers;
    if (!container) return;
    container.removeAll(true);
    const views = this.currentViews();
    this.remainingLabels = [];
    views.forEach((view, index) => container.add(this.buildLayer(view, index)));
    this.layerSignature = InteractionScene.signature(views);

    const viewportHeight = INTERACTION_LAYER.viewport.bottom - INTERACTION_LAYER.viewport.top;
    const contentBottom = INTERACTION_LAYER.firstY + interactionLayersHeight(views.length) - INTERACTION_LAYER.height / 2;
    this.minScroll = Math.min(0, viewportHeight + INTERACTION_LAYER.viewport.top - contentBottom - 40);
    this.scrollTo(this.scrollY);
  }

  /**
   * 교류지 한 장.
   *
   * **원화가 카드를 채우고, 글은 아래에서 올라오는 어둠 위에 선다.** 카드 전체를 누르면
   * 도시가 무엇을 그린 그림인지 읽히지 않으므로 위쪽 절반은 그대로 밝게 둔다.
   *
   * **잠긴 카드도 원화와 이름을 그대로 보여 준다** — 무엇이 열릴지 모르면 그 관문을 깰 이유가
   * 화면에서 사라진다. 잠긴 것은 한 겹의 검정과 자물쇠, 그리고 여는 조건 한 줄이 말한다.
   */
  private buildLayer(view: InteractionLayerView, index: number): Phaser.GameObjects.Container {
    const spot = interactionLayerSpot(index);
    const layer = this.add.container(spot.x, spot.y);
    const { width, height, padding, textInset } = INTERACTION_LAYER;
    const locked = view.state === "locked";
    const { slant } = INTERACTION_LAYER;
    const shape = slantedRect(width, height, slant);
    const bottom = height / 2;
    // **원화는 액자보다 한 뼘 좁다.** 판이 기울어 좌우에 삼각형이 생기는데 원화는 네모라 그
    // 자리를 채울 수 없다 — 같은 폭으로 두면 그림이 기운 변 밖으로 새어 나가 사방에 두른
    // 테두리가 그림 위를 지난다. 기운 만큼 안으로 넣으면 어느 높이에서도 판 안에 든다.
    const artWidth = width - slant;
    const tone = view.state === "done" ? 0xe0a83e : BLUE;
    layer.add(drawLayer(this, 0, 0, shape, { fill: COLOR.void, alpha: 0.9 }));

    // **원화가 카드를 채우되 늘어나지는 않는다.** 상자 크기에 맞춰 넣으면(`setDisplaySize`)
    // 원화마다 비율이 달라 세로로 눌린 그림이 되었다. 제 비율 그대로 키워 **넘치는 만큼만
    // 잘라 낸다**(`coverCrop`).
    //
    // 자르는 것은 기하 마스크가 아니라 **이미지 자신의 crop**이다. 이 목록은 세로로 흐르는데
    // 기하 마스크는 컨테이너 이동을 물려받지 않아, 마스크로 씌우면 스크롤하는 순간 원화만
    // 제자리에 남는다.
    //
    // **여기서 `textures.exists`로 가르지 않는다.** 부트가 미리 읽는 두 장 말고는 어느 도시
    // 원화도 목록이 그려지는 순간에는 올라와 있지 않아, 물어보고 세우면 카드는 늘 빈 판이었다.
    const art = this.add.image(0, 0, "__DEFAULT").setAlpha(0);
    layer.add(art);
    useBackgroundTexture(this, art, view.city.illustration, (loaded) => {
      const crop = coverCrop(loaded.width, loaded.height, artWidth, height);
      loaded.setScale(crop.scale);
      loaded.setCrop(crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight);
      this.tweens.add({ targets: loaded, alpha: locked ? ART_LOCKED_ALPHA : ART_ALPHA, duration: 160 });
    });

    // 글이 서는 아래쪽만 어둠이 올라온다. 카드 전체를 누르면 원화가 잿빛이 된다.
    layer.add(this.buildReadoutBand(artWidth, height, bottom, tone));

    // **가장자리는 살짝만 누른다.** 강하게 누르면 원화의 본질이 흐려진다 — 카드 하나를 버튼으로
    // 떼어 놓을 만큼만 남긴다.
    layer.add(drawFrameVignette(this, 0, 0, artWidth, height, { strength: FRAME_VIGNETTE }));

    // **이 판만 사방 테두리를 두른다.** 화면의 판때기는 윗변 한 줄이 원칙이지만, 여기는 원화
    // 한 장을 통째로 담는 **액자**다(적 정보창과 같은 예외) — 선이 없으면 카드끼리 맞닿은
    // 자리에서 어디까지가 한 곳인지 흐려지고, 도시 원화가 배경 원화로 흘러 보인다.
    layer.add(drawShapeOutline(this, 0, 0, shape, { color: tone, alpha: locked ? 0.4 : 0.72, width: 3 }));

    if (locked) {
      // 잠긴 카드는 한 겹을 더 덮되 이름과 원화는 그대로 읽힌다.
      layer.add(drawLayer(this, 0, 0, shape, { fill: COLOR.void, alpha: LOCKED_VEIL, shadow: false }));
      layer.add(drawGlyph(this, "lock", 0, -40, INTERACTION_LAYER.lock, COLOR.inkDimHex, 0.9, 4));
    }

    const textX = -artWidth / 2 + padding + textInset;
    const name = `${view.city.displayName} ${INTERACTION_DEPARTMENT_LABEL[view.city.department]}`;
    layer.add(this.add
      .text(textX, bottom - INTERACTION_LAYER.nameUp, name, textStyle({ role: "display", size: 38, color: locked ? COLOR.inkDim : "#dff2ff" }))
      .setOrigin(0, 0.5)
      .setShadow(0, 3, "#05070a", 6, false, true));
    // 아랫줄은 그 도시가 무엇을 하는 자리인지 한 줄로 말한다. 잠긴 카드만 여는 조건이 대신 선다.
    const note = locked
      ? t("interaction.lockedByStage", { stage: stageDisplayName(view.city.unlock.stageId) })
      : view.city.description;
    layer.add(this.add
      .text(textX, bottom - INTERACTION_LAYER.noteUp, note, textStyle({ role: "body", size: 23, color: locked ? "#e0a83e" : COLOR.inkDim }))
      .setOrigin(0, 0.5)
      .setShadow(0, 2, "#05070a", 5, false, true));

    // 오른쪽 칩 한 장이 **지금 이 카드에서 읽어야 할 수**를 든다 — 아직이면 소요 시간,
    // 나가 있으면 남은 시간, 다녀왔으면 수령 대기다.
    if (!locked) layer.add(this.buildStateChip(view, index, artWidth, bottom));

    if (!locked) {
      const hit = this.add.rectangle(0, 0, artWidth, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => layer.setScale(1.02));
      hit.on("pointerout", () => layer.setScale(1));
      hit.on("pointerup", () => { layer.setScale(1); this.openCity(view); });
      layer.add(hit);
    }
    return layer;
  }

  /**
   * 글이 서는 아래쪽 띠.
   *
   * **어둠 한 겹만으로는 글과 원화가 갈리지 않는다** — 밝은 하늘이나 흰 벽이 그 자리에 오면
   * 그라데이션이 통째로 밝아져 이름이 그림에 묻힌다. 아래로 짙어지는 어둠 위에 **얇은 가로줄을
   * 촘촘히** 깔아 그 자리를 투영면으로 만들면, 어떤 그림 위에서도 같은 결이 한 겹 덮여 글이 늘
   * 같은 바탕에 선다. 띠가 시작하는 자리는 강조색 한 줄이 알린다.
   *
   * 칠은 마스크가 아니라 **띠 사각형 안에서 잘라** 만든다 — 기하 마스크는 컨테이너 이동을
   * 물려받지 않아 세로로 흐르는 이 목록에서 어긋난다.
   */
  private buildReadoutBand(artWidth: number, height: number, bottom: number, tone: number): Phaser.GameObjects.Graphics {
    const { readout } = INTERACTION_LAYER;
    const bandHeight = height * INTERACTION_LAYER.scrim;
    const top = bottom - bandHeight;
    const left = -artWidth / 2;
    const band = this.add.graphics();
    band.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, 0, 0, SCRIM_ALPHA, SCRIM_ALPHA);
    band.fillRect(left, top, artWidth, bandHeight);
    // 가로줄은 아래로 갈수록 어둠에 묻히므로 위쪽에서 가장 또렷하다 — 글이 서는 자리와 원화가
    // 만나는 그 경계가 가장 흐린 곳이라, 결이 필요한 곳에 결이 남는다.
    band.fillStyle(COLOR.void, readout.alpha);
    for (let y = top; y < bottom; y += readout.gap) band.fillRect(left, y, artWidth, readout.width);
    // 띠가 시작하는 선은 **테두리보다 옅다** — 같은 무게로 두면 한 카드 안에 테두리가 두 겹이 된다.
    band.lineStyle(2, tone, 0.38);
    band.lineBetween(left, top, left + artWidth, top);
    return band;
  }

  /**
   * 카드 오른쪽 아래의 칩 한 장.
   *
   * 세 상태가 **같은 자리·같은 크기**로 갈아 끼워진다 — 상태마다 다른 자리에 적으면 훑는 눈이
   * 카드마다 다른 곳을 찾아야 한다. 시계만 도는 동안에는 이 글자 하나만 갈아 끼운다.
   */
  private buildStateChip(view: InteractionLayerView, index: number, width: number, bottom: number): Phaser.GameObjects.Container {
    const { chip } = INTERACTION_LAYER;
    const away = view.state === "away";
    const done = view.state === "done";
    const tone = done ? 0xe0a83e : away ? BLUE : COLOR.accent;
    const holder = this.add.container(width / 2 - chip.inset - chip.width / 2, bottom - chip.up);
    holder.add(drawLayer(this, 0, 0, slantedRect(chip.width, chip.height, 14), { fill: 0x05070a, alpha: 0.88, edge: tone, edgeAlpha: 0.9 }));
    const label = done
      ? t("interaction.awaitingClaim")
      : away ? interactionRemainingLabel(view.remainingMs ?? 0) : interactionDurationLabel(view.city.durationMinutes);
    const text = this.add.text(0, 0, label, textStyle({ role: "emphasis", size: 27, color: done ? "#e0a83e" : away ? "#a8ddf5" : COLOR.accentText })).setOrigin(0.5);
    holder.add(text);
    // 시계는 이 글자 하나만 초마다 갈아 끼운다 — 카드를 다시 만들면 원화까지 매초 새로 선다.
    if (away) this.remainingLabels[index] = text;
    return holder;
  }

  /** 층을 누르면 그 도시의 쪽지가 열린다. 완료한 층은 바로 보상으로 이어진다. */
  private openCity(view: InteractionLayerView): void {
    this.cityPopup ??= new InteractionCityPopup(this, this.popups, interactionManager);
    this.journalPopup ??= new InteractionJournalPopup(this, this.popups, interactionManager);
    this.cityPopup.open(view, {
      onChanged: () => { void interactionManager.refresh().then((response) => { this.syncClock(response.serverTime); this.drawLayers(); }); },
      onOpenJournal: (cityId) => this.journalPopup!.open(cityId),
      // 쪽지의 시계도 씬이 서버와 맞춰 둔 같은 시각을 읽는다 — 두 곳이 따로 세면 층과 쪽지의
      // 남은 시간이 어긋난다.
      now: () => this.serverNow(),
    });
  }
}
