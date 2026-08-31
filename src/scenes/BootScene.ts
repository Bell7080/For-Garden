import Phaser from "phaser";
import { setDebugScene } from "../debug";
import { defaultSessionAfterReset, saveManager } from "../state/SaveManager";
import { replaceSession, session } from "../state/session";
import { relicProgression } from "../managers/RelicProgressionManager";
import { setTextScale } from "../ui/textScale";
import { EffectOverlayScene } from "./EffectOverlayScene";

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
    // 저장에서 복원한 접근성 배율을 어떤 씬도 생성되기 전에 공용 텍스트 계층에 반영한다.
    setTextScale(session.settings.accessibility.textScale);
    // 글꼴·원화·Puppet 묶음은 타이틀이 로딩 화면 노릇을 하며 읽는다(scenes/loadingSteps.ts).
    // 부트는 저장 로드와 복구만 조율하고 곧바로 넘긴다.
    // 누른 자리에 답하는 겹은 씬 전환과 무관하게 계속 떠 있어야 하므로 start가 아니라 launch다.
    this.scene.launch(EffectOverlayScene.KEY);
    this.scene.start("title");
  }
}
