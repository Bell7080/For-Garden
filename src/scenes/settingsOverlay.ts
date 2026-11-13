import Phaser from "phaser";
import { setDebugScene } from "../debug";
import { settingsManager } from "../managers/SettingsManager";
import { restartScene } from "../ui/screenTransition";
import { EffectOverlayScene } from "./EffectOverlayScene";
import type { SettingsOverlayHost } from "./settingsNavigation";

/**
 * 상단 줄의 설정 아이콘이 여는 설정을 그 화면 **위에 겹쳐** 연다. 편성·지도·던전 입구·레이드처럼 진입 데이터
 * (고른 단계·편성·판 ID)를 들고 선 화면은 설정 씬으로 넘어가면 돌아올 자리를 다시 세울 수 없어, 그 씬은
 * 잠들어 기다리고 설정이 닫히며 다시 깨운다(`SettingsScene.close`). 전투는 시계를 미는 제 길이 따로 있다.
 *
 * 언어·글자 크기는 그린 순간의 글자를 굳히므로, 그 둘이 바뀌어 돌아오면 그 화면을 같은 진입 데이터로 다시 세운다.
 */
export function openSettingsOver(scene: Phaser.Scene, host: Exclude<SettingsOverlayHost, "battle">): void {
  scene.scene.launch("settings", { overlayOf: host });
  scene.scene.bringToTop("settings");
  // 누른 자리 파문은 어느 화면에서나 맨 위다 — 설정을 올린 뒤 그 층을 다시 맨 위로 올린다.
  scene.scene.bringToTop(EffectOverlayScene.KEY);
  const look = () => { const s = settingsManager.get(); return `${s.game.language}|${s.accessibility.textScale}`; };
  const before = look();
  const onWake = () => {
    setDebugScene(host);
    if (look() !== before) restartScene(scene, scene.sys.settings.data as object | undefined);
  };
  scene.events.once(Phaser.Scenes.Events.WAKE, onWake);
  // 설정이 부트로 나가며 이 씬을 멈추면 깨어날 일이 없다 — 걸어 둔 리스너가 다음 잠듦까지 남지 않게 걷는다.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.WAKE, onWake));
  scene.scene.sleep();
}
