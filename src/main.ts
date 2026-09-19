import Phaser from "phaser";
import "./style.css";
import { BASE_WIDTH, BASE_HEIGHT } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { RelicsScene } from "./scenes/RelicsScene";
import { LabScene } from "./scenes/LabScene";
import { StageMapScene } from "./scenes/StageMapScene";
import { StageStoryScene } from "./scenes/StageStoryScene";
import { PartyScene } from "./scenes/PartyScene";
import { BattleScene } from "./scenes/BattleScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { ShopScene } from "./scenes/ShopScene";
import { PremiumScene } from "./scenes/PremiumScene";
import { FriendsScene } from "./scenes/FriendsScene";
import { ArchaeologyScene } from "./scenes/ArchaeologyScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { ExpeditionScene } from "./scenes/ExpeditionScene";
import { SortiePreviewScene } from "./scenes/SortiePreviewScene";
import { RaidScene } from "./scenes/RaidScene";
import { EffectOverlayScene } from "./scenes/EffectOverlayScene";
import { initializeAudioManager } from "./managers/AudioManager";
import { InteractionScene } from "./scenes/InteractionScene";
import { PvpPreviewScene } from "./scenes/PvpPreviewScene";
import { setDebugWebglRestore } from "./debug";

const game = new Phaser.Game({
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
    // 여기에 값이 있어야 TimeStep이 시작 시 stepLimitFPS를 묶어, 설정의 30/60 전환이 런타임에
    // 반영된다. 실제 경계값은 부트의 `applyFrameRateLimit`이 다시 잡는다 — 1000/limit를 그대로
    // 쓰면 60Hz에서 프레임이 절반으로 깎이므로, 이유는 config/gameConfig.ts에 적어 두었다.
    limit: 60,
    min: 30,
    smoothStep: true,
  },
  render: {
    // 고해상도 모바일에서 Mesh 가장자리 품질은 유지하되 픽셀 반올림 진동은 막는다.
    antialias: true,
    roundPixels: false,
    powerPreference: "high-performance",
  },
  dom: {
    // 도감의 이름 검색 칸만 쓴다. 캔버스 위에 투명한 `<input>`을 겹쳐 두어야 모바일에서
    // 운영체제 자판이 올라오고, 글자·자리·깜빡이는 막대는 여전히 Phaser가 그린다.
    // 컨테이너 자체는 입력을 통과시키므로 겹쳐 둔 칸 밖의 조작은 그대로 캔버스가 받는다.
    createContainer: true,
  },
  input: {
    // 멀티터치 환경에서도 Phaser pointer 이벤트가 touchstart/touchend를 안정적으로 추적한다.
    activePointers: 3,
  },
  // 장기 탐사형 고고학, 배너 연구소, 재화 상점, 유료 프리미엄은 각각 독립 화면이다.
  // 원정은 로비 출격 선택판에서 진입하며 준비/이어하기 상태를 같은 씬에서 소유한다.
  // 누른 자리에 답하는 겹은 모든 화면 위에 서야 하므로 목록의 맨 끝에 둔다.
  scene: [BootScene, TitleScene, OpeningScene, LobbyScene, PvpPreviewScene, InteractionScene, ExpeditionScene, SortiePreviewScene, RaidScene, SettingsScene, FriendsScene, ShopScene, PremiumScene, RelicsScene, LabScene, ArchaeologyScene, StageMapScene, StageStoryScene, PartyScene, BattleScene, EffectOverlayScene],
});

// 모바일 백그라운드 복귀를 검증하도록 DOM 사건과 실제 Phaser 렌더 재개만 관찰한다.
let restoredEvents = 0; let renderedFramesAfterRestore = 0; let waitingForRestoredRender = false;
setDebugWebglRestore({ restoredEvents, renderedFramesAfterRestore, renderingResumed: false });
game.canvas.addEventListener("webglcontextlost", () => {
  renderedFramesAfterRestore = 0; waitingForRestoredRender = true;
  setDebugWebglRestore({ restoredEvents, renderedFramesAfterRestore, renderingResumed: false });
});
game.canvas.addEventListener("webglcontextrestored", () => {
  restoredEvents += 1; waitingForRestoredRender = true;
  setDebugWebglRestore({ restoredEvents, renderedFramesAfterRestore, renderingResumed: false });
});
game.events.on(Phaser.Core.Events.POST_RENDER, () => {
  if (!waitingForRestoredRender) return;
  renderedFramesAfterRestore += 1;
  setDebugWebglRestore({ restoredEvents, renderedFramesAfterRestore, renderingResumed: true });
});

// Phaser Sound 생성과 브라우저 수명 주기 처리는 씬이 아니라 중앙 오디오 관리자에 연결한다.
initializeAudioManager(game);
