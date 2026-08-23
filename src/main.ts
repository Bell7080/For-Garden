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
import { OpeningScene } from "./scenes/OpeningScene";
import { MissionsScene } from "./scenes/MissionsScene";
import { ShopScene } from "./scenes/ShopScene";
import { FriendsScene } from "./scenes/FriendsScene";
import { ArchaeologyScene } from "./scenes/ArchaeologyScene";
import { SettingsScene } from "./scenes/SettingsScene";

new Phaser.Game({
  // Puppet 원본 indexed mesh를 GPU로 직접 그리므로 중복 정점을 만드는 Canvas 폴백은 사용하지 않는다.
  type: Phaser.WEBGL,
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
  // 새 장기 탐사형 발굴과 기존 배너 연구소는 독립 화면이며 상점은 카탈로그 씬을 공유한다.
  scene: [BootScene, TitleScene, OpeningScene, LobbyScene, SettingsScene, FriendsScene, MissionsScene, ShopScene, RelicsScene, LabScene, ArchaeologyScene, StageMapScene, PartyScene, BattleScene],
});
