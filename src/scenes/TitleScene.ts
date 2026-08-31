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
 * 제목·부제의 **복제 그림자**.
 *
 * 판때기를 뒤에 받치지 않는다 — 밝은 배경 원화 위에서 글자를 읽히게 하려고 검은 판을 깔면
 * 화면 위쪽이 통째로 어두운 상자가 되어 원화가 잘려 보인다. 대신 같은 그림·같은 글자를
 * **검게 한 겹 복제해 아래로 밀어** 깐다. 글자 모양 그대로 그림자가 지므로 배경은 그대로
 * 비치면서 획만 또렷해진다. 게이지 수치와 머리 위 체력 바가 쓰는 규칙과 같다.
 */
const TITLE_SHADOW = {
  /** 복제본을 미는 거리. 로고는 크므로 글자보다 조금 더 민다. */
  logoOffset: { x: 5, y: 9 },
  textOffset: { x: 3, y: 5 },
  /** 복제본의 진하기. 글자 획에만 얹히므로 진하게 둬도 배경 원화를 가리지 않는다. */
  alpha: 0.86,
  /**
   * 글자 복제본에 두르는 검은 테두리의 굵기(글자 크기 대비 비율).
   *
   * **밀기만 한 복제본으로는 모자란다.** 부제가 앉는 자리는 노란 후드라 밝은 곳의 휘도가
   * 0.758까지 오르고, 거기서 강조색(#d8b978)의 대비는 1.45:1, 설명 줄(#a9a7a2)은 1.85:1까지
   * 떨어진다 — 판때기를 걷어 낸 자리에 그냥 두면 읽히지 않는다(실측: `background_011.webp`의
   * 부제 띠 평균 0.132·최대 0.758).
   *
   * 그래서 복제본을 **획 둘레로 번지게** 두른다. 글자를 감싼 검은 띠가 실제 배경이 되므로
   * 대비가 배경 원화와 무관해진다 — 검정 위에서 강조색은 10.8:1, 설명 줄은 7.9:1이라 어느
   * 쪽도 AA(4.5:1)를 넉넉히 넘는다. 판 한 장으로 위쪽을 통째로 덮지 않고도 같은 대비를 얻는다.
   */
  haloRatio: 0.26,
} as const;

/**
 * 제목이 열리는 연출.
 *
 * 가운데 한 줄에서 좌우로 갈라지며 로고가 드러나고, 그 틈을 따라 흰 섬광이 함께 벌어졌다
 * 사라진다. 로고를 가로로 늘였다 줄이면 그림이 찌그러지므로, **잘라내는 창을 넓히는** 방식으로
 * 연다 — 로고 자체의 비율은 처음부터 끝까지 그대로다.
 */
const TITLE_REVEAL = { openMs: 520, flashMs: 420, flashHeightRatio: 0.28 } as const;

/**
 * 타이틀이자 로딩 화면.
 *
 * 부트는 저장 데이터만 확인하고 곧바로 이 화면을 띄운다. 원화·아이콘·Puppet 묶음은 여기서
 * 읽으며, 기다리는 동안 제목 아래 마름모 다섯 칸이 하나씩 찬다. 다 차기 전에는 다음 화면으로
 * 넘어가지 못한다 — 로비가 원화 없이 뜨는 편이 잠깐 기다리는 것보다 나쁘다.
 *
 * **최소 리소스가 도착하기 전에는 검은 화면만 둔다.** 배경 없이 글자와 마름모부터 뜨면 화면이
 * 한 번 조립되는 과정이 그대로 보인다. 배경과 로고가 준비된 순간에 한꺼번에 들어오고, 그때
 * 제목이 좌우로 열리며 시작을 알린다.
 */
export class TitleScene extends Phaser.Scene {
  /** 최소 리소스를 기다리다 실패해도 반드시 진입하도록, 시작 연출을 정확히 한 번만 연다. */
  private revealed = false;

  constructor() {
    super("title");
  }

  create(): void {
    setDebugScene("title");
    setDebugReady(false);
    this.revealed = false;

    const cx = BASE_WIDTH / 2;
    // 최소 리소스가 도착할 때까지 화면은 검다. 조립 과정을 보여 주지 않기 위해서다.
    const curtain = this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000).setDepth(50);

