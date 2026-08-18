import Phaser from "phaser";
import "./style.css";
import { BASE_WIDTH, BASE_HEIGHT } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { RelicsScene } from "./scenes/RelicsScene";
import { LabScene } from "./scenes/LabScene";
import { StageMapScene } from "./scenes/StageMapScene";
import { PartyScene } from "./scenes/PartyScene";
import { BattleScene } from "./scenes/BattleScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#1a1d21",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
  },
  scene: [BootScene, TitleScene, LobbyScene, RelicsScene, LabScene, StageMapScene, PartyScene, BattleScene],
});
