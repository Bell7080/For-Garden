import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { GameApiError } from "../api/contracts";
import { canPull, pullCost, type AcquisitionResult, type Banner } from "../core/gacha";
import { ExcavationPresentationController, firstMeetingRelicIds, highestRarity } from "../core/excavationPresentation";
import { BANNERS } from "../data/banners";
import { getRelic } from "../data/relics";
import {
  enableHitOnClick,
  portraitAssetFor,
  portraitUsesRelicTint,
  spawnPuppet,
} from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { TopBar } from "../ui/TopBar";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { PortraitCard } from "../ui/PortraitCard";
import { firstMeetingLine } from "../data/relicFirstMeetings";

/** 배너 그림이 서는 바닥. */
const BANNER_FLOOR = 1240;

/**
 * 연구소 — 화석과 호박석으로 렐릭을 발굴하는 곳.
 *
 * 화석은 흔한 재화, 호박석은 귀한 재화다. 뽑기 규칙 자체는 `core/gacha`에 있고
 * 여기서는 무엇을 눌렀는지 전하고 결과를 보여 주기만 한다.
 */
export class LabScene extends Phaser.Scene {
  private topBar!: TopBar;
  private bannerIndex = 0;
  private bannerName!: Phaser.GameObjects.Text;
  private bannerDesc!: Phaser.GameObjects.Text;
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
  private readonly presentation = new ExcavationPresentationController();
  private presentationLayer?: Phaser.GameObjects.Container;
  /** 단계 넘기기가 현재 기다리는 타이머를 즉시 깨우는 훅이다. */
  private finishStage?: () => void;

  constructor() {
    super("lab");
  }

  private get banner(): Banner {
    return BANNERS[this.bannerIndex];
  }

  create(): void {
    setDebugScene("lab");
    this.bannerIndex = 0;

    const cx = BASE_WIDTH / 2;
    // 배경 5번의 연구 설비 원화를 쓰고, 얇은 암막으로 기존 청록색 UI 대비를 유지한다.
    addSceneBackground(this, BACKGROUND.lab);
    this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void, 0.34).setDepth(-29);
    this.add.rectangle(cx, BANNER_FLOOR, BASE_WIDTH, 3, COLOR.panelEdge).setDepth(-28);

    this.topBar = new TopBar(this);

    this.bannerName = this.add.text(cx, 170, "", textStyle({ size: 44 })).setOrigin(0.5, 0);
    this.bannerDesc = this.add
      .text(cx, 228, "", textStyle({ size: 26, color: COLOR.inkDim, align: "center", wrap: BASE_WIDTH - 120 }))
      .setOrigin(0.5, 0);

