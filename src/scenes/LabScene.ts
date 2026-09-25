import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugResearchBoard, setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type PullResultDto } from "../api/contracts";
import { canPull, pullCost, type Banner, type ResearchGrade } from "../core/gacha";
import { ResearchPresentationController, highestRarity, researchSlotViews } from "../core/researchPresentation";
import { BANNERS } from "../data/banners";
import { getRelic } from "../data/relics";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { TopBar } from "../ui/TopBar";
import { drawLayer, HOLO, slantedRect, toPoints } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { useBackgroundTexture, BACKGROUND } from "../ui/backgrounds";
import { CRACK_BRANCHES, FOSSIL_CRACK, crackBranchPoints, fossilShards, shardPoints } from "../ui/fossilCrack";
import { researchBoardLayout } from "../ui/researchBoardLayout";
import { ResearchSlotTile } from "../ui/ResearchSlotTile";
import { playNewRelicShowcase } from "../ui/NewRelicShowcase";
import { exposeShowcasePreview } from "../testSupport/showcaseHarness";
import { audioManager, type AudioScope } from "../managers/AudioManager";
import { PopupLayer } from "../ui/PopupLayer";
import { ResearchPullButton } from "../ui/ResearchPullButton";
import { addRatesLink, addSideShopButton, SIDE_SHOP } from "../ui/sideShop";
import { LAB_CHROME } from "../ui/labLayout";
import { bindCurrencyGuide, openCurrencyGuide } from "../ui/currencyGuideEntry";
import { MileagePopup } from "../ui/MileagePopup";
import { settingsManager } from "../managers/SettingsManager";
import { colorAssistPolicy, excavationStageDuration } from "../core/settings";
import { flashPolicy } from "../ui/signatureEffects";
import { hasRareExcavationResult } from "../core/hapticPolicy";
import { ResearchCinematic, researchCinematicEnabled } from "../ui/ResearchCinematic";
import { cinematicCardArt, cinematicRewards, isCinematicCount } from "../ui/researchCinematicModel";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { formatCurrency } from "../core/formatCurrency";
import { playSceneEntrance, startScene } from "../ui/screenTransition";

/**
 * 연구소 — 화석과 호박석으로 렐릭을 복원하는 기존 연구 시설이다.
 *
 * 화석은 흔한 재화, 호박석은 귀한 재화다. 뽑기 규칙 자체는 `core/gacha`에 있고
 * 여기서는 무엇을 눌렀는지 전하고 결과를 보여 주기만 한다.
 */
export class LabScene extends Phaser.Scene {
  private topBar!: TopBar;
  private bannerIndex = 0;
  private bannerName!: Phaser.GameObjects.Text;
  private pickupText!: Phaser.GameObjects.Text;
  private pityLabel!: Phaser.GameObjects.Text;
  private pityText!: Phaser.GameObjects.Text;
  private pityUnit!: Phaser.GameObjects.Text;
  private pityNote!: Phaser.GameObjects.Text;
  private oneButton!: ResearchPullButton;
  private tenButton!: ResearchPullButton;
  /**
   * 지금 배너의 모집 원화.
   *
   * 픽업 렐릭의 전신 Puppet을 세우던 자리다 — 배너 하나가 개체 하나만 보여 줄 수 있어
   * 셋이 함께 선 모집 원화를 쓸 방법이 없었고, 무엇보다 **무거운 ZIP 한 벌을 배너를
   * 넘길 때마다 새로 읽었다.** 지금은 배너가 가리키는 원화 한 장을 갈아 끼운다.
   */
  private showcase?: Phaser.GameObjects.Image;
  /** 연속 터치로 같은 재화가 두 번 결제되는 요청 중복을 클라이언트에서도 막는다. */
  private pullPending = false;
  /** 결과 저장 뒤의 시각 연출만 소유하며, 씬 종료 시 반드시 invalidate/destroy한다. */
  private readonly presentation = new ResearchPresentationController();
  private presentationLayer?: Phaser.GameObjects.Container;
  /** 단계 넘기기가 현재 기다리는 타이머를 즉시 깨우는 훅이다. */
  private finishStage?: () => void;
  /** 결과판 단계에서 화면 아무 곳을 눌렀을 때 할 일. 자동 단계 중에는 비어 있다. */
  private boardTap?: () => void;
  /** 새로 만난 렐릭의 소개 장면이 도는 중인가. 그동안 칸은 열리지 않는다. */
  private showcasing = false;
  /** 씬 종료 뒤 비동기 연출의 늦은 효과음 요청이 재생되지 않게 하는 오디오 수명 범위다. */
  private audioScope?: AudioScope;
  /** 마일리지 교환은 유료 상점 씬과 분리된 연구소 로컬 레이어에만 열린다. */
  private popupLayer?: PopupLayer;
  private mileagePopup?: MileagePopup;
  /** 결과판에 깔린 칸들. 몇 칸이 남았는지가 안내 문구와 화면 터치의 뜻을 정한다. */
  private boardTiles: ResearchSlotTile[] = [];
  private boardHint?: Phaser.GameObjects.Text;
  private boardOpenAll?: Button;
  private boardLayer?: Phaser.GameObjects.Container;
  /** 칸을 여는 동안에도 연출 시간이 갈리지 않게 판이 열릴 때의 설정 스냅샷을 든다. */
  /** 떠 있는 3D 연출. 씬이 꺼지면 캔버스 위의 DOM도 함께 걷어야 한다. */
  private cinematic?: ResearchCinematic;
  private boardRequest = 0;

