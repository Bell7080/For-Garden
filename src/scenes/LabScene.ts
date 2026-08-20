import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { gameApi } from "../api/FakeServer";
import { GameApiError } from "../api/contracts";
import { canPull, pullCost, type AcquisitionResult, type Banner } from "../core/gacha";
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
      this.showResult(response.results);
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

  /** 뽑은 결과를 한 장에 보여 준다. */
  private showResult(results: AcquisitionResult[]): void {
    const cx = BASE_WIDTH / 2;
    const overlay = this.add.container(0, 0).setDepth(800);

    const shade = this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void, 0.96).setInteractive();
    overlay.add(shade);
    overlay.add(this.add.text(cx, 320, "발굴 결과", textStyle({ size: 52 })).setOrigin(0.5));

    results.forEach((result, index) => {
      const def = getRelic(result.relicId);
      const y = 430 + index * 92;
      // 기존 청록 계열 ally 패널과 금색 강조 글자로 슬롯별 보상을 빠르게 구분한다.
      const row = this.add.rectangle(cx, y, 820, 72, COLOR.panel).setStrokeStyle(2, COLOR.ally);
      const badge = result.kind === "new"
        ? "신규"
        : result.kind === "mastery"
          ? `DNA ${result.dnaBefore}→${result.dnaAfter}`
          : `DNA 조각 +${result.overflowFragments}`;
      overlay.add([
        row,
        this.add.text(cx - 380, y, `${def.name} — ${def.origin}`, textStyle({ size: 27 })).setOrigin(0, 0.5),
        this.add.text(cx + 380, y, badge, textStyle({ size: 25, color: COLOR.accentText })).setOrigin(1, 0.5),
      ]);
    });

    const close = new Button(this, cx, NAV_TOP - 200, {
      width: 400,
      height: 120,
      label: "확인",
      fontSize: 36,
      onClick: () => overlay.destroy(),
    });
    overlay.add(close);
    shade.on("pointerdown", () => overlay.destroy());
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
