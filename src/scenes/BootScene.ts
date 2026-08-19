import Phaser from "phaser";
import { setDebugScene } from "../debug";
import { preloadPuppetAssets } from "../puppets/assets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  async create(): Promise<void> {
    setDebugScene("boot");
    // 첫 캐릭터가 나타나는 순간 ZIP 파싱으로 프레임이 멎지 않도록 공용 묶음을 미리 읽는다.
    // 아트 파일 하나가 손상되어도 UI와 전투 규칙까지 막지 않고 기존의 비동기 폴백으로 진행한다.
    await preloadPuppetAssets().catch(() => undefined);
    // 비동기 로딩 중 씬이 종료된 경우 다음 씬을 중복 시작하지 않는다.
    if (!this.scene.isActive()) return;
    this.scene.start("title");
  }
}
