import type Phaser from "phaser";

/** Full-screen overlay input is independent of any portrait/content geometry mask. */
export function addScreenInputBlocker(scene: Phaser.Scene, width: number, height: number, depth: number): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0).setDepth(depth).setVisible(false).setInteractive();
}