    // 타이틀 자신의 배경·로고는 다른 화면 배경과 달리 로딩 단계를 기다리지 않고 곧바로 읽는다
    // — 이 화면 자체가 로딩 화면이라 그 단계가 끝나기 전부터 보여야 하기 때문이다.
    this.load.image(BACKGROUND.title, "sprites/background/background_011.webp");
    this.load.image(TITLE_LOGOTYPE_KEY, "sprites/ui/titlename.webp");
    this.load.once("complete", () => this.enterTitle(curtain, cx));
    // 파일 하나가 없어도 검은 화면에 갇히지 않는다. 아트가 UI와 로딩 진행까지 막지 않는다.
    this.load.once("loaderror", () => this.enterTitle(curtain, cx));
    this.load.start();
  }

  /**
   * 검은 화면을 걷고 타이틀을 세운다.
   *
   * `complete`와 `loaderror`가 모두 도착할 수 있으므로 한 번만 통과시킨다.
   */
  private enterTitle(curtain: Phaser.GameObjects.Rectangle, cx: number): void {
    if (this.revealed || !this.scene.isActive()) return;
    this.revealed = true;

    // 배경 원화의 얼굴은 화면 중단에 있으므로, 로고와 부제는 그 위 천장·후드 자리에만 둔다.
    const logoY = BASE_HEIGHT * 0.155;
    const logoWidth = 680;
    const logoHalfHeight = (logoWidth * TITLE_LOGOTYPE_RATIO) / 2;
    // 제목과 부제는 한 덩어리로 읽혀야 하므로 바짝 붙인다. 판때기가 없어진 만큼 사이가
    // 벌어지면 서로 다른 두 정보처럼 보인다.
    const subtitleY = logoY + logoHalfHeight + 6;
    const descY = subtitleY + 48;

    if (this.textures.exists(BACKGROUND.title)) addSceneBackground(this, BACKGROUND.title, -30);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20 });

    // 판때기를 받치지 않는다. 글자 모양 그대로 진 복제 그림자가 대비를 만들고 배경은 비친다.
    this.addShadowedText(cx, subtitleY, "ETERNAL CITY",
      textStyle({ role: "emphasis", size: 40, color: COLOR.accentText }),
      textStyle({ role: "emphasis", size: 40, color: "#000000" }));
    this.addShadowedText(cx, descY, "멸종 동물 복원 연구 도시",
      textStyle({ role: "body", size: 30, color: COLOR.inkDim }),
      textStyle({ role: "body", size: 30, color: "#000000" }));

    if (this.textures.exists(TITLE_LOGOTYPE_KEY)) this.openLogo(cx, logoY, logoWidth, logoHalfHeight * 2);

    const recoveryNotice = this.registry.get("saveRecoveryNotice") as string | undefined;
    if (recoveryNotice) {
      // 새게임 버튼 대신 자동 복구 사실만 안내해 향후 Google/Apple 계정 복구 흐름을 막지 않는다.
      this.add
        .text(cx, BASE_HEIGHT * 0.63, recoveryNotice, textStyle({ role: "body", size: 26, color: COLOR.dangerText, align: "center" }))
        .setOrigin(0.5);
      this.registry.remove("saveRecoveryNotice");
    }

    // 버전 표기. 어느 빌드에서나 반드시 지나는 화면이라 스크린샷 한 장으로 빌드를 알 수 있다.
    // 문자열의 단일 출처는 package.json이고 VERSION.md가 같은 값을 쓴다.
    this.add
      .text(48, BASE_HEIGHT - 48, `v${packageInfo.version}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim }))
      .setOrigin(0, 1)
      .setAlpha(0.7);

    const diamonds = new LoadingDiamonds(this, cx, BASE_HEIGHT * 0.94, LOADING_STEPS.length);

    // 검은 화면은 타이틀이 다 선 뒤에 걷는다. 걷히는 순간 화면은 이미 완성돼 있다.
    this.tweens.add({ targets: curtain, alpha: 0, duration: 220, onComplete: () => curtain.destroy() });

    void runLoadingSteps(this, (done) => {
      diamonds.setFilled(done);
      // 글꼴 단계가 끝나면 이미 그려 둔 제목을 게임 글꼴로 다시 굳힌다.
      if (done === 1) refreshTextTextures(this);
    }).then(() => {
      if (!this.scene.isActive()) return;
      this.showEntry(cx);
    });
  }

  /**
   * 글자 한 줄과 그 **복제 그림자**.
   *
   * 같은 글자를 검게 한 겹 더 그려 아래로 민다. 획 모양 그대로 그림자가 지므로 뒤 원화는
   * 그대로 비치고 글자만 또렷해진다 — 판때기 한 장으로 배경을 가리는 것과 반대다.
   */
  private addShadowedText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    // 그림자도 같은 역할·같은 크기여야 획이 어긋나지 않는다. 색만 검다.
    shadowStyle: Phaser.Types.GameObjects.Text.TextStyle,
  ): void {
    const size = Number.parseInt(String(shadowStyle.fontSize ?? "30"), 10);
    this.add
      .text(x + TITLE_SHADOW.textOffset.x, y + TITLE_SHADOW.textOffset.y, text, shadowStyle)
      .setOrigin(0.5)
      // 획 둘레로 번지는 검은 띠가 실제 배경이 되어 대비를 배경 원화에서 떼어 놓는다.
      .setStroke("#000000", Math.round(size * TITLE_SHADOW.haloRatio))
      .setAlpha(TITLE_SHADOW.alpha)
      .setDepth(-11);
    this.add.text(x, y, text, style).setOrigin(0.5).setDepth(-10);
  }

  /**
   * 제목이 가운데에서 좌우로 열린다.
   *
   * 로고를 가로로 늘였다 줄이면 그림이 찌그러지므로 **잘라내는 창을 넓혀** 연다. 벌어지는 틈을
   * 따라 흰 섬광이 함께 퍼졌다 사라져 "지금 시작한다"를 한 번에 알린다.
   */
  private openLogo(cx: number, cy: number, width: number, height: number): void {
    const shadow = this.add
      .image(cx + TITLE_SHADOW.logoOffset.x, cy + TITLE_SHADOW.logoOffset.y, TITLE_LOGOTYPE_KEY)
      .setDisplaySize(width, height)
      .setTint(0x000000)
      .setAlpha(TITLE_SHADOW.alpha)
      .setDepth(-11);
    const logo = this.add.image(cx, cy, TITLE_LOGOTYPE_KEY).setDisplaySize(width, height).setDepth(-10);

    // 기하 마스크는 컨테이너 변환을 물려받지 않으므로 화면 좌표에 직접 세운다.
    const window = this.make.graphics({ x: 0, y: 0 }, false);
    const mask = window.createGeometryMask();
    logo.setMask(mask);
    shadow.setMask(mask);

    // 벌어지는 틈에 얹히는 섬광. 옅게 깔아 로고 글자가 그 속에 묻히지 않게 한다.
    const flash = this.add
      .rectangle(cx, cy, 4, height * TITLE_REVEAL.flashHeightRatio, 0xffffff, 0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-9);

    const opening = { t: 0 };
    this.tweens.add({
      targets: opening,
      t: 1,
      duration: TITLE_REVEAL.openMs,
      ease: "Cubic.Out",
      onUpdate: () => {
        // 가운데에서 시작해 좌우로 같은 만큼 벌어진다. 높이는 처음부터 온전하다.
        const open = width * opening.t;
        window.clear();
        window.fillStyle(0xffffff, 1);
        window.fillRect(cx - open / 2, cy - height / 2, open, height);
      },
      onComplete: () => {
        // 다 열린 뒤에는 마스크가 할 일이 없다. 남겨 두면 이후 모든 프레임의 비용이 된다.
        logo.clearMask();
        shadow.clearMask();
        mask.destroy();
        window.destroy();
      },
    });
    this.tweens.add({
      targets: flash,
      displayWidth: width * 1.12,
      alpha: 0,
      duration: TITLE_REVEAL.flashMs,
      ease: "Quad.Out",
      onComplete: () => flash.destroy(),
    });
  }

  /** 다섯 칸이 다 찬 뒤에만 부른다. 이때부터 화면 어디를 눌러도 다음으로 넘어간다. */
  private showEntry(cx: number): void {
    const prompt = this.add
      .text(cx, BASE_HEIGHT * 0.89, "TAP TO ENTER", textStyle({ role: "emphasis", size: 36 }))
      .setOrigin(0.5)
      // 이 자리는 배경 원화의 밝은 부분과 겹칠 수 있어 검은 그림자로 대비를 만든다.
      .setShadow(0, 3, "#000000", 6, true, true);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    if (storyManager.isCompleted(OPENING_TRAIN.id)) {
      // 회상은 이 화면의 주된 조작이 아니라 이미 본 사람을 위한 곁길이다. 가운데를 비우고
      // 좌상단에 작게 둬 제목과 배경 원화를 가리지 않는다.
      // 완료 플래그를 지우지 않으므로 선택 보상이 다시 지급되지 않는다.
      new Button(this, 150, 92, { width: 220, height: 64, label: "오프닝 회상", fontSize: 24, onClick: () => this.scene.start("opening") });
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
