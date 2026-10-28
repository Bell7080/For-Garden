import Phaser from "phaser";
import { debugSceneName, setDebugReady, setDebugScene } from "../debug";
import { EffectOverlayScene } from "./EffectOverlayScene";

/**
 * 이야기를 지금 화면 **위에 겹쳐** 연다 — 정보창의 애착 스토리처럼 판을 연 채 읽고 돌아와야 하는 자리.
 *
 * 이야기 씬으로 넘어가 버리면 정보창·유대 판이 통째로 사라져 끝난 뒤 로비로 튕겼다. 그래서 연 씬은
 * 잠들고(판·스크롤·원화가 그대로 멈춘다) 이야기가 끝나면 다시 깨어나 `onReturn`을 부른다 — 전투 중
 * 설정을 겹치는 것과 같은 길이다(`BattleScene.openSettingsOverlay`). 이야기 씬은 `overlayOf`로 누구를
 * 깨울지 안다.
 */
export function launchStoryOverlay(host: Phaser.Scene, storyId: string, onReturn: () => void): void {
  const debugScene = debugSceneName();
  const onWake = (): void => {
    host.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    if (debugScene) setDebugScene(debugScene);
    setDebugReady(true);
    onReturn();
  };
  // 잠든 사이 연 씬이 걷히면(계정 전환 등) 깨어날 일이 없으므로 기다림도 함께 걷는다.
  const onShutdown = (): void => { host.events.off(Phaser.Scenes.Events.WAKE, onWake); };
  host.events.once(Phaser.Scenes.Events.WAKE, onWake);
  host.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  host.scene.launch("stageStory", { storyId, overlayOf: host.scene.key });
  host.scene.bringToTop("stageStory");
  // 누른 자리 파문은 어느 화면에서나 맨 위다 — 이야기를 올린 뒤 그 층을 다시 맨 위로 올린다.
  host.scene.bringToTop(EffectOverlayScene.KEY);
  host.scene.sleep();
}
