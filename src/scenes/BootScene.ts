import Phaser from "phaser";
import { setDebugScene } from "../debug";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    setDebugScene("boot");
    this.scene.start("title");
  }
}
