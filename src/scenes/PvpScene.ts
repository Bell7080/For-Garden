import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { PVP_MODES } from "../data/pvpModes";
import { setDebugScene } from "../debug";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { drawLayer, HOLO, slantedRect } from "../ui/holo";
import { pvpGridCell, PVP_GRID, PVP_RETURN_SCENE } from "../ui/pvpLayout";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";

/** PvP 모드를 고르는 화면이며 실제 매칭이나 전투 상태는 만들지 않고 상세 기획 화면으로만 연결한다. */
export class PvpScene extends Phaser.Scene {
  constructor() {
    super("pvp");
  }

  create(): void {
    setDebugScene("pvp", "결투 작전");
    addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.58).setDepth(-20);
    new TopBar(this, 40, { currencies: "none", profile: false });

    this.add.text(60, 190, "결 투  작 전", textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    // 네 버튼 뒤의 한 장짜리 반투명 판은 영역을 묶되, 사방 테두리 대신 윗변 강조선만 가진다.
    const panelWidth = PVP_GRID.cellSize * 2 + PVP_GRID.gapX + 74;
    const panelHeight = PVP_GRID.cellSize * 2 + PVP_GRID.gapY + 74;
    drawLayer(this, PVP_GRID.centerX, PVP_GRID.centerY, slantedRect(panelWidth, panelHeight), {
      fill: 0x101821, alpha: HOLO.glassLight, edge: COLOR.accent, edgeAlpha: 0.42,
    });

    PVP_MODES.forEach((mode, index) => {
      const cell = pvpGridCell(index);
      // Button의 공용 pointer 처리는 손떨림과 드래그를 가르고, 눌림 확대 후 식별자만 상세 씬에 넘긴다.
      new Button(this, cell.x, cell.y, {
        width: cell.width,
        height: cell.height,
        label: mode.label,
        fontSize: 43,
        variant: index === 0 ? "primary" : "default",
        accentColor: COLOR.sortie,
        accentTextColor: COLOR.sortieText,
        onClick: () => this.scene.start("pvpPreview", { mode: mode.id }),
      });
    });

    // 선택 화면의 이탈은 공용 우하단 입력으로만 로비에 돌아간다.
    addBackButton(this, () => this.scene.start(PVP_RETURN_SCENE.selection));
  }
}
