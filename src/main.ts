import Phaser from "phaser";
import "./style.css";
import { BASE_WIDTH, BASE_HEIGHT } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { ArchiveScene } from "./scenes/ArchiveScene";
import { StageMapScene } from "./scenes/StageMapScene";
import { PartyScene } from "./scenes/PartyScene";
import { BattleScene } from "./scenes/BattleScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#0b0b0d",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
  },
  scene: [BootScene, TitleScene, ArchiveScene, StageMapScene, PartyScene, BattleScene],
});
