import Phaser from "phaser";
import { setDebugScene } from "../debug";
import { preloadPuppetAssets } from "../puppets/assets";
import { BACKGROUND_ASSETS } from "../ui/backgrounds";
import { UI_ICON_ASSETS } from "../ui/icons";
import { SKILL_ICON_ASSETS } from "../ui/skillIcons";
import { defaultSessionAfterReset, saveManager } from "../state/SaveManager";
import { replaceSession } from "../state/session";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    // 전환 직후 빈 화면이 보이지 않도록 네 화면의 공용 배경을 부트 단계에서 선로딩한다.
    BACKGROUND_ASSETS.forEach(([key, path]) => this.load.image(key, path));
    // 캐릭터별 임시 복사본 대신 전 효과가 함께 쓰는 공용 아이콘 묶음만 선로딩한다.
    SKILL_ICON_ASSETS.forEach(([key, path]) => this.load.image(key, path));
    // 조작 아이콘은 확대해도 또렷하도록 지정한 크기로 래스터화한다.
    UI_ICON_ASSETS.forEach(([key, path, size]) => this.load.svg(key, path, { width: size, height: size }));
  }

  async create(): Promise<void> {
    setDebugScene("boot");
    try {
      const loaded = saveManager.load();
      if (loaded) replaceSession(loaded);
    } catch {
      // 손상된 로컬 데이터가 전체 앱을 막지 않게 제거하고 계정 연동 전 기본 상태로 복구한다.
      saveManager.reset();
      replaceSession(defaultSessionAfterReset());
      this.registry.set("saveRecoveryNotice", "저장 데이터를 확인할 수 없어 안전한 초기 상태로 복구했습니다.");
    }
    // 첫 캐릭터가 나타나는 순간 ZIP 파싱으로 프레임이 멎지 않도록 공용 묶음을 미리 읽는다.
    // 아트 파일 하나가 손상되어도 UI와 전투 규칙까지 막지 않고 기존의 비동기 폴백으로 진행한다.
    await preloadPuppetAssets().catch(() => undefined);
    // 비동기 로딩 중 씬이 종료된 경우 다음 씬을 중복 시작하지 않는다.
    if (!this.scene.isActive()) return;
    this.scene.start("title");
  }
}
