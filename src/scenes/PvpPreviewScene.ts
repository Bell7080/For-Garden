import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { getPvpMode, type PvpModeId } from "../data/pvpModes";
import { setDebugScene } from "../debug";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addBackButton } from "../ui/IconButton";
import { drawLayer, HOLO, slantedRect } from "../ui/holo";
import { PVP_RETURN_SCENE } from "../ui/pvpLayout";
import { COLOR, textStyle } from "../ui/theme";
import { TopBar } from "../ui/TopBar";

/** 선택 씬이 전달하는 유일한 입력이며 전투·보상·저장 데이터는 의도적으로 받지 않는다. */
export interface PvpPreviewData { mode: PvpModeId }

/** 세계관 내 모드 제목과 확정된 기획 범위만 보여 주는 공용 PvP 상세 화면이다. */
export class PvpPreviewScene extends Phaser.Scene {
  constructor() {
    super("pvpPreview");
  }

  create(data: PvpPreviewData): void {
    // 직접 진입이나 잘못된 값은 순수 데이터 조회에서 결투장으로 수렴하며 진행 상태를 생성하지 않는다.
    const mode = getPvpMode(data?.mode);
    setDebugScene("pvpPreview", mode.title);
    addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.64).setDepth(-20);
    new TopBar(this, 40, { currencies: "none", profile: false });

    this.add.text(60, 210, mode.title, textStyle({ role: "display", size: 58, color: COLOR.accentText })).setOrigin(0, 0);
    // 단색 유리판과 윗변 한 줄만 사용해 구현 상태 문구 없이 전투 범위에 시선을 모은다.
    drawLayer(this, BASE_WIDTH / 2, 760, slantedRect(880, 390), {
      fill: 0x101821, alpha: HOLO.glass, edge: COLOR.sortie, edgeAlpha: 0.72,
    });
    this.add.text(BASE_WIDTH / 2, 760, mode.scope, textStyle({ role: "emphasis", size: 34, color: COLOR.ink, align: "center" })).setOrigin(0.5);

    // 상세 화면의 유일한 이탈 입력은 PvP 선택 화면으로 되돌아가는 공용 뒤로가기다.
    addBackButton(this, () => this.scene.start(PVP_RETURN_SCENE.preview));
  }
}
