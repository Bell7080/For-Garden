import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/** 영수증이 닫힌 직후 뒤 화면이 손을 받지 않는 시간. 실제 시간이라 배속·프레임과 무관하다. */
export const CLOSE_INPUT_GUARD_MS = 400;

/**
 * 영수증 팝업이 닫힌 직후의 연타가 뒤 화면을 누르지 않게 막는다.
 *
 * 보상을 받으려고 화면을 두드리던 손은 창이 닫힌 뒤에도 이어지므로, 닫히자마자 그 아래의 탭·버튼이
 * 눌려 다른 화면으로 넘어가곤 했다. 화면 전체를 덮는 보이지 않는 입력면을 잠깐 세워 그 누름을 삼킨다.
 * 해제는 씬 시계가 아니라 `setTimeout`이다 — 씬 타이머는 프레임이 돌아야 깨어나 바쁜 기기에서 늦는다.
 */
export function guardInputAfterClose(scene: Phaser.Scene, ms: number = CLOSE_INPUT_GUARD_MS): void {
  if (!scene.sys.isActive()) return;
  const shield = scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0)
    .setDepth(100000)
    .setInteractive();
  const release = () => { if (shield.active) shield.destroy(); };
  window.setTimeout(release, ms);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
}
