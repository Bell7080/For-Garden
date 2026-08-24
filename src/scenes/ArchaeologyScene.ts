import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { BottomNav } from "../ui/BottomNav";
import { chipPoints, drawLayer, drawVignette, HOLO } from "../ui/holo";
import { TopBar } from "../ui/TopBar";
import { COLOR, textStyle } from "../ui/theme";

/**
 * 고고학. 하단 탭 첫 슬롯이다.
 *
 * 배너 모집(연구소)과도, 로비의 발굴 입구와도 상태를 나누지 않는다. 여기서 하는 일은 오래
 * 파고드는 탐사 — 에너지와 희귀 자원을 시간으로 바꾸는 쪽이다.
 */
export class ArchaeologyScene extends Phaser.Scene {
  constructor() {
    super("archaeology");
  }

  create(): void {
    setDebugScene("archaeology");
    // 야외 유적 원화와 기존 홀로그램 토큰을 조합해 연구소 내부와 공간의 성격을 구분한다.
    addSceneBackground(this, BACKGROUND.archaeology);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20, strength: 0.72 });
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.5).setDepth(-19);
    new TopBar(this);

    this.add.text(60, 185, "고 고 학", textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    this.add.text(62, 252, "장기 탐사 · 에너지 · 희귀 자원", textStyle({ role: "body", size: 27, color: COLOR.inkDim })).setOrigin(0, 0);

    const panel = this.add.container(BASE_WIDTH / 2, 850);
    panel.add(drawLayer(this, 0, 0, chipPoints(880, 510, { bevel: { topLeft: 62, topRight: 0, bottomRight: 44, bottomLeft: 0 } }), {
      fill: 0x111b24, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.62,
    }));
    panel.add(this.add.text(0, -110, "미확인 탐사 구역", textStyle({ role: "display", size: 40, color: COLOR.accentText })).setOrigin(0.5));
    panel.add(this.add.text(0, 0, "장기 탐사로 추가 에너지와 다양한 재화,\n아이템 및 강화 재료를 회수할 구역입니다.", textStyle({ role: "body", size: 29, color: COLOR.inkDim, align: "center" })).setOrigin(0.5));
    panel.add(this.add.text(0, 145, "탐사 체계 준비 중", textStyle({ role: "emphasis", size: 27, color: COLOR.ink })).setOrigin(0.5));

    // 고고학은 렐릭 왼쪽 첫 슬롯이며 기존 연구소의 모집 기능과 상태를 공유하지 않는다.
    new BottomNav(this, "archaeology");
  }
}
