import Phaser from "phaser";
import { setDebugScene } from "../debug";
import { defaultSessionAfterReset, saveManager } from "../state/SaveManager";
import { replaceSession } from "../state/session";
import { relicProgression } from "../managers/RelicProgressionManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
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
    // 임시 지급: 가방이 비어 있으면 세공을 만져 볼 시작 룬을 넣어 준다. 정식 획득 경로가
    // 생기면 이 한 줄과 매니저의 `grantStarterRunes`를 함께 지운다.
    relicProgression.grantStarterRunes();
    // 글꼴·원화·Puppet 묶음은 타이틀이 로딩 화면 노릇을 하며 읽는다(scenes/loadingSteps.ts).
    // 부트는 저장 로드와 복구만 조율하고 곧바로 넘긴다.
    this.scene.start("title");
  }
}
