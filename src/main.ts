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
  // AUTO는 가능한 환경에서 Mesh에 유리한 WebGL을 선택하고, 미지원 기기에는 Canvas로 폴백한다.
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#1a1d21",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
  },
  fps: {
    // 브라우저가 잠깐 늦어진 뒤 여러 업데이트를 몰아서 실행하며 버벅이는 현상을 완화한다.
    target: 60,
    min: 30,
    smoothStep: true,
  },
  render: {
    // 고해상도 모바일에서 Mesh 가장자리 품질은 유지하되 픽셀 반올림 진동은 막는다.
    antialias: true,
    roundPixels: false,
    powerPreference: "high-performance",
  },
  input: {
    // 멀티터치 환경에서도 Phaser pointer 이벤트가 touchstart/touchend를 안정적으로 추적한다.
    activePointers: 3,
  },
  scene: [BootScene, TitleScene, LobbyScene, RelicsScene, LabScene, StageMapScene, PartyScene, BattleScene],
});
