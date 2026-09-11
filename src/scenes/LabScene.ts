import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugResearchBoard, setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { GameApiError, type PullResultDto } from "../api/contracts";
import { canPull, pullCost, type Banner, type ResearchGrade } from "../core/gacha";
import { ResearchPresentationController, highestRarity, researchSlotViews } from "../core/researchPresentation";
import { BANNERS } from "../data/banners";
import { getRelic } from "../data/relics";
import {
  enableHitOnClick,
  portraitAssetFor,
  spawnPuppet,
} from "../puppets/assets";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { TopBar } from "../ui/TopBar";
import { drawLayer, drawRoundedLayer, HOLO, slantedRect, toPoints } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { CRACK_BRANCHES, FOSSIL_CRACK, crackBranchPoints, fossilShards, shardPoints } from "../ui/fossilCrack";
import { researchBoardLayout } from "../ui/researchBoardLayout";
import { ResearchSlotTile } from "../ui/ResearchSlotTile";
import { firstMeetingLine } from "../data/relicFirstMeetings";
import { audioManager, type AudioScope } from "../managers/AudioManager";
import { PopupLayer } from "../ui/PopupLayer";
import { MileagePopup } from "../ui/MileagePopup";
import { settingsManager } from "../managers/SettingsManager";
import { colorAssistPolicy, excavationStageDuration } from "../core/settings";
import { flashPolicy } from "../ui/signatureEffects";
import { hasRareExcavationResult } from "../core/hapticPolicy";

/** 마일리지 상점 버튼의 황금빛. 다른 버튼과 갈라 놓아 "쌓아 두었다 쓰는 곳"임을 알린다. */
const MILEAGE_EDGE = 0xf2c744;

