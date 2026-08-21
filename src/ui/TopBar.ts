import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugProgress } from "../debug";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, HOLO } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 화면 위쪽 줄. 렐릭 · 로비 · 연구소 어디서든 같은 자리에 같은 모양으로 뜬다.
 *
 * 왼쪽은 플레이어 자신(프로필), 오른쪽은 가진 것(재화)과 설정이다. 판때기를 깔지 않고
 * 위에서 아래로 옅어지는 유리면만 둬서 배경 원화가 끊기지 않게 한다.
 */
export class TopBar {
  private readonly fossilText: Phaser.GameObjects.Text;
  private readonly amberText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, y = 40, options: { onSettings?: () => void } = {}) {
    drawGlassFade(scene, BASE_WIDTH / 2, y + 30, BASE_WIDTH, 150, { topAlpha: 0.92, bottomAlpha: 0 });
    drawHairline(scene, BASE_WIDTH / 2, y + 96, BASE_WIDTH, { color: COLOR.accent, alpha: 0.18 });

    this.buildProfile(scene, 28, y + 4);

    // 화석 — 흔한 재화.
    scene.add.circle(BASE_WIDTH - 470, y + 44, 16, 0x8a8071);
    this.fossilText = scene.add
      .text(BASE_WIDTH - 440, y + 28, "", textStyle({ role: "emphasis", size: 28 }))
      .setOrigin(0, 0);

    // 호박석 — 귀한 재화.
    scene.add.star(BASE_WIDTH - 250, y + 44, 4, 7, 17, COLOR.accent);
    this.amberText = scene.add
      .text(BASE_WIDTH - 224, y + 28, "", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText }))
      .setOrigin(0, 0);

    // 설정 — 오른쪽 끝. 재화보다 뒤에 두어 손이 먼저 닿지 않게 한다.
    const settings = scene.add.container(BASE_WIDTH - 70, y + 44);
    settings.add(drawGlyph(scene, "settings", 0, 0, 44, 0xc9ccd2));
    const hit = scene.add.rectangle(BASE_WIDTH - 70, y + 44, 84, 84, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => settings.setScale(1.12));
    hit.on("pointerout", () => settings.setScale(1));
    hit.on("pointerup", () => {
      settings.setScale(1);
      options.onSettings?.();
    });

    this.refresh();
  }

  /** 왼쪽 위 플레이어 칩. 아직 아바타 아트가 없어 이름 머리글자를 넣는다. */
  private buildProfile(scene: Phaser.Scene, x: number, y: number): void {
    const size = 84;
    drawLayer(scene, x + size / 2, y + size / 2, chipPoints(size, size, {
      bevel: { topLeft: size * 0.3, topRight: 0, bottomRight: size * 0.3, bottomLeft: 0 },
    }), { fill: 0x1f2632, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55 });
    scene.add.text(x + size / 2, y + size / 2, "R", textStyle({ role: "display", size: 40, color: COLOR.accentText })).setOrigin(0.5);
    scene.add.text(x + size + 16, y + 14, "연구원", textStyle({ role: "emphasis", size: 26 })).setOrigin(0, 0);
    scene.add
      .text(x + size + 16, y + 48, "LV.1  이터널 시티", textStyle({ role: "body", size: 20, color: COLOR.inkDim }))
      .setOrigin(0, 0);
  }

  refresh(): void {
    this.fossilText.setText(`${session.wallet.fossil}`);
    this.amberText.setText(`${session.wallet.amber}`);
    setDebugProgress(session.wallet, session.owned);
  }
}
