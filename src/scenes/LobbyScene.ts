import Phaser from "phaser";
import type { PuppetCreature } from "puppetforge/phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { getRelic } from "../data/relics";
import { CHAR_ASSET, spawnPuppet } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { TopBar } from "../ui/TopBar";
import { COLOR, textStyle } from "../ui/theme";

/** 애착 렐릭이 서는 광장 바닥. */
const STAGE_FLOOR = 1360;

/**
 * 로비 — 메인 화면.
 *
 * 연구소 광장에 애착 렐릭이 서 있고, 그 위에 출격과 상점 같은 버튼이 얹힌다.
 * 앞으로 상점 · 프로필 · 우편 같은 것들이 붙을 자리라 버튼 자리를 미리 잡아 두었다.
 */
export class LobbyScene extends Phaser.Scene {
  private favorite?: PuppetCreature;

  constructor() {
    super("lobby");
  }

  create(): void {
    setDebugScene("lobby");

    this.buildPlaza();
    new TopBar(this);

    // 좌측 세로 버튼 줄 — 앞으로 늘어날 BM · 편의 기능 자리.
    const sideLabels = ["상점", "우편", "프로필"];
    sideLabels.forEach((label, i) => {
      new Button(this, 150, 320 + i * 150, {
        width: 220,
        height: 110,
        label,
        fontSize: 30,
        onClick: () => this.notReady(label),
      });
    });

    // 출격 — 로비에서 가장 큰 버튼이다.
    new Button(this, BASE_WIDTH - 300, NAV_TOP - 140, {
      width: 500,
      height: 160,
      label: "출  격",
      sub: "SORTIE",
      fontSize: 48,
      onClick: () => this.scene.start("stageMap"),
    });

    new BottomNav(this, "lobby");
    void this.showFavorite();
  }

  /** 배경. 아직 그림이 없어 지평선과 바닥만 색으로 나눠 광장처럼 보이게 한다. */
  private buildPlaza(): void {
    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-30);
    this.add.rectangle(cx, (STAGE_FLOOR + NAV_TOP) / 2, BASE_WIDTH, NAV_TOP - STAGE_FLOOR, 0x20242a).setDepth(-29);
    this.add.rectangle(cx, STAGE_FLOOR, BASE_WIDTH, 3, COLOR.panelEdge).setDepth(-28);

    this.add
      .text(cx, 200, "이터널 시티 · 중앙 광장", textStyle({ size: 30, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);
  }

  /** 애착 렐릭을 광장 한가운데 세운다. 그림이 아직 하나뿐이라 색으로만 구분한다. */
  private async showFavorite(): Promise<void> {
    const def = getRelic(session.favorite);
    this.favorite = await spawnPuppet(this, CHAR_ASSET, {
      x: BASE_WIDTH / 2 + 60,
      groundY: STAGE_FLOOR,
      height: 900,
      tint: mixWhite(tintFor(def.id), 0.55),
      depth: -20,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.favorite?.destroy());

    this.add
      .text(BASE_WIDTH / 2, STAGE_FLOOR + 24, def.name, textStyle({ size: 34 }))
      .setOrigin(0.5, 0);
    this.add
      .text(BASE_WIDTH / 2, STAGE_FLOOR + 70, def.origin, textStyle({ size: 24, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);
  }

  private notReady(label: string): void {
    const toast = this.add
      .text(BASE_WIDTH / 2, NAV_TOP - 300, `${label} — 준비 중`, textStyle({ size: 30, color: COLOR.accentText }))
      .setOrigin(0.5)
      .setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, duration: 1200, onComplete: () => toast.destroy() });
  }
}