/** 배너 그림이 서는 바닥. */
const BANNER_FLOOR = 1240;

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
  private pityText!: Phaser.GameObjects.Text;
  private oneButton!: Button;
  private tenButton!: Button;
  private showcase?: PuppetCreature;
  /** 빠른 배너 전환 중 늦게 끝난 원화 로딩이 최신 배너를 덮지 못하게 하는 요청 번호. */
  private showcaseRequest = 0;
  /** 연속 터치로 같은 재화가 두 번 결제되는 요청 중복을 클라이언트에서도 막는다. */
  private pullPending = false;
  /** 결과 저장 뒤의 시각 연출만 소유하며, 씬 종료 시 반드시 invalidate/destroy한다. */
  private readonly presentation = new ResearchPresentationController();
  private presentationLayer?: Phaser.GameObjects.Container;
  /** 단계 넘기기가 현재 기다리는 타이머를 즉시 깨우는 훅이다. */
  private finishStage?: () => void;
  /** 결과판 단계에서 화면 아무 곳을 눌렀을 때 할 일. 자동 단계 중에는 비어 있다. */
  private boardTap?: () => void;
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
  private boardShortened = false;
  private boardRequest = 0;

  constructor() {
    super("lab");
  }

  private get banner(): Banner {
    return BANNERS[this.bannerIndex];
  }

  create(): void {
    setDebugScene("lab");
    this.bannerIndex = 0;
    this.audioScope = audioManager?.createScope();
    this.popupLayer = new PopupLayer(this, 2400);

    const cx = BASE_WIDTH / 2;
    // 배경 5번의 연구 설비 원화를 쓰고, 얇은 암막으로 기존 청록색 UI 대비를 유지한다.
    addSceneBackground(this, BACKGROUND.lab);
    this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void, 0.34).setDepth(-29);
    this.add.rectangle(cx, BANNER_FLOOR, BASE_WIDTH, 3, COLOR.panelEdge).setDepth(-28);

    // 모집 화면은 "무엇으로 뽑을 수 있나"를 묻는다. 상단 줄도 다이아·화석·호박석으로 바꾼다.
    this.topBar = new TopBar(this, 40, {
      currencies: "recruit",
      onSettings: () => this.scene.start("settings", { returnScene: "lab" }),
    });
    this.addMileageButton(BASE_WIDTH - 246, 178);

    this.bannerName = this.add.text(cx, 170, "", textStyle({ role: "display", size: 44 })).setOrigin(0.5, 0);
    // 기능을 풀어 쓴 개발 메모 대신 현재 픽업처럼 선택에 필요한 정보만 제목 아래에 남긴다.
    this.pickupText = this.add.text(cx, 250, "", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5, 0);
    // 기존 Button/패널 토큰을 재사용해 확률 정보가 별도 웹 UI처럼 보이지 않게 한다.
    new Button(this, cx, 390, {
      width: 300, height: 82, label: "확률 정보", fontSize: 28,
      onClick: () => this.showRates(),
    });

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

    this.oneButton = new Button(this, 300, NAV_TOP - 250, {
      width: 440,
      height: 150,
      label: "1회 연구",
      sub: "",
      fontSize: 36,
      onClick: () => this.doPull(1),
    });
    this.tenButton = new Button(this, 780, NAV_TOP - 250, {
      width: 440,
      height: 150,
      label: "10회 연구",
      sub: "",
      fontSize: 36,
      onClick: () => this.doPull(10),
    });

    this.pityText = this.add.text(cx, NAV_TOP - 355, "", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);

    // 캐릭터 획득 연구와 마일리지는 연구소에 남고, 배치형 자원 발굴은 로비 기능으로 분리한다.
    new BottomNav(this, "lab");
    // 씬을 떠난 뒤 끝나는 비동기 로딩도 무효화하고 현재 Puppet을 정리한다.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.showcaseRequest += 1;
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
      this.presentationLayer?.destroy(true);
      this.presentationLayer = undefined;
      this.audioScope?.release();
      this.audioScope = undefined;
      this.popupLayer?.closeAll(); this.popupLayer = undefined; this.mileagePopup = undefined;
    });
    void this.showcaseRelic();
    this.refresh();
  }

  /**
   * 마일리지 상점.
   *
   * 뽑을 때마다 쌓이는 마일리지를 쓰는 자리라 상단 재화 바로 아래에 붙는다. 다른 버튼과
   * 달리 황금빛 홀로그램인 이유는, 모집 화면에서 유일하게 "쌓아 두었다가 쓰는" 곳이기
   * 때문이다 — 색이 곧 그 성격을 알린다.
   */
  private addMileageButton(x: number, y: number): void {
    const width = 300;
    const height = 70;
    const container = this.add.container(x, y);
    // 상단 재화 줄과 같은 둥근 면이다. 바로 아래에 붙는 버튼이라 모양이 갈리면 따로 논다.
    container.add(drawRoundedLayer(this, 0, 0, width, height, { fill: 0x2a2110, alpha: 0.95, radius: height / 2 }));
    const ring = this.add.graphics();
    ring.lineStyle(3, MILEAGE_EDGE, 0.95);
    ring.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    container.add(ring);
    container.add(this.add.text(0, 0, "마일리지 상점", textStyle({ role: "display", size: 28, color: "#ffe9a3" })).setOrigin(0.5));
    const hit = this.add.rectangle(x, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => container.setScale(1.06));
    hit.on("pointerout", () => container.setScale(1));
    hit.on("pointerup", () => {
      container.setScale(1);
      // 임시 마일리지 목록은 연구소 탭 위에 머물며 유료 상점 씬으로 이동하지 않는다.
      if (!this.popupLayer) return;
      this.mileagePopup ??= new MileagePopup(this, this.popupLayer, () => { this.mileagePopup = undefined; });
      this.mileagePopup.open();
    });
  }

  private switchBanner(delta: number): void {
    this.bannerIndex = (this.bannerIndex + delta + BANNERS.length) % BANNERS.length;
    this.refresh();
    void this.showcaseRelic();
  }

  /** 배너 데이터의 픽업 렐릭과 그 렐릭 데이터의 원화를 차례로 따라 대표 그림을 교체한다. */
  private async showcaseRelic(): Promise<void> {
    const request = ++this.showcaseRequest;
    const featured = getRelic(this.banner.featuredRelicId);
    const nextShowcase = await spawnPuppet(this, portraitAssetFor(featured.portraitAssetId), {
      x: BASE_WIDTH / 2,
      groundY: BANNER_FLOOR,
      height: 860,
      depth: -20,
    });
    // 이미 다른 배너를 골랐다면 방금 완성된 오래된 원화는 화면에 붙이지 않는다.
    if (request !== this.showcaseRequest) {
      nextShowcase.destroy();
      return;
    }
    this.showcase?.destroy();
    this.showcase = nextShowcase;
    // 배너의 전신 일러스트도 정보창과 동일하게 터치 반응을 준다.
    enableHitOnClick(this, this.showcase);
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
      const message = error instanceof GameApiError ? error.message : "통신에 실패했습니다. 다시 시도해 주세요.";
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
    overlay.add(this.add.text(cx, 390, "연구 확률 · 보장 정책", textStyle({ role: "display", size: 42 })).setOrigin(0.5));
    const rates = (["SSR", "SR", "R", "GRAY"] as const)
      .map((rarity) => `${rarity === "GRAY" ? "회색 보상" : rarity}  ${(banner.slotRates[rarity] * 100).toFixed(1)}%`)
      .join("\n");
    overlay.add(this.add.text(cx, 475, rates, textStyle({ role: "body", size: 30, align: "center", lineSpacing: 14 })).setOrigin(0.5, 0));
    const pity = session.gachaPityByGroup[banner.pityGroupId] ?? { pullsSinceSsr: 0, pickupGuaranteed: false };
    // 확률뿐 아니라 현재 계정 상태와 배너 교체 정책, 중복 환산까지 한 화면에서 확인시킨다.
    const policy = [
      `현재 SSR 미획득 ${pity.pullsSinceSsr}회 · 확정까지 ${Math.max(0, banner.highestRarityGuarantee - pity.pullsSinceSsr)}회`,
      `픽업 확정  ${pity.pickupGuaranteed ? "ON · 다음 SSR은 픽업" : "OFF"}`,
      `SSR 픽업 확률 ${(banner.pickupRate * 100).toFixed(0)}% · 실패 시 다음 SSR 픽업 확정`,
      `이월 그룹  ${banner.pityGroupId}`,
      "같은 그룹의 교체 배너로 천장·픽업 확정 이월",
      "10연 마지막 슬롯 SR 이상 보장 (SSR 천장 우선)",
      "중복 보상  해당 렐릭 파편 +1 · 파편을 모아 한계 돌파",
      "별 V 달성 이후 중복은 공용 DNA 조각 +1",
    ].join("\n");
    overlay.add(this.add.text(cx, 700, policy, textStyle({ role: "body", size: 25, color: COLOR.inkDim, align: "center", lineSpacing: 13, wrap: 760 })).setOrigin(0.5, 0));
    const close = new Button(this, cx, 1190, { width: 320, height: 100, label: "확인", fontSize: 32, onClick: () => overlay.destroy() });
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
    const skip = new Button(this, BASE_WIDTH - 150, 100, { width: 230, height: 70, label: "전체 건너뛰기", fontSize: 22, onClick: () => {
      this.presentation.skipAll();
      this.finishStage?.();
    } });
    layer.add(skip);

    content.add(this.add.text(BASE_WIDTH / 2, 660, "화석 DNA 연구 중", textStyle({ role: "display", size: 48, color: COLOR.inkDim })).setOrigin(0.5));
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
    layer.add(this.add.text(BASE_WIDTH / 2, 800, `${assist.glyph ? `${assist.glyph} ` : ""}${rarity === "SSR" ? "호박빛 공명이 폭발한다" : rarity === "SR" ? "청록과 보랏빛이 교차한다" : rarity === "R" ? "회청색 파장이 감지된다" : "중립 파장이 응결한다"}`, textStyle({ role: "emphasis", size: 42, align: "center", wrap: 820 })).setOrigin(0.5));
    const flashes = flashPolicy(reduceFlashes);
    this.tweens.add({ targets: flash, alpha: 0.55 * flashes.alphaRatio, duration: 180, yoyo: true, repeat: Math.min(1, flashes.maxRepeats) });
  }

  private rarityColor(rarity: ResearchGrade): number {
    return rarity === "SSR" ? COLOR.raritySSR : rarity === "SR" ? COLOR.raritySR : rarity === "R" ? COLOR.rarityR : COLOR.researchGray;
  }

  /**
   * 첫 대면.
   *
   * 새로 만난 렐릭이 든 칸을 연 **그 순간**에만 재생한다. 결과판을 덮는 제 암막을 깔아 그동안
   * 다른 칸이 눌리지 않게 하고, 화면을 누르면 곧바로 판으로 돌아온다. 신규 Puppet 로딩 실패도
   * 연출을 멈추지 않고 이름과 대사 텍스트로 대체한다.
   */
  private async showFirstMeeting(relicId: string, request: number, shortened: boolean): Promise<void> {
    const def = getRelic(relicId);
    const layer = this.add.container(0, 0).setDepth(1200);
    this.presentationLayer?.add(layer);
    layer.add(this.add.rectangle(BASE_WIDTH / 2, 960, BASE_WIDTH, 1920, COLOR.void, 0.88).setInteractive()
      .on("pointerup", () => this.finishStage?.()));
    let standing: PuppetCreature | undefined;
    try {
      standing = await spawnPuppet(this, portraitAssetFor(def.portraitAssetId), { x: BASE_WIDTH / 2, groundY: 1260, height: 900, depth: 1205 });
    } catch {
      // 부트 캐시나 WebGL 복제가 실패해도 첫 대면 정보는 텍스트로 온전히 전달한다.
      layer.add(this.add.text(BASE_WIDTH / 2, 650, `[${def.name} 스탠딩을 불러오지 못했습니다]`, textStyle({ role: "body", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    }
    if (!this.presentation.isCurrent(request)) { standing?.destroy(); layer.destroy(true); return; }
    layer.add(drawLayer(this, BASE_WIDTH / 2, 1470, slantedRect(900, 250), {
      fill: 0x141920, alpha: HOLO.glass, edge: this.rarityColor(def.rarity), edgeAlpha: 0.8,
    }));
    layer.add(this.add.text(140, 1380, `${def.name} · ${def.rarity}`, textStyle({ role: "display", size: 32, color: COLOR.accentText })).setOrigin(0, 0.5));
    layer.add(this.add.text(BASE_WIDTH / 2, 1500, firstMeetingLine(relicId), textStyle({ role: "body", size: 30, wrap: 780, align: "center" })).setOrigin(0.5));
    await this.waitForStage(excavationStageDuration("firstMeeting", shortened), request);
    standing?.destroy();
    layer.destroy(true);
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
    const shortened = settingsManager.get().presentation.shortenExcavation;
    content.removeAll(true);
    const board = researchBoardLayout(results.length, BASE_WIDTH);
    content.add(this.add.text(cx, board.titleY, "연구 결과", textStyle({ role: "display", size: 52 })).setOrigin(0.5));

    this.boardRequest = request;
    this.boardShortened = shortened;
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
    this.boardOpenAll = new Button(this, BASE_WIDTH - 150, 100, { width: 230, height: 70, label: "모두 열기", fontSize: 22, onClick: () => this.openEverySlot() });
    layer.add(this.boardOpenAll);

    // 전체 건너뛰기는 결과까지 건너뛴다는 뜻이다. 판을 깔되 칸은 이미 다 열려 있다.
    if (this.presentation.wasSkipped) this.openEverySlot();
    else this.syncBoard();
  }

  /** 남은 칸을 한 번에 연다. 첫 대면은 재생하지 않는다 — 여러 명이 줄줄이 이어지면 기다림이 된다. */
  private openEverySlot(): void {
    for (const tile of this.boardTiles) tile.reveal(true);
    this.syncBoard();
  }

  /**
   * 칸 하나를 연다.
   *
   * 새로 만난 렐릭이면 그 자리에서 곧바로 첫 대면이 이어진다 — 자동 단계로 미리 재생하면
   * 어느 칸에서 나왔는지와 무관해져 칸을 열 이유가 사라진다.
   */
  private async openSlot(tile: ResearchSlotTile): Promise<void> {
    // 첫 대면이 재생되는 동안 들어온 터치는 그 연출을 넘기는 몫이므로 칸을 열지 않는다.
    if (this.finishStage || !tile.reveal()) return;
    this.audioScope?.play("research.crack");
    this.syncBoard();
    if (tile.view.kind !== "relic") return;
    const request = this.boardRequest;
    await this.showFirstMeeting(tile.view.relicId, request, this.boardShortened);
    if (this.presentation.isCurrent(request)) this.syncBoard();
  }

  /** 남은 칸 수에 따라 안내 문구·모두 열기 버튼·화면 터치의 뜻을 함께 맞춘다. */
  private syncBoard(): void {
    const closed = this.boardTiles.filter((tile) => !tile.opened);
    setDebugResearchBoard({ slots: this.boardTiles.length, opened: this.boardTiles.length - closed.length });
    if (closed.length > 0) {
      this.boardHint?.setText("칸을 눌러 확인");
      this.boardTap = () => void this.openSlot(closed[0]);
      return;
    }
    this.boardHint?.setText("화면을 눌러 돌아가기");
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
    this.pickupText.setText(`PICK UP  ${pickupNames.join(" · ")}`);
    const currentPity = session.gachaPityByGroup[banner.pityGroupId] ?? { pullsSinceSsr: 0, pickupGuaranteed: false };
    this.pityText.setText(`SSR 확정까지 ${Math.max(0, banner.highestRarityGuarantee - currentPity.pullsSinceSsr)}회${currentPity.pickupGuaranteed ? " · 다음 SSR 픽업 확정" : ""}`);

    const unit = banner.currency === "fossil" ? "화석" : "호박석";
    this.oneButton
      .setSub(`${unit} ${pullCost(banner, 1)}`)
      .setEnabled(!this.pullPending && canPull(session.wallet, banner, 1));
    this.tenButton
      .setSub(`${unit} ${pullCost(banner, 10)}`)
      .setEnabled(!this.pullPending && canPull(session.wallet, banner, 10));
  }
}