    this.pickupText = this.add.text(cx, 310, "", textStyle({ size: 28, color: COLOR.accentText })).setOrigin(0.5, 0);
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
      label: "1회 발굴",
      sub: "",
      fontSize: 36,
      onClick: () => this.doPull(1),
    });
    this.tenButton = new Button(this, 780, NAV_TOP - 250, {
      width: 440,
      height: 150,
      label: "10회 발굴",
      sub: "",
      fontSize: 36,
      onClick: () => this.doPull(10),
    });

    this.pityText = this.add.text(cx, NAV_TOP - 355, "", textStyle({ size: 28, color: COLOR.accentText })).setOrigin(0.5);

    this.add
      .text(
        cx,
        NAV_TOP - 130,
        "화석은 흔한 재화, 호박석은 귀한 재화다.",
        textStyle({ size: 24, color: COLOR.inkDim }),
      )
      .setOrigin(0.5, 0);

    new BottomNav(this, "lab");
    // 씬을 떠난 뒤 끝나는 비동기 로딩도 무효화하고 현재 Puppet을 정리한다.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.showcaseRequest += 1;
      this.showcase?.destroy();
      this.showcase = undefined;
      this.presentation.invalidate();
      this.finishStage?.();
      this.presentationLayer?.destroy(true);
      this.presentationLayer = undefined;
    });
    void this.showcaseRelic();
    this.refresh();
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
      tint: portraitUsesRelicTint(featured.portraitAssetId)
        ? mixWhite(tintFor(featured.id), 0.55)
        : undefined,
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
      .text(BASE_WIDTH / 2, NAV_TOP - 390, message, textStyle({ size: 28, color: COLOR.accentText }))
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
    const panel = this.add.rectangle(cx, 800, 820, 720, COLOR.panel).setStrokeStyle(3, COLOR.panelEdge);
    overlay.add([shade, panel]);
    overlay.add(this.add.text(cx, 510, "발굴 확률", textStyle({ size: 44 })).setOrigin(0.5));
    const rates = (["SSR", "SR", "R"] as const)
      .map((rarity) => `${rarity}  ${(banner.rarityRates[rarity] * 100).toFixed(1)}%`)
      .join("\n");
    overlay.add(this.add.text(cx, 610, rates, textStyle({ size: 34, align: "center", lineSpacing: 24 })).setOrigin(0.5, 0));
    overlay.add(this.add.text(cx, 870, `등급 내 픽업 확률 ${(banner.pickupRate * 100).toFixed(0)}%\n10연 마지막 슬롯 SR 이상 보장`, textStyle({ size: 27, color: COLOR.inkDim, align: "center", lineSpacing: 14 })).setOrigin(0.5, 0));
    const close = new Button(this, cx, 1080, { width: 320, height: 100, label: "확인", fontSize: 32, onClick: () => overlay.destroy() });
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

  /** 서버 확정 등급을 복권처럼 암시한 뒤 균열→첫 대면→카드 순서로 재생한다. */
  private async playPresentation(results: AcquisitionResult[]): Promise<void> {
    const request = this.presentation.begin();
    const rarity = highestRarity(results.map((result) => getRelic(result.relicId).rarity));
    const meetings = firstMeetingRelicIds(results);
    this.presentationLayer?.destroy(true);
    const layer = this.add.container(0, 0).setDepth(900);
    this.presentationLayer = layer;
    const shade = this.add.rectangle(BASE_WIDTH / 2, 960, BASE_WIDTH, 1920, COLOR.void, 0.97).setInteractive();
    layer.add(shade);
    // 단계 콘텐츠만 교체해 고정 입력면과 건너뛰기 버튼을 실수로 파괴하지 않는다.
    const content = this.add.container(0, 0);
    layer.add(content);
    shade.on("pointerup", () => this.finishStage?.());
    const skip = new Button(this, BASE_WIDTH - 150, 100, { width: 230, height: 70, label: "전체 건너뛰기", fontSize: 22, onClick: () => {
      this.presentation.skipAll();
      this.finishStage?.();
    } });
    layer.add(skip);

    content.add(this.add.text(BASE_WIDTH / 2, 660, "화석층 탐사 중", textStyle({ size: 48, color: COLOR.inkDim })).setOrigin(0.5));
    await this.waitForStage(650, request);
    if (!this.presentation.isCurrent(request)) return;
    if (!this.presentation.wasSkipped) this.presentation.advance();

    if (!this.presentation.wasSkipped) {
      content.removeAll(true);
      this.drawCrack(content, rarity);
      this.cameras.main.shake(rarity === "SSR" ? 420 : 260, rarity === "SSR" ? 0.012 : 0.006);
      // 오디오가 준비되면 씬 외부에서 이 훅을 받아 실제 파일을 재생한다.
      this.events.emit("excavation-sound", "crack", rarity);
      await this.waitForStage(700, request);
      this.presentation.advance();
    }
    if (!this.presentation.isCurrent(request)) return;

    if (!this.presentation.wasSkipped) {
      this.showRarityFlash(content, rarity);
      await this.waitForStage(650, request);
      this.presentation.advance();
    }

    for (const relicId of meetings) {
      if (!this.presentation.isCurrent(request) || this.presentation.wasSkipped) break;
      await this.showFirstMeeting(content, relicId, request);
    }
    if (!this.presentation.wasSkipped) this.presentation.advance();
    if (this.presentation.isCurrent(request)) {
      skip.destroy();
      this.showResultCards(content, layer, results);
    }
  }

  /** 고비용 영상 대신 Graphics 선과 작은 원 파편 tween으로 균열을 만든다. */
  private drawCrack(layer: Phaser.GameObjects.Container, rarity: "R" | "SR" | "SSR"): void {
    const color = this.rarityColor(rarity);
    const graphics = this.add.graphics();
    graphics.lineStyle(rarity === "SSR" ? 10 : 6, color, 1);
    const branches = [[540, 450, 500, 690, 585, 850, 490, 1080], [540, 450, 650, 620, 620, 820], [500, 690, 350, 790, 300, 970]];
    for (const points of branches) graphics.strokePoints(points.reduce<Phaser.Math.Vector2[]>((all, value, index) => {
      if (index % 2 === 0) all.push(new Phaser.Math.Vector2(value, points[index + 1]));
      return all;
    }, []));
    layer.add(graphics);
    for (let index = 0; index < 12; index += 1) {
      const mote = this.add.circle(540, 720, 3 + (index % 4), color, 0.9);
      layer.add(mote);
      this.tweens.add({ targets: mote, x: 300 + ((index * 83) % 480), y: 500 + ((index * 137) % 620), alpha: 0, duration: 500 });
    }
  }

  /** 최고 등급 색만 미리 보여 주고 구체적인 카드 결과는 아직 숨긴다. */
  private showRarityFlash(layer: Phaser.GameObjects.Container, rarity: "R" | "SR" | "SSR"): void {
    layer.removeAll(true);
    const flash = this.add.rectangle(BASE_WIDTH / 2, 960, BASE_WIDTH, 1920, this.rarityColor(rarity), 0.18);
    layer.add(flash);
    // SR은 보라 외곽, SSR은 밝은 호박 외곽을 더해 단색 R과 실루엣만으로도 구분한다.
    if (rarity !== "R") layer.add(this.add.rectangle(BASE_WIDTH / 2, 960, 920, 1240)
      .setStrokeStyle(10, rarity === "SR" ? COLOR.raritySRAlt : COLOR.raritySSRLight, 0.85));
    layer.add(this.add.text(BASE_WIDTH / 2, 800, rarity === "SSR" ? "호박빛 공명이 폭발한다" : rarity === "SR" ? "청록과 보랏빛이 교차한다" : "회청색 파장이 감지된다", textStyle({ size: 42, align: "center", wrap: 820 })).setOrigin(0.5));
    this.tweens.add({ targets: flash, alpha: 0.55, duration: 180, yoyo: true, repeat: 1 });
  }

  private rarityColor(rarity: "R" | "SR" | "SSR"): number {
    return rarity === "SSR" ? COLOR.raritySSR : rarity === "SR" ? COLOR.raritySR : COLOR.rarityR;
  }

  /** 신규 Puppet 로딩 실패도 연출을 멈추지 않고 이름과 대사 텍스트로 대체한다. */
  private async showFirstMeeting(layer: Phaser.GameObjects.Container, relicId: string, request: number): Promise<void> {
    layer.removeAll(true);
    const def = getRelic(relicId);
    let standing: PuppetCreature | undefined;
    try {
      standing = await spawnPuppet(this, portraitAssetFor(def.portraitAssetId), { x: BASE_WIDTH / 2, groundY: 1260, height: 900, tint: portraitUsesRelicTint(def.portraitAssetId) ? mixWhite(tintFor(def.id), 0.55) : undefined, depth: 905 });
    } catch {
      // 부트 캐시나 WebGL 복제가 실패해도 첫 대면 정보는 텍스트로 온전히 전달한다.
      layer.add(this.add.text(BASE_WIDTH / 2, 650, `[${def.name} 스탠딩을 불러오지 못했습니다]`, textStyle({ size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    }
    if (!this.presentation.isCurrent(request)) { standing?.destroy(); return; }
    layer.add(this.add.rectangle(BASE_WIDTH / 2, 1470, 900, 250, COLOR.panel, 0.96).setStrokeStyle(3, this.rarityColor(def.rarity)));
    layer.add(this.add.text(140, 1380, `${def.name} · ${def.rarity}`, textStyle({ size: 32, color: COLOR.accentText })).setOrigin(0, 0.5));
    layer.add(this.add.text(BASE_WIDTH / 2, 1500, firstMeetingLine(relicId), textStyle({ size: 30, wrap: 780, align: "center" })).setOrigin(0.5));
    await this.waitForStage(1200, request);
    standing?.destroy();
  }

  /** 한 장과 10연 모두 같은 프로필 카드 그리드로 신규/DNA 결과를 읽게 한다. */
  private showResultCards(content: Phaser.GameObjects.Container, layer: Phaser.GameObjects.Container, results: AcquisitionResult[]): void {
    const cx = BASE_WIDTH / 2;
    content.removeAll(true);
    content.add(this.add.text(cx, 210, "발굴 결과", textStyle({ size: 52 })).setOrigin(0.5));

    results.forEach((result, index) => {
      const def = getRelic(result.relicId);
      const badge = result.kind === "new"
        ? "신규"
        : result.kind === "mastery"
          ? `DNA ${result.dnaBefore}→${result.dnaAfter}`
          : `DNA 조각 +${result.overflowFragments}`;
      const columns = results.length === 1 ? 1 : 2;
      const card = new PortraitCard(this, columns === 1 ? cx : 285 + (index % 2) * 510, results.length === 1 ? 850 : 390 + Math.floor(index / 2) * 230, {
        width: results.length === 1 ? 520 : 440, height: results.length === 1 ? 720 : 210,
        portraitAssetId: def.portraitAssetId, tint: portraitUsesRelicTint(def.portraitAssetId) ? mixWhite(tintFor(def.id), 0.55) : undefined,
        label: def.name, sub: badge, badge: def.rarity,
      });
      card.setDepth(902);
      content.add(card);
      // 등급 테두리는 기존 금속 패널을 유지하면서 보조 토큰만 더한다.
      card.setSelected(true, this.rarityColor(def.rarity));
    });

    const close = new Button(this, cx, NAV_TOP - 200, {
      width: 400,
      height: 120,
      label: "확인",
      fontSize: 36,
      onClick: () => { layer.destroy(true); this.presentationLayer = undefined; },
    });
    content.add(close);
  }

  private refresh(): void {
    const banner = this.banner;
    this.bannerName.setText(banner.name);
    this.bannerDesc.setText(banner.desc);
    const pickupNames = Object.values(banner.pickupRelicIds).flat().map((id) => getRelic(id).name);
    this.pickupText.setText(`PICK UP  ${pickupNames.join(" · ")}`);
    const currentPity = session.pullCountSinceHighestRarity[banner.id] ?? 0;
    this.pityText.setText(`SSR 확정까지 ${Math.max(0, banner.highestRarityGuarantee - currentPity)}회`);

    const unit = banner.currency === "fossil" ? "화석" : "호박석";
    this.oneButton
      .setSub(`${unit} ${pullCost(banner, 1)}`)
      .setEnabled(!this.pullPending && canPull(session.wallet, banner, 1));
    this.tenButton
      .setSub(`${unit} ${pullCost(banner, 10)}`)
      .setEnabled(!this.pullPending && canPull(session.wallet, banner, 10));
  }
}
