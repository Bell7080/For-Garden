import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { setDebugReady, setDebugScene } from "../debug";
import { COLOR, textStyle } from "../ui/theme";
import { OPENING_TRAIN } from "../data/dialogues/openingTrain";
import { storyManager } from "../managers/StoryManager";
import { Button } from "../ui/Button";
import { LoadingDiamonds } from "../ui/LoadingDiamonds";
import { LOADING_STEPS, refreshTextTextures, runLoadingSteps } from "./loadingSteps";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { drawVignette } from "../ui/holo";
import packageInfo from "../../package.json";

/** 타이틀 로고타입(글자 대신 쓰는 그림)의 텍스처 키다. 원본은 1536×1024 비율이다. */
const TITLE_LOGOTYPE_KEY = "title-logotype";
const TITLE_LOGOTYPE_RATIO = 1024 / 1536;

/**
 * 타이틀이자 로딩 화면.
 *
 * 부트는 저장 데이터만 확인하고 곧바로 이 화면을 띄운다. 원화·아이콘·Puppet 묶음은 여기서
 * 읽으며, 기다리는 동안 제목 아래 마름모 다섯 칸이 하나씩 찬다. 다 차기 전에는 다음 화면으로
 * 넘어가지 못한다 — 로비가 원화 없이 뜨는 편이 잠깐 기다리는 것보다 나쁘다.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    setDebugScene("title");
    setDebugReady(false);

    const cx = BASE_WIDTH / 2;
    // 배경 원화의 얼굴은 화면 중단에 있으므로, 로고와 부제는 그 위 천장·후드 자리에만 둔다.
    const logoY = BASE_HEIGHT * 0.1;
    const logoWidth = 460;
    const logoHalfHeight = (logoWidth * TITLE_LOGOTYPE_RATIO) / 2;

    // 배경 원화가 도착하기 전에는 이 판이 자리를 지킨다 — 검은 화면보다 낫다.
    const fallback = this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void);

    // 타이틀 자신의 배경·로고는 다른 화면 배경과 달리 로딩 단계를 기다리지 않고 곧바로 읽는다
    // — 이 화면 자체가 로딩 화면이라 그 단계가 끝나기 전부터 보여야 하기 때문이다.
    this.load.image(BACKGROUND.title, "sprites/background/background_011.webp");
    this.load.image(TITLE_LOGOTYPE_KEY, "sprites/ui/titlename.webp");
    this.load.once("complete", () => {
      if (!this.scene.isActive()) return;
      fallback.destroy();
      addSceneBackground(this, BACKGROUND.title, -30);
      drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20 });
      this.add.image(cx, logoY, TITLE_LOGOTYPE_KEY).setDisplaySize(logoWidth, logoHalfHeight * 2).setDepth(-10);
    });
    this.load.start();

    // 부제 · 도시 소개 두 줄이 글꼴 위계의 본보기다. 제목 자리는 위 로고 그림이 대신한다.
    this.add
      .text(cx, logoY + logoHalfHeight + 40, "ETERNAL CITY", textStyle({ role: "emphasis", size: 40, color: COLOR.accentText }))
      .setOrigin(0.5);

    this.add
      .text(cx, logoY + logoHalfHeight + 90, "멸종 동물 복원 연구 도시", textStyle({ role: "body", size: 30, color: COLOR.inkDim }))
      .setOrigin(0.5);

    const recoveryNotice = this.registry.get("saveRecoveryNotice") as string | undefined;
    if (recoveryNotice) {
      // 새게임 버튼 대신 자동 복구 사실만 안내해 향후 Google/Apple 계정 복구 흐름을 막지 않는다.
      this.add
        .text(cx, BASE_HEIGHT * 0.68, recoveryNotice, textStyle({ role: "body", size: 26, color: COLOR.dangerText, align: "center" }))
        .setOrigin(0.5);
      this.registry.remove("saveRecoveryNotice");
    }

    // 버전 표기. 어느 빌드에서나 반드시 지나는 화면이라 스크린샷 한 장으로 빌드를 알 수 있다.
    // 문자열의 단일 출처는 package.json이고 VERSION.md가 같은 값을 쓴다.
    this.add
      .text(48, BASE_HEIGHT - 48, `v${packageInfo.version}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim }))
      .setOrigin(0, 1)
      .setAlpha(0.7);

    const diamonds = new LoadingDiamonds(this, cx, BASE_HEIGHT * 0.58, LOADING_STEPS.length);

    void runLoadingSteps(this, (done) => {
      diamonds.setFilled(done);
      // 글꼴 단계가 끝나면 이미 그려 둔 제목을 게임 글꼴로 다시 굳힌다.
      if (done === 1) refreshTextTextures(this);
    }).then(() => {
      if (!this.scene.isActive()) return;
      this.showEntry(cx);
    });
  }

  /** 다섯 칸이 다 찬 뒤에만 부른다. 이때부터 화면 어디를 눌러도 다음으로 넘어간다. */
  private showEntry(cx: number): void {
    const prompt = this.add
      .text(cx, BASE_HEIGHT * 0.82, "TAP TO ENTER", textStyle({ role: "emphasis", size: 36 }))
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    if (storyManager.isCompleted(OPENING_TRAIN.id)) {
      // 회상은 완료 플래그를 지우지 않으므로 선택 보상이 다시 지급되지 않는다.
      new Button(this, cx, BASE_HEIGHT * 0.72, { width: 360, height: 96, label: "오프닝 회상", fontSize: 30, onClick: () => this.scene.start("opening") });
    }

    // 회상 버튼이 먼저 눌리도록 화면 전체 히트영역은 가장 아래 깊이에 깔고 pointerup에서 확정한다.
    const tapAnywhere = this.add
      .zone(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT)
      .setInteractive({ useHandCursor: true })
      .setDepth(-1);
    tapAnywhere.once("pointerup", () => {
      this.scene.start(storyManager.isCompleted(OPENING_TRAIN.id) ? "lobby" : "opening");
    });

    setDebugReady(true);
  }
}