  constructor() {
    super("lab");
  }

  private get banner(): Banner {
    return BANNERS[this.bannerIndex];
  }

  create(): void {
    setDebugScene("lab");
    exposeShowcasePreview((relicId) => void this.introduceRelic(relicId));
    this.bannerIndex = 0;
    this.audioScope = audioManager?.createScope();
    this.popupLayer = new PopupLayer(this, 2400);

    const cx = BASE_WIDTH / 2;
    // **배경은 배너가 갖는다.** 연구소 설비 원화를 한 장 깔고 그 위에 모집 원화를 덮던 때는,
    // 들어가는 순간 설비 원화가 먼저 보이고 그 위로 픽업 원화가 녹아 들어와 화면이 한 번
    // 조립되는 과정이 그대로 보였다. 지금은 `showcaseRelic`이 세우는 한 장이 곧 배경이고,
    // 전용 원화가 없는 배너에서만 그 자리를 설비 원화가 메운다.
    // 원화를 탁하게 덮는 막과 가로선을 깔지 않는다 — 모집 원화가 곧 이 화면이라 그 위에 한 겹을
    // 더 두르면 밝은 파스텔이 잿빛으로 가라앉는다. 양옆만 눌러 가운데로 눈이 가게 한다.
    this.drawSideVignette();

    // 모집 화면은 "무엇으로 뽑을 수 있나"를 묻는다. 상단 줄도 다이아·화석·호박석으로 바꾼다.
    bindCurrencyGuide({ scene: this, popups: this.popupLayer });
    this.topBar = new TopBar(this, 40, {
      currencies: "recruit",
      onSettings: () => startScene(this, "settings", { returnScene: "lab" }),
      // 연구소의 화석·호박석도 로비의 보석과 같이 눌러서 무엇에 쓰는지 읽을 수 있어야 한다.
      onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popupLayer! }, currency),
    });
    // 마일리지 상점은 로비 상점과 같은 아이콘 칩으로 왼쪽 중상단에 선다(고고학 상점과 같은 자리).
    addSideShopButton(this, SIDE_SHOP.screen.x, SIDE_SHOP.screen.y, SIDE_SHOP.screen.size, t("lab.mileageShop.short"), () => this.openMileageShop());
    addRatesLink(this, LAB_CHROME.rates.x, LAB_CHROME.rates.y, t("lab.rates"), () => this.showRates());

    this.bannerName = this.add.text(cx, 170, "", textStyle({ role: "display", size: 44 })).setOrigin(0.5, 0)
      .setShadow(0, 3, "#05070a", 8, false, true);
    // 픽업이 있는 배너에만 선다 — 화석 연구는 기본 연구라 이 줄이 비어 있다.
    this.pickupText = this.add.text(cx, 250, "", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5, 0)
      .setShadow(0, 2, "#05070a", 6, false, true);

    // 배너 전환.
    new Button(this, 100, 700, {
      width: 110,
      height: 110,
      label: "◀",
      fontSize: 40,
      onClick: () => this.switchBanner(-1),
    });
    new Button(this, BASE_WIDTH - 100, 700, {
      width: 110,
      height: 110,
      label: "▶",
      fontSize: 40,
      onClick: () => this.switchBanner(1),
    });

    this.oneButton = new ResearchPullButton(this, 300, LAB_CHROME.pull.y, {
      ...LAB_CHROME.pull.size, label: t("lab.pull.one"), tone: LAB_CHROME.pull.oneTone, onClick: () => void this.doPull(1),
    });
    this.tenButton = new ResearchPullButton(this, 780, LAB_CHROME.pull.y, {
      ...LAB_CHROME.pull.size, label: t("lab.pull.ten"), tone: LAB_CHROME.pull.tenTone, onClick: () => void this.doPull(10),
    });

    this.addPityPlate(cx);

    // 캐릭터 획득 연구와 마일리지는 연구소에 남고, 배치형 자원 발굴은 로비 기능으로 분리한다.
    new BottomNav(this, "lab");
    // 씬을 떠난 뒤 끝나는 비동기 로딩도 무효화하고 현재 Puppet을 정리한다.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.showcase?.destroy();
      this.showcase = undefined;
      this.presentation.invalidate();
      this.finishStage?.();
      this.boardTap = undefined;
      this.boardTiles = [];
      this.boardHint = undefined;
      this.boardOpenAll = undefined;
      this.boardLayer = undefined;
      setDebugResearchBoard(undefined);
      this.cinematic?.close();
      this.cinematic = undefined;
      this.presentationLayer?.destroy(true);
      this.presentationLayer = undefined;
      this.audioScope?.release();
      this.audioScope = undefined;
      this.popupLayer?.closeAll(); this.popupLayer = undefined; this.mileagePopup = undefined;
    });
    this.showcaseRelic();
    this.refresh();
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  /** 마일리지 상점 — 임시 목록은 연구소 위에 머물며 유료 상점 씬으로 이동하지 않는다. */
  private openMileageShop(): void {
    if (!this.popupLayer) return;
    this.mileagePopup ??= new MileagePopup(this, this.popupLayer, () => { this.mileagePopup = undefined; });
    this.mileagePopup.open();
  }

  /** 양옆만 누르는 비네트. 위아래는 상단 줄과 하단 탭이 제 그라데이션을 이미 갖는다. */
  private drawSideVignette(): void {
    const { band, strength } = LAB_CHROME.vignette;
    const g = this.add.graphics().setDepth(LAB_CHROME.depth.vignette);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, strength, 0, strength, 0);
    g.fillRect(0, 0, band, BASE_HEIGHT);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, strength, 0, strength);
    g.fillRect(BASE_WIDTH - band, 0, band, BASE_HEIGHT);
  }

  /**
   * SSR 확정까지 남은 수 — 버튼 바로 위, 수가 크게 선 판 한 장.
   *
   * 글 한 줄로 두던 때는 밝은 원화 위에서 노란 글자가 묻혔다. 판을 깔되 **아래로 떨어지는 검은
   * 복제 한 겹**(그림자)과 윗변의 강조선만 두르고, 남은 수만 크게 세운다.
   */
  private addPityPlate(cx: number): void {
    const { y, width, height } = LAB_CHROME.pity;
    const shape = slantedRect(width, height, 22);
    const plate = this.add.container(cx, y);
    plate.add(drawLayer(this, 6, 8, shape, { fill: 0x000000, alpha: 0.45, shadow: false }));
    plate.add(drawLayer(this, 0, 0, shape, { fill: 0x10151d, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.95, edgeWidth: 3 }));
    this.pityLabel = this.add.text(0, 0, "", textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(0, 0.5);
    this.pityText = this.add.text(0, -2, "", textStyle({ role: "display", size: 44, color: COLOR.accentText })).setOrigin(0, 0.5)
      .setShadow(0, 3, "#05070a", 6, false, true);
    this.pityUnit = this.add.text(0, 2, "", textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(0, 0.5);
    this.pityNote = this.add.text(0, height / 2 + 26, "", textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(0.5)
      .setShadow(0, 2, "#05070a", 6, false, true);
    plate.add([this.pityLabel, this.pityText, this.pityUnit, this.pityNote]);
  }

  private switchBanner(delta: number): void {
    this.bannerIndex = (this.bannerIndex + delta + BANNERS.length) % BANNERS.length;
    this.refresh();
    this.showcaseRelic();
  }

  /**
   * 배너가 가리키는 모집 원화를 세운다. **이 한 장이 이 화면의 배경이다.**
   *
   * 화면이 사는 동안 한 장을 붙잡는 `addSceneBackground`를 쓰지 않는 이유는, 이 그림이
   * 배너를 넘길 때마다 함께 바뀌는 그 배너의 얼굴이기 때문이다. 원화를 세우는 일은
   * `useBackgroundTexture`를 지나야 쓰는 중에 텍스처가 내려가지 않는다 — 직접 `add.image`로
   * 세우면 붙잡히지 않는다.
   *
   * **전용 원화가 없는 배너만 연구소 설비 원화로 메운다.** 두 장을 겹쳐 두면 들어가는 순간
   * 설비 원화가 먼저 보이고 그 위로 픽업 원화가 덮여, 화면이 한 번 조립되는 과정이 그대로
   * 보인다.
   */
  private showcaseRelic(): void {
    // **앞 배너의 원화는 새 원화가 다 선 뒤에 걷는다.** 먼저 지우면 새 원화가 녹아 드는 0.16초
    // 동안 화면 뒤가 통째로 비어, 배너를 넘길 때마다 검게 한 번 깜빡였다.
    const previous = this.showcase;
    const image = this.add.image(BASE_WIDTH / 2, BASE_HEIGHT / 2, "__DEFAULT").setDepth(LAB_CHROME.depth.incomingArt).setAlpha(0);
    this.showcase = image;
    useBackgroundTexture(this, image, this.banner.artKey ?? BACKGROUND.lab, (loaded) => {
      if (this.showcase !== loaded) { loaded.destroy(); return; }
      loaded.setScale(Math.max(BASE_WIDTH / loaded.width, BASE_HEIGHT / loaded.height));
      // 같은 원화로 다시 세우는 것이면(뽑기를 마치고 돌아올 때) 녹여 들이지 않는다.
      if (previous?.active && previous.texture.key === loaded.texture.key) {
        loaded.setAlpha(1);
        previous.destroy();
        loaded.setDepth(LAB_CHROME.depth.art);
        return;
      }
      this.tweens.add({
        targets: loaded, alpha: 1, duration: 160,
        onComplete: () => { if (previous?.active) previous.destroy(); loaded.setDepth(LAB_CHROME.depth.art); },
      });
    });
  }

  private async doPull(count: 1 | 10): Promise<void> {
    const banner = this.banner;
    if (this.pullPending || !canPull(session.wallet, banner, count)) return;

    this.pullPending = true;
    this.refresh();
    try {
      // 결과와 비용은 클라이언트에서 계산하지 않고 API 응답만 화면에 반영한다.
      const response = await gameApi.pullRelics({ bannerId: banner.id, count });
      this.topBar.refresh();
      // API가 상태 반영과 저장까지 끝낸 뒤 응답하므로 이후 건너뛰기는 보상에 영향을 주지 않는다.
      await this.playPresentation(response.results);
    } catch (error) {
      const message = error instanceof GameApiError ? error.message : t("lab.networkError");
      this.showNotice(message);
    } finally {
      this.pullPending = false;
      this.refresh();
    }
  }

  /** 임시 API 오류도 게임 테마 안에서 짧게 안내한다. */
  private showNotice(message: string): void {
    const notice = this.add
      .text(BASE_WIDTH / 2, NAV_TOP - 390, message, textStyle({ role: "emphasis", size: 28, color: COLOR.accentText }))
      .setOrigin(0.5)
      .setDepth(700);
    this.time.delayedCall(1800, () => notice.destroy());
  }

  /** 배너에 선언된 조건부 픽업 확률과 등급 확률을 읽기 전용 패널로 보여 준다. */
  private showRates(): void {
    const banner = this.banner;
    const cx = BASE_WIDTH / 2;
    const overlay = this.add.container(0, 0).setDepth(850);
    const shade = this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void, 0.9).setInteractive();
    const panel = drawLayer(this, cx, 840, slantedRect(860, 980), {
      fill: 0x141920, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.3,
    });
    overlay.add([shade, panel]);
    overlay.add(this.add.text(cx, 390, t("lab.policy.title"), textStyle({ role: "display", size: 42 })).setOrigin(0.5));
    const rates = (["SSR", "SR", "R", "GRAY"] as const)
      .map((rarity) => t("lab.policy.rate", { rarity: rarity === "GRAY" ? t("lab.policy.grayReward") : rarity, percent: (banner.slotRates[rarity] * 100).toFixed(1) }))
      .join("\n");
    overlay.add(this.add.text(cx, 475, rates, textStyle({ role: "body", size: 30, align: "center", lineSpacing: 14 })).setOrigin(0.5, 0));
    const pity = session.gachaPityByGroup[banner.pityGroupId] ?? { pullsSinceSsr: 0, pickupGuaranteed: false };
    // 확률뿐 아니라 현재 계정 상태와 배너 교체 정책, 중복 환산까지 한 화면에서 확인시킨다.
    const policy = [
      t("lab.policy.pity", { since: pity.pullsSinceSsr, left: Math.max(0, banner.highestRarityGuarantee - pity.pullsSinceSsr) }),
      t("lab.policy.pickup", { state: t(pity.pickupGuaranteed ? "lab.policy.pickupOn" : "lab.policy.pickupOff") }),
      t("lab.policy.pickupRate", { percent: (banner.pickupRate * 100).toFixed(0) }),
      t("lab.policy.group", { group: banner.pityGroupId }),
      t("lab.policy.groupNote"),
      t("lab.policy.tenGuarantee"),
      t("lab.policy.duplicate"),
      t("lab.policy.duplicateMax"),
    ].join("\n");
    overlay.add(this.add.text(cx, 700, policy, textStyle({ role: "body", size: 25, color: COLOR.inkDim, align: "center", lineSpacing: 13, wrap: 760 })).setOrigin(0.5, 0));
    const close = new Button(this, cx, 1190, { width: 320, height: 100, label: t("lab.confirm"), fontSize: 32, onClick: () => overlay.destroy() });
    overlay.add(close);
    shade.on("pointerdown", () => overlay.destroy());
  }

  /** 현재 단계의 자동 진행을 기다린다. 탭하면 이 Promise만 끝나고 다음 상태로 넘어간다. */
  private waitForStage(ms: number, request: number): Promise<void> {
    return new Promise((resolve) => {
      let done = false;
      const timer = this.time.delayedCall(ms, finish);
      const trigger = () => finish();
      this.finishStage = trigger;
      const scene = this;
      function finish(): void {
        if (done) return;
        done = true;
        timer.remove(false);
        if (scene.finishStage === trigger && scene.presentation.isCurrent(request)) scene.finishStage = undefined;
        resolve();
      }
    });
  }

  /** 서버 확정 등급을 복권처럼 암시한 뒤 균열→결과판 순서로 재생한다. */
  private async playPresentation(results: PullResultDto[]): Promise<void> {
    // 한 연출 도중 설정을 다시 읽어 단계별 시간이 서로 갈리지 않도록 시작 시 스냅샷을 고정한다.
    const preferences = settingsManager.get();
    const request = this.presentation.begin();
    const rarity = highestRarity(results.map((result) => result.type === "relic" ? getRelic(result.relicId).rarity : result.grade));
    // API가 확정한 전체 결과를 순수 희귀도 정책에 넣고, 10연이어도 결과 묶음당 한 번만 울린다.
    if (hasRareExcavationResult([rarity])) settingsManager.haptic("rareExcavation");
    // 3D 연출이 서면 그것이 이 뽑기의 연출 전부다. 서지 못한 기기만 아래의 Phaser 연출을 탄다.
    if (await this.playCinematic(results, request)) return;
    this.presentationLayer?.destroy(true);
    const layer = this.add.container(0, 0).setDepth(900);
    this.presentationLayer = layer;
    // 결과가 나오는 동안에는 뒤 화면을 짙게 덮는다. 얇은 암막으로는 배너 제목·확률 정보·연구
    // 버튼이 그대로 비쳐, 뒤집힌 칸과 글자가 어느 화면의 것인지 뒤섞여 읽힌다.
    const shade = this.add.rectangle(BASE_WIDTH / 2, 960, BASE_WIDTH, 1920, COLOR.void, 0.93).setInteractive();
    layer.add(shade);
    // 단계 콘텐츠만 교체해 고정 입력면과 건너뛰기 버튼을 실수로 파괴하지 않는다.
    const content = this.add.container(0, 0);
    layer.add(content);
    // 자동 단계와 첫 대면은 기다리는 타이머를 깨우고, 결과판에서는 칸을 열거나 화면을 닫는다.
    shade.on("pointerup", () => {
      if (this.finishStage) { this.finishStage(); return; }
      this.boardTap?.();
    });
    const skip = new Button(this, BASE_WIDTH - 150, 100, { width: 230, height: 70, label: t("lab.skipAll"), fontSize: 22, onClick: () => {
      this.presentation.skipAll();
      this.finishStage?.();
    } });
    layer.add(skip);

    content.add(this.add.text(BASE_WIDTH / 2, 660, t("lab.scanning"), textStyle({ role: "display", size: 48, color: COLOR.inkDim })).setOrigin(0.5));
    await this.waitForStage(excavationStageDuration("scan", preferences.presentation.shortenExcavation), request);
    if (!this.presentation.isCurrent(request)) return;
    if (!this.presentation.wasSkipped) this.presentation.advance();

    if (!this.presentation.wasSkipped) {
      content.removeAll(true);
      this.breakFossil(content, rarity);
      this.cameras.main.shake(rarity === "SSR" ? 420 : 260, rarity === "SSR" ? 0.012 : 0.006);
      // 등급은 시각 연출에만 쓰며 사운드는 의미 키와 중앙 버스 설정으로 일관되게 재생한다.
      this.audioScope?.play("research.crack");
      await this.waitForStage(excavationStageDuration("crack", preferences.presentation.shortenExcavation), request);
      this.presentation.advance();
    }
    if (!this.presentation.isCurrent(request)) return;

    if (!this.presentation.wasSkipped) {
      this.showRarityFlash(content, rarity, preferences.accessibility.reduceFlashes, preferences.accessibility.colorAssist);
      await this.waitForStage(excavationStageDuration("rarity", preferences.presentation.shortenExcavation), request);
      this.presentation.advance();
    }
    if (!this.presentation.isCurrent(request)) return;

    skip.destroy();
    this.showResultBoard(content, layer, results, request);
  }

  /**
   * 화석 복원 시네마틱.
   *
   * 스캔 → 균열 → 폭발 → 카드 공개 → 결산까지 한 판이 전부 이 안에서 흐른다. 등급이 오를수록
   * 더 오래, 더 격하게 흔들리고 더 멀리 깨지며, 카드는 회색에서 시작해 서버가 확정한 등급까지
   * 한 칸씩 올라간 뒤 그 색으로 뒤집힌다. 결산 격자는 세로 화면에 맞춰 두 칸씩 다섯 줄이다.
   *
   * 새로 만난 렐릭은 그 카드가 **뒤집히기 직전에** 소개 장면이 먼저 돈다 — 카드를 보기 전에
   * "새로 온 누군가다"가 읽혀야 한다. 3D 무대 위에 Puppet을 겹쳐 세울 수 없으므로 그동안 판을
   * 숨기고 Phaser가 장면을 그린다. 건너뛰면 남은 소개가 차례로 돈 뒤 결산으로 간다.
   *
   * 돌려주는 값은 "시네마틱이 실제로 연출을 맡았는가"다. 거짓이면 씬은 예전 연출을 재생한다.
   */
  private async playCinematic(results: PullResultDto[], request: number): Promise<boolean> {
    if (!researchCinematicEnabled() || !isCinematicCount(results.length)) return false;
    const preferences = settingsManager.get();
    const views = researchSlotViews(results, (relicId) => getRelic(relicId).rarity);
    const rewards = cinematicRewards(views, {
      relic: (relicId) => { const def = getRelic(relicId); return { name: def.name, project: def.projectName }; },
      fragment: (name) => t("info.breakthrough.fragment", { name }),
      currency: (kind) => t(`currency.${kind}`),
      resourceTitle: t("lab.cinematic.resource"),
    });
    // 카드에 서는 것은 결과판과 같은 규칙이다 — 새 렐릭만 실제 원화, 중복과 재화는 액자 한 장.
    const art = cinematicCardArt(views, {
      portrait: (relicId) => getRelic(relicId).portraitAssetId,
      icon: (kind) => CURRENCY_ICON_BY_WALLET[kind],
      amount: (value) => formatCurrency(value),
    });
    const cinematic = await ResearchCinematic.open({
      canvas: this.game.canvas,
      scene: this,
      rewards,
      art,
      reducedMotion: preferences.accessibility.reduceMotion,
      introduce: async (index) => {
        const view = views[index];
        if (view?.kind === "relic" && this.presentation.isCurrent(request)) await this.introduceRelic(view.relicId);
      },
      text: {
        skip: t("lab.cinematic.skip"),
        gray: t("lab.cinematic.resource"),
        specimen: {
          code: t("lab.cinematic.specimenCode"),
          name: t("lab.cinematic.specimenName"),
          note: t("lab.cinematic.specimenNote"),
        },
      },
    });
    if (!cinematic) return false;
    // 늦게 도착한 판이 이미 넘어간 요청의 것이면 곧바로 걷는다.
    if (!this.presentation.isCurrent(request)) { cinematic.close(); return true; }
    this.cinematic?.close();
    this.cinematic = cinematic;
    setDebugResearchBoard({ slots: results.length, opened: 0 });
    this.audioScope?.play("research.crack");
    await cinematic.done();
    this.cinematic = undefined;
    if (!this.presentation.isCurrent(request)) { setDebugResearchBoard(undefined); return true; }
    this.presentation.skipAll();
    setDebugResearchBoard(undefined);
    return true;
  }

  /**
   * 화석을 깬다.
   *
   * 화석 그림 한 장이 흔들리다 균열이 번지고, 껍질이 마름모 조각으로 튀며 안에서 등급색 빛이
   * 새어 나온다. 모양과 흩어지는 방향은 `src/ui/fossilCrack.ts`가 갖는다 — 좌표를 씬에 적으면
   * 크기를 바꿀 때마다 그림이 갈린다.
   */
  private breakFossil(layer: Phaser.GameObjects.Container, rarity: ResearchGrade): void {
    const color = this.rarityColor(rarity);
    const cx = BASE_WIDTH / 2;
    const cy = FOSSIL_CRACK.centerY;
    const size = FOSSIL_CRACK.size;

    // 껍질 안에서 새어 나오는 빛. 겹쳐 밝아지는 합성이라 **옅게** 깔고 크게 부풀리지 않는다 —
    // 진하게 두면 밝은 배경 원화 위에서 하얗게 뭉개져 정작 봐야 할 껍질과 조각이 그 속에 묻힌다.
    const core = this.add.graphics({ x: cx, y: cy }).setBlendMode(Phaser.BlendModes.ADD);
    core.fillStyle(color, 0.32);
    core.fillPoints(toPoints(shardPoints(size * 0.34)), true);
    core.setScale(0.2).setAlpha(0);
    layer.add(core);
    this.tweens.add({ targets: core, scale: 1.2, alpha: 0.55, duration: 220, delay: 120, yoyo: true, hold: 40 });

    const shell = this.textures.exists("currency-fossil")
      ? this.add.image(cx, cy, "currency-fossil").setDisplaySize(size, size)
      : undefined;
    if (shell) {
      layer.add(shell);
      // 깨지기 직전의 떨림. 짧게 좌우로만 흔들어 껍질이 버티는 것처럼 보이게 한다.
      this.tweens.add({ targets: shell, x: cx + 7, duration: 46, yoyo: true, repeat: 3 });
      this.tweens.add({ targets: shell, alpha: 0, scaleX: shell.scaleX * 1.12, scaleY: shell.scaleY * 1.12, duration: 220, delay: 180 });
    }

    const crack = this.add.graphics({ x: cx, y: cy });
    crack.lineStyle(rarity === "SSR" ? 9 : 6, color, 1);
    for (const branch of CRACK_BRANCHES) crack.strokePoints(toPoints(crackBranchPoints(branch, size)), false);
    crack.setAlpha(0);
    layer.add(crack);
    this.tweens.add({ targets: crack, alpha: 1, duration: 120, delay: 60 });
    this.tweens.add({ targets: crack, alpha: 0, duration: 200, delay: 240 });

    // 껍질 조각. 잔뜩 흩뿌리지 않고 한 자리 수로 끊는다.
    for (const shard of fossilShards()) {
      const piece = this.add.graphics({ x: cx, y: cy });
      piece.fillStyle(0x0b0d10, 0.95);
      piece.fillPoints(toPoints(shardPoints(shard.size)), true);
      piece.lineStyle(2, color, 0.9);
      piece.strokePoints(toPoints(shardPoints(shard.size)), true);
      layer.add(piece);
      this.tweens.add({
        targets: piece,
        x: cx + Math.cos(shard.angle) * shard.distance,
        y: cy + Math.sin(shard.angle) * shard.distance,
        angle: shard.spin,
        alpha: 0,
        // 균열 단계(700ms) 안에서 끝나야 한다. 넘기면 다음 단계가 날아가는 조각을 잘라 낸다.
        duration: 480,
        delay: 140,
        ease: "Quad.easeOut",
      });
    }
  }

  /** 최고 등급 색만 미리 보여 주고 구체적인 카드 결과는 아직 숨긴다. */
  private showRarityFlash(layer: Phaser.GameObjects.Container, rarity: ResearchGrade, reduceFlashes: boolean, colorAssist: boolean): void {
    layer.removeAll(true);
    const flash = this.add.rectangle(BASE_WIDTH / 2, 960, BASE_WIDTH, 1920, this.rarityColor(rarity), 0.18);
    layer.add(flash);
    // SR은 보라 외곽, SSR은 밝은 호박 외곽을 더해 단색 R과 실루엣만으로도 구분한다.
    if (rarity === "SR" || rarity === "SSR") layer.add(this.add.rectangle(BASE_WIDTH / 2, 960, 920, 1240)
      .setStrokeStyle(10, rarity === "SR" ? COLOR.raritySRAlt : COLOR.raritySSRLight, 0.85));
    const assist = colorAssistPolicy(colorAssist, "rarity", rarity);
    layer.add(this.add.text(BASE_WIDTH / 2, 800, `${assist.glyph ? `${assist.glyph} ` : ""}${t(rarity === "SSR" ? "lab.resonance.SSR" : rarity === "SR" ? "lab.resonance.SR" : rarity === "R" ? "lab.resonance.R" : "lab.resonance.GRAY")}`, textStyle({ role: "emphasis", size: 42, align: "center", wrap: 820 })).setOrigin(0.5));
    const flashes = flashPolicy(reduceFlashes);
    this.tweens.add({ targets: flash, alpha: 0.55 * flashes.alphaRatio, duration: 180, yoyo: true, repeat: Math.min(1, flashes.maxRepeats) });
  }

  private rarityColor(rarity: ResearchGrade): number {
    return rarity === "SSR" ? COLOR.raritySSR : rarity === "SR" ? COLOR.raritySR : rarity === "R" ? COLOR.rarityR : COLOR.researchGray;
  }

  /**
   * 새로 만난 렐릭의 소개 장면.
   *
   * 그 개체의 카드가 **뒤집히기 직전에** 돈다(`NewRelicShowcase`). 결과판보다 위에 서고, 도는
   * 동안 들어온 손은 그 장면이 받는다 — 칸은 열리지 않는다.
   */
  private async introduceRelic(relicId: string): Promise<void> {
    const preferences = settingsManager.get();
    this.showcasing = true;
    try {
      await playNewRelicShowcase(this, relicId, {
        depth: 1300,
        reduceMotion: preferences.accessibility.reduceMotion,
        reduceFlashes: preferences.accessibility.reduceFlashes,
      });
    } finally {
      this.showcasing = false;
    }
  }

  /**
   * 결과판.
   *
   * 열 칸이 **뒤집힌 채로** 깔린다. 칸은 등급색만 말하고, 누르면 섬광과 함께 그 칸의 결과가
   * 들어온다 — 새로 만난 렐릭만 카드로 서고 나머지는 파편·재화 액자 한 장이라, 다 열고 나면
   * 액자들 사이에서 새 렐릭만 세로로 크게 남는다.
   *
   * 확인 버튼을 두지 않는다. 고를 것이 없는 영수증이라 **화면 아무 곳이나 누르면** 다음 칸이
   * 열리고, 다 열린 뒤에는 같은 손짓으로 닫힌다. 그 말은 판 안이 아니라 화면 밑동에서 한다.
   */
  private showResultBoard(
    content: Phaser.GameObjects.Container,
    layer: Phaser.GameObjects.Container,
    results: PullResultDto[],
    request: number,
  ): void {
    const cx = BASE_WIDTH / 2;
    content.removeAll(true);
    const board = researchBoardLayout(results.length, BASE_WIDTH);
    content.add(this.add.text(cx, board.titleY, t("lab.result.title"), textStyle({ role: "display", size: 52 })).setOrigin(0.5));

    this.boardRequest = request;
    this.boardLayer = layer;
    const views = researchSlotViews(results, (relicId) => getRelic(relicId).rarity);
    this.boardTiles = views.map((view, index) => {
      const cell = board.cells[index];
      return new ResearchSlotTile(this, cell.x, cell.y, {
        view,
        width: board.tileWidth,
        height: board.tileHeight,
        frameSize: board.frameSize,
      }, (tile) => void this.openSlot(tile));
    });
    for (const tile of this.boardTiles) { content.add(tile); tile.syncMasks(); }

    const hint = this.add
      .text(cx, board.hintY, "", textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5)
      .setAlpha(0.62);
    hint.setShadow(0, 3, "#000000", 4, false, true);
    content.add(hint);
    this.boardHint = hint;

    // 한 칸씩 여는 손이 지치지 않게 남은 칸을 한 번에 여는 길도 둔다. 다 열리면 사라진다.
    this.boardOpenAll = new Button(this, BASE_WIDTH - 150, 100, { width: 230, height: 70, label: t("lab.result.openAll"), fontSize: 22, onClick: () => void this.openEverySlot() });
    layer.add(this.boardOpenAll);

    // 전체 건너뛰기는 결과까지 건너뛴다는 뜻이다. 판을 깔되 칸은 이미 다 열려 있다.
    if (this.presentation.wasSkipped) void this.openEverySlot();
    else this.syncBoard();
  }

  /**
   * 남은 칸을 한 번에 연다.
   *
   * 아직 열지 않은 칸에 **새로 만난 렐릭**이 있으면 그 소개가 먼저 차례로 돈다 — 한꺼번에
   * 열린 판에서 처음 보는 얼굴이 카드 한 장으로만 지나가면 "새로 왔다"가 읽히지 않는다.
   */
  private async openEverySlot(): Promise<void> {
    if (this.showcasing) return;
    const request = this.boardRequest;
    for (const tile of this.boardTiles.filter((candidate) => !candidate.opened && candidate.view.kind === "relic")) {
      if (!this.presentation.isCurrent(request)) return;
      await this.introduceRelic(tile.view.kind === "relic" ? tile.view.relicId : "");
    }
    if (!this.presentation.isCurrent(request)) return;
    for (const tile of this.boardTiles) tile.reveal(true);
    this.syncBoard();
  }

  /**
   * 칸 하나를 연다.
   *
   * 새로 만난 렐릭이면 칸이 열리기 **전에** 소개 장면이 먼저 돈다 — 카드를 보기 전에 "새로 온
   * 누군가다"가 읽히게 한다. 자동 단계로 미리 재생하지 않는 이유는, 그러면 어느 칸에서 나왔는지와
   * 무관해져 칸을 열 이유가 사라지기 때문이다.
   */
  private async openSlot(tile: ResearchSlotTile): Promise<void> {
    // 소개 장면이 도는 동안 들어온 터치는 그 장면의 몫이므로 칸을 열지 않는다.
    if (this.finishStage || this.showcasing || tile.opened) return;
    if (tile.view.kind === "relic") {
      const request = this.boardRequest;
      await this.introduceRelic(tile.view.relicId);
      if (!this.presentation.isCurrent(request)) return;
    }
    if (!tile.reveal()) return;
    this.audioScope?.play("research.crack");
    this.syncBoard();
  }

  /** 남은 칸 수에 따라 안내 문구·모두 열기 버튼·화면 터치의 뜻을 함께 맞춘다. */
  private syncBoard(): void {
    const closed = this.boardTiles.filter((tile) => !tile.opened);
    setDebugResearchBoard({ slots: this.boardTiles.length, opened: this.boardTiles.length - closed.length });
    if (closed.length > 0) {
      this.boardHint?.setText(t("lab.result.tapTile"));
      this.boardTap = () => void this.openSlot(closed[0]);
      return;
    }
    this.boardHint?.setText(t("lab.result.tapToReturn"));
    this.boardOpenAll?.destroy();
    this.boardOpenAll = undefined;
    this.presentation.advance();
    this.boardTap = () => this.closeBoard();
  }

  /** 결과판을 치운다. 판이 사라지면 화면 터치는 다시 연구소 조작으로 돌아간다. */
  private closeBoard(): void {
    this.boardTap = undefined;
    this.boardTiles = [];
    this.boardHint = undefined;
    this.boardOpenAll = undefined;
    setDebugResearchBoard(undefined);
    this.boardLayer?.destroy(true);
    this.boardLayer = undefined;
    this.presentationLayer = undefined;
  }

  private refresh(): void {
    const banner = this.banner;
    this.bannerName.setText(banner.name);
    const pickupNames = Object.values(banner.pickupRelicIds).flat().map((id) => getRelic(id).name);
    this.pickupText.setText(pickupNames.length > 0 ? `PICK UP  ${pickupNames.join(" · ")}` : "");
    const currentPity = session.gachaPityByGroup[banner.pityGroupId] ?? { pullsSinceSsr: 0, pickupGuaranteed: false };
    // 판 안의 세 조각(말 · 수 · 단위)을 한 덩어리로 재서 가운데에 놓는다.
    this.pityLabel.setText(t("lab.pity.label"));
    this.pityText.setText(String(Math.max(0, banner.highestRarityGuarantee - currentPity.pullsSinceSsr)));
    this.pityUnit.setText(t("lab.pity.unit"));
    const gap = 12;
    const total = this.pityLabel.width + gap + this.pityText.width + 6 + this.pityUnit.width;
    this.pityLabel.setX(-total / 2);
    this.pityText.setX(this.pityLabel.x + this.pityLabel.width + gap);
    this.pityUnit.setX(this.pityText.x + this.pityText.width + 6);
    this.pityNote.setText(currentPity.pickupGuaranteed && pickupNames.length > 0 ? t("lab.pity.pickupNext") : "");

    const icon = CURRENCY_ICON_BY_WALLET[banner.currency];
    this.oneButton
      .setCost(icon, pullCost(banner, 1), canPull(session.wallet, banner, 1))
      .setEnabled(!this.pullPending && canPull(session.wallet, banner, 1));
    this.tenButton
      .setCost(icon, pullCost(banner, 10), canPull(session.wallet, banner, 10))
      .setEnabled(!this.pullPending && canPull(session.wallet, banner, 10));
  }
}
