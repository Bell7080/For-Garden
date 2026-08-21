import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugProgress } from "../debug";
import { session } from "../state/session";
import { drawGlassFade, drawHairline } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 화면 위쪽의 재화 표시. 렐릭 · 로비 · 연구소 어디서든 같은 자리에 같은 모양으로 뜬다.
 * 뽑기로 재화가 줄면 `refresh`로 다시 그린다.
 */
export class TopBar {
  private readonly fossilText: Phaser.GameObjects.Text;
  private readonly amberText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, y = 40) {
    // 판때기 대신 위에서 아래로 옅어지는 유리면. 배경 원화가 끊기지 않게 한다.
    drawGlassFade(scene, BASE_WIDTH / 2, y + 30, BASE_WIDTH, 140, { topAlpha: 0.92, bottomAlpha: 0 });
    drawHairline(scene, BASE_WIDTH / 2, y + 88, BASE_WIDTH, { color: COLOR.accent, alpha: 0.18 });

    scene.add
      .text(32, y + 30, "연구원", textStyle({ role: "body", size: 26, color: COLOR.inkDim }))
      .setOrigin(0, 0);

    // 화석 — 흔한 재화.
    scene.add.circle(BASE_WIDTH - 470, y + 44, 16, 0x8a8071);
    this.fossilText = scene.add
      .text(BASE_WIDTH - 440, y + 28, "", textStyle({ role: "emphasis", size: 28 }))
      .setOrigin(0, 0);

    // 호박석 — 귀한 재화.
    scene.add.star(BASE_WIDTH - 190, y + 44, 6, 8, 18, COLOR.accent);
    this.amberText = scene.add
      .text(BASE_WIDTH - 160, y + 28, "", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText }))
      .setOrigin(0, 0);

    this.refresh();
  }

  refresh(): void {
    this.fossilText.setText(`${session.wallet.fossil}`);
    this.amberText.setText(`${session.wallet.amber}`);
    setDebugProgress(session.wallet, session.owned);
  }
}
