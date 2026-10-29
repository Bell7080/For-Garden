import { ArenaScene, ArenaMatchScene } from "./scenes/ArenaScene";
import { ArenaRoomScene } from "./scenes/ArenaRoomScene";
import { ArenaNoticeScene } from "./scenes/ArenaNoticeScene";
import Phaser from "phaser";
import { QA_TOOLS_ENABLED } from "./core/buildFlavor";
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
import { GuildScene } from "./scenes/GuildScene";
import { ArchaeologyScene } from "./scenes/ArchaeologyScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { ExpeditionScene } from "./scenes/ExpeditionScene";
import { SortiePreviewScene } from "./scenes/SortiePreviewScene";
import { RaidScene } from "./scenes/RaidScene";
import { AncientStrataScene } from "./scenes/AncientStrataScene";
import { CakeOperationScene } from "./scenes/CakeOperationScene";
import { BountyScene } from "./scenes/BountyScene";
import { EffectOverlayScene } from "./scenes/EffectOverlayScene";
import { initializeAudioManager } from "./managers/AudioManager";
import { BgmDirector } from "./managers/BgmDirector";
import { InteractionScene } from "./scenes/InteractionScene";
import { DuelScene } from "./scenes/DuelScene";
import { PvpPreviewScene } from "./scenes/PvpPreviewScene";
import { EventScene } from "./scenes/EventScene";
import { setDebugWebglRestore, debugPerfEnabled, publishDebugPerf } from "./debug";
import { installCjkWrap } from "./ui/cjkWrap";
import { installTapSlopGuard } from "./ui/tapSlopGuard";
import { guardFrame } from "./core/frameGuard";
import { installErrorReporter } from "./managers/ErrorReporter";
import { logError } from "./managers/ErrorReporter";

installCjkWrap();
installTapSlopGuard();

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
  scene: [BootScene, TitleScene, OpeningScene, LobbyScene, PvpPreviewScene, DuelScene, ArenaScene, ArenaMatchScene, ArenaRoomScene, ArenaNoticeScene, EventScene, InteractionScene, ExpeditionScene, SortiePreviewScene, RaidScene, AncientStrataScene, CakeOperationScene, BountyScene, SettingsScene, FriendsScene, GuildScene, ShopScene, PremiumScene, RelicsScene, LabScene, ArchaeologyScene, StageMapScene, StageStoryScene, PartyScene, BattleScene, EffectOverlayScene],
});

installErrorReporter();

// 한 프레임의 예외가 게임 루프를 죽이지 않게 프레임 콜백을 감싼다(이유는 core/frameGuard).
// 루프는 READY 직후 시작되므로 그 뒤 한 틱 늦게 감싼다. 로그는 같은 오류가 쏟아지지 않게 앞 몇 번만 남긴다.
{
  const wrapLoop = (): void => {
    const loop = game.loop as unknown as { callback: (time: number, delta: number) => void };
    loop.callback = guardFrame(
      loop.callback,
      (error, consecutive) => { if (consecutive <= 3) logError("frame.error", "[frame] 프레임 오류", error, { consecutive }); },
      (error) => logError("frame.stuck", "[frame] 같은 오류가 계속되어 화면이 멈췄을 수 있다", error),
    );
  };
  if (game.isRunning) wrapLoop(); else game.events.once(Phaser.Core.Events.READY, () => { void Promise.resolve().then(wrapLoop); });
}

// 모바일 백그라운드 복귀를 검증하도록 DOM 사건과 실제 Phaser 렌더 재개만 관찰한다.
if (QA_TOOLS_ENABLED) {
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
}

// QA/test/dev에서 `?perf=1`로 열면 1초마다 실제 프레임과 Puppet 갱신 횟수를 왼쪽 위에 적는다(프레임 저하 진단용).
if (debugPerfEnabled) {
  let perfFrames = 0; let perfSince = performance.now();
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    perfFrames += 1;
    const now = performance.now();
    if (now - perfSince < 1000) return;
    const active = game.scene.getScenes(true).map((s) => s.scene.key).filter((k) => k !== "EffectOverlayScene").join("+");
    publishDebugPerf(perfFrames, active || "-");
    perfFrames = 0; perfSince = now;
  });
}

// Phaser Sound 생성과 브라우저 수명 주기 처리는 씬이 아니라 중앙 오디오 관리자에 연결한다.
initializeAudioManager(game);

// 배경음은 씬이 고르지 않는다 — 씬이 시작·재개될 때 `core/bgmPlan`의 표대로 감독이 곡을 바꾼다.
// E2E(`test`)는 3~4MB 곡을 받느라 느려지지 않도록 켜지 않는다.
{
  const bgm = new BgmDirector(game, import.meta.env.MODE !== "test");
  if (game.isBooted) bgm.attach(); else game.events.once(Phaser.Core.Events.READY, () => bgm.attach());
}
