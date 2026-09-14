import type Phaser from "phaser";

/**
 * 씬에 넘긴 진입 데이터를 **한 번 쓰고 비운다.**
 *
 * Phaser는 데이터 없이 시작한 씬의 지난 데이터를 그대로 남긴다 —
 * `Systems.start(data)`가 `if (data) settings.data = data`라서, `scene.start("shop")`처럼
 * 빈손으로 부르면 **직전 진입의 값이 그대로 살아 있다.** 그래서 고고학 상점을 한 번 연 뒤
 * 로비에서 상점을 누르면 일반 상점이 아니라 고고학 상점이 떴고, 뒤로가기도 고고학으로
 * 돌아갔다(v0.128.1에서 고쳤다).
 *
 * 진입 데이터는 **그 한 번의 진입을 설명하는 값**이므로, 읽고 나면 비워 두는 것이 맞다.
 * 자리를 넘기지 않고 들어온 사람은 언제나 그 씬의 기본 자리에 선다.
 *
 * `init`의 **맨 끝**에서 부른다 — 먼저 부르면 자기가 받은 값을 지우게 된다. `create`도 같은
 * `settings.data`를 인자로 받으므로, 인자를 읽는 `create`가 있는 씬에는 쓰지 않는다.
 */
export function consumeSceneEntry(scene: Phaser.Scene): void {
  scene.scene.settings.data = {};
}
