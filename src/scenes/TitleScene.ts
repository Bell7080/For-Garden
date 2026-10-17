import Phaser from "phaser";
import { loadDataOverlay, loadTextCatalog, t, type TextKey } from "../i18n";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import { bindDebugReadyLifecycle, setDebugReady, setDebugScene } from "../debug";
import { COLOR, textStyle } from "../ui/theme";
import { OPENING_TRAIN } from "../data/dialogues/openingTrain";
import { storyManager } from "../managers/StoryManager";
import { session } from "../state/session";
import { openingPending } from "../core/openingFlow";
import { LoadingDiamonds } from "../ui/LoadingDiamonds";
import { LoadingPercent } from "../ui/LoadingPercent";
import {
  startTitleMovie,
  TITLE_MOVIE_FALLBACK_MS,
  TITLE_MOVIE_KEY,
  TITLE_MOVIE_SOURCES,
} from "../ui/titleMovie";
import { LOADING_STEPS, refreshTextTextures, runLoadingSteps } from "./loadingSteps";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { drawCornerShroud, drawVignette } from "../ui/holo";
import packageInfo from "../../package.json";
import { reconcileLaunchEpoch } from "../api/launchEpoch";
import { checkStartupGate, type StartupGateResult } from "../api/startupGate";
import { startScene } from "../ui/screenTransition";
import { settingsManager } from "../managers/SettingsManager";
import { LANGUAGE_NATIVE_NAME, SELECTABLE_LANGUAGE_IDS } from "../core/language";
import { activeFontFamily, loadGameFonts } from "../ui/fonts";
import { PopupLayer } from "../ui/PopupLayer";
import { openChoicePicker } from "../ui/SettingsPicker";
import { accountApi, type AccountFailureCode } from "../api/AccountApi";
import { connectProgress, disconnectProgress } from "../api/backendSession";
import { openSaveConflictPopup, type SaveConflictChoice } from "../ui/SaveConflictPopup";
import { saveManager } from "../state/SaveManager";
import { TitleActionRow } from "../ui/TitleActionRow";
import { TITLE_LOADING_LAYOUT } from "../ui/titleActionLayout";

/** 타이틀 로고타입(글자 대신 쓰는 그림)의 텍스처 키다. 원본은 1536×1024 비율이다. */
const TITLE_LOGOTYPE_KEY = "title-logotype";
const TITLE_LOGOTYPE_RATIO = 1024 / 1536;

/**
 * 원본 안에서 **글자가 실제로 차지하는 영역**(0~1 비율).
 *
 * 로고타입 파일은 사방에 넉넉한 투명 여백을 두고 있어, 그림 상자를 기준으로 자리를 잡으면
 * 눈에 보이는 글자와 아래 부제 사이에 190px 넘는 빈틈이 생기고 부제는 그만큼 내려가 배경
 * 원화의 얼굴을 덮는다. 그래서 상자가 아니라 **보이는 글자**를 기준으로 배치한다.
 *
 * 값은 `titlename.webp`의 alpha 경계를 실측했다(1536×1024, bbox 104·321·1462·713).
 * 아트가 교체되면 같은 방법으로 다시 재서 이 표만 고친다.
 */
const TITLE_LOGOTYPE_CONTENT = { top: 0.3135, bottom: 0.6963, left: 0.0677, right: 0.9518 } as const;

/** 보이는 글자의 윗변이 놓일 자리.  */
const TITLE_LOGO_TOP = 150;

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
const TITLE_REVEAL = {
  openMs: 520,
  flashMs: 420,
  flashHeightRatio: 0.28,
  /** 제목 아래 두 줄이 뒤따라 떠오르는 높이·시점. 함께 들어오면 어느 것이 제목인지 흐려진다. */
  lineRiseY: 18,
  lineDelayMs: 260,
  lineMs: 420,
} as const;

/**
 * 화면 아래 한 줄이 서는 자리.
 *
 * 로딩 중에는 진행률 숫자가, 다 찬 뒤에는 진입 문구가 **같은 자리를** 이어받는다. 둘이 함께
 * 서는 순간은 없으므로 자리를 나누면 오히려 무엇을 기다리는지가 두 곳으로 갈린다.
 */
const LOADING_PROMPT_Y = TITLE_LOADING_LAYOUT.promptY;

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
  /** 제목 연출도 영상이 시작하지 않는 기기에서 한 번은 반드시 열려야 하므로 같은 빗장을 쓴다. */
  private headerOpened = false;
  /** 언어가 바뀌면 문장을 다시 읽어 갈아 끼울 글자들. 그릴 때 문장을 굳히지 않고 읽는 법을 들고 있다. */
  private localized: Array<{ text: Phaser.GameObjects.Text; read: () => string }> = [];
  private actionRow?: TitleActionRow;
  private popups?: PopupLayer;
  /** 시작 관문(점검·최소 버전). 로딩과 나란히 한 번 묻고, 입장을 누를 때 결과를 읽는다. */
  private gate?: Promise<StartupGateResult>;

  constructor() {
    super("title");
  }

  create(): void {
    // 타이틀 로딩의 ready 소유권을 시작/종료 수명주기와 함께 초기화한다.
    bindDebugReadyLifecycle(this.events);
    setDebugScene("title");
    this.revealed = false;
    this.headerOpened = false;
    this.localized = [];
    this.actionRow = undefined;
    this.popups = new PopupLayer(this, 3000);

    const cx = BASE_WIDTH / 2;
    // 최소 리소스가 도착할 때까지 화면은 검다. 조립 과정을 보여 주지 않기 위해서다.
    const curtain = this.add.rectangle(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000).setDepth(50);

    // 타이틀 자신의 배경·로고·영상은 다른 화면 배경과 달리 로딩 단계를 기다리지 않고 가장 먼저
    // 읽는다 — 이 화면 자체가 로딩 화면이라 그 단계가 끝나기 전부터 보여야 하기 때문이다.
    // **검은 화면을 여는 것은 원화와 로고 둘뿐이다.** 영상까지 함께 기다리면 1MB가 넘는 파일
    // 하나가 화면 전체를 붙잡는다. 영상은 도착하는 대로 정지 화면 위를 덮는다.
    this.load.video(TITLE_MOVIE_KEY, [...TITLE_MOVIE_SOURCES], true);
    this.load.image(BACKGROUND.title, "sprites/background/background_011.webp");
    this.load.image(TITLE_LOGOTYPE_KEY, "sprites/ui/titlename.webp");

    let stillLeft = 2;
    const stillReady = (): void => {
      stillLeft -= 1;
      if (stillLeft <= 0) this.enterTitle(curtain, cx);
    };
    this.load.once(`filecomplete-image-${BACKGROUND.title}`, stillReady);
    this.load.once(`filecomplete-image-${TITLE_LOGOTYPE_KEY}`, stillReady);
    // 파일 하나가 없어도 검은 화면에 갇히지 않는다. 아트가 UI와 로딩 진행까지 막지 않는다.
    this.load.once("complete", () => this.enterTitle(curtain, cx));
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
    const logoWidth = 884;
    const logoHeight = logoWidth * TITLE_LOGOTYPE_RATIO;
    // 그림 상자가 아니라 보이는 글자의 위·아래를 계산해 그 사이에만 자리를 잡는다.
    const inkHeight = logoHeight * (TITLE_LOGOTYPE_CONTENT.bottom - TITLE_LOGOTYPE_CONTENT.top);
    const inkOffsetY = ((TITLE_LOGOTYPE_CONTENT.top + TITLE_LOGOTYPE_CONTENT.bottom) / 2 - 0.5) * logoHeight;
    const logoY = TITLE_LOGO_TOP + inkHeight / 2 - inkOffsetY;
    const inkBottom = logoY + inkOffsetY + inkHeight / 2;
    // 제목과 부제는 한 덩어리로 읽혀야 하므로 바짝 붙인다. 판때기가 없어진 만큼 사이가
    // 벌어지면 서로 다른 두 정보처럼 보인다.
    const subtitleY = inkBottom + 34;
    const descY = subtitleY + 48;

    if (this.textures.exists(BACKGROUND.title)) addSceneBackground(this, BACKGROUND.title, -30);
    // 영상은 정지 원화 바로 위, 비네트 아래에 선다 — 가장자리를 누르는 규칙은 두 그림이 같다.
    this.startMovie(cx, logoY, logoWidth, logoHeight, subtitleY, descY);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -20 });
    // 화면 자신도 팝업 몸판과 같은 방향으로 두 모서리를 깎아, 끝까지 차 있는 영상이 투영
    // 장비 안에 들어 있는 것으로 읽히게 한다.
    drawCornerShroud(this, BASE_WIDTH, BASE_HEIGHT, { depth: -19 });

    const recoveryNotice = this.registry.get("saveRecoveryNotice") as TextKey | undefined;
    if (recoveryNotice) {
      // 새게임 버튼 대신 자동 복구 사실만 안내해 향후 Google/Apple 계정 복구 흐름을 막지 않는다.
      this.add
        .text(cx, BASE_HEIGHT * 0.63, t(recoveryNotice), textStyle({ role: "body", size: 26, color: COLOR.dangerText, align: "center" }))
        .setOrigin(0.5);
      this.registry.remove("saveRecoveryNotice");
    }

    // 버전 표기. 어느 빌드에서나 반드시 지나는 화면이라 스크린샷 한 장으로 빌드를 알 수 있다.
    // 문자열의 단일 출처는 package.json이고 VERSION.md가 같은 값을 쓴다.
    this.add
      .text(48, BASE_HEIGHT - 48, `v${packageInfo.version}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim }))
      .setOrigin(0, 1)
      .setAlpha(0.7);

    const diamonds = new LoadingDiamonds(this, cx, TITLE_LOADING_LAYOUT.diamondsY, LOADING_STEPS.length);
    // 칸은 "몇 개 남았나"를, 이 숫자는 "얼마나 왔나"를 말한다. 다 차면 그 자리를 진입 문구가
    // 그대로 이어받으므로 같은 y에 세운다.
    const percent = new LoadingPercent(this, cx, LOADING_PROMPT_Y);

    // 검은 화면은 타이틀이 다 선 뒤에 걷는다. 걷히는 순간 화면은 이미 완성돼 있다.
    this.tweens.add({ targets: curtain, alpha: 0, duration: 220, onComplete: () => curtain.destroy() });

    // 서버에 점검·최소 버전을 묻는 일은 로딩과 나란히 돌려, 입장을 누를 때는 대개 답이 와 있다.
    this.gate = checkStartupGate(packageInfo.version);
    void runLoadingSteps(
      this,
      (done) => {
        diamonds.setFilled(done);
        // 글꼴 단계가 끝나면 이미 그려 둔 제목을 게임 글꼴로 다시 굳힌다.
        if (done === 1) refreshTextTextures(this);
      },
      LOADING_STEPS,
      (ratio) => percent.setRatio(ratio),
    ).then(() => {
      if (!this.scene.isActive()) return;
      // 따라가기를 건너뛰고 정확히 100.00%에 멈춘 뒤 그 자리를 진입 문구에 넘긴다.
      percent.complete();
      percent.handOver();
      this.showEntry(cx);
    });
  }

  /**
   * 타이틀 영상을 세우고, **영상이 실제로 흐르기 시작하는 순간** 제목 연출을 연다.
   *
   * 정지된 일러스트가 먼저 서 있다가 같은 구도의 영상이 그 위를 점차 덮고, 그때 제목이
   * 좌우로 열린다 — 화면이 움직이기 시작하는 한 순간에 시작을 알리는 모든 것이 모인다.
   *
   * 영상이 없거나 자동 재생이 막힌 기기에서도 제목은 반드시 선다. 그쪽에서는 정지된 원화
   * 위에서 같은 연출이 조금 늦게 열릴 뿐이다.
   */
  private startMovie(
    cx: number,
    logoY: number,
    logoWidth: number,
    logoHeight: number,
    subtitleY: number,
    descY: number,
  ): void {
    const open = (): void => this.openHeader(cx, logoY, logoWidth, logoHeight, subtitleY, descY);
    // 영상이 아직 안 왔으면 도착하는 대로 세운다 — 검은 화면을 여는 것은 원화와 로고뿐이다.
    if (!this.cache.video.exists(TITLE_MOVIE_KEY)) {
      this.load.once(`filecomplete-video-${TITLE_MOVIE_KEY}`, () => {
        if (this.scene.isActive()) startTitleMovie(this, -29, open);
      });
    } else {
      startTitleMovie(this, -29, open);
    }
    this.time.delayedCall(TITLE_MOVIE_FALLBACK_MS, open);
  }

  /**
   * 제목·부제가 들어오는 연출.
   *
   * 로고는 가운데에서 좌우로 열리고, 그 아래 두 줄은 뒤따라 떠오른다. 영상이 시작하는
   * 시점에 한 번만 열린다.
   */
  private openHeader(
    cx: number,
    logoY: number,
    logoWidth: number,
    logoHeight: number,
    subtitleY: number,
    descY: number,
  ): void {
    if (this.headerOpened || !this.scene.isActive()) return;
    this.headerOpened = true;

    // 판때기를 받치지 않는다. 글자 모양 그대로 진 복제 그림자가 대비를 만들고 배경은 비친다.
    const lines = [
      ...this.addShadowedText(cx, subtitleY, () => "ETERNAL CITY",
        textStyle({ role: "emphasis", size: 40, color: COLOR.accentText }),
        textStyle({ role: "emphasis", size: 40, color: "#000000" })),
      ...this.addShadowedText(cx, descY, () => t("title.subtitle"),
        textStyle({ role: "body", size: 30, color: COLOR.inkDim }),
        textStyle({ role: "body", size: 30, color: "#000000" })),
    ];
    // 두 줄은 제목이 다 열린 뒤에 뒤따라 뜬다. 함께 들어오면 어느 것이 제목인지 흐려진다.
    lines.forEach((line) => {
      const rest = line.alpha;
      line.setAlpha(0).setY(line.y + TITLE_REVEAL.lineRiseY);
      this.tweens.add({
        targets: line,
        alpha: rest,
        y: line.y - TITLE_REVEAL.lineRiseY,
        delay: TITLE_REVEAL.lineDelayMs,
        duration: TITLE_REVEAL.lineMs,
        ease: "Quad.Out",
      });
    });

    if (this.textures.exists(TITLE_LOGOTYPE_KEY)) this.openLogo(cx, logoY, logoWidth, logoHeight);
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
    read: () => string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    // 그림자도 같은 역할·같은 크기여야 획이 어긋나지 않는다. 색만 검다.
    shadowStyle: Phaser.Types.GameObjects.Text.TextStyle,
    // 그림자와 본체를 함께 움직여야 들어오는 연출에서 획이 어긋나지 않는다.
  ): readonly Phaser.GameObjects.Text[] {
    const size = Number.parseInt(String(shadowStyle.fontSize ?? "30"), 10);
    const shadow = this.add
      .text(x + TITLE_SHADOW.textOffset.x, y + TITLE_SHADOW.textOffset.y, read(), shadowStyle)
      .setOrigin(0.5)
      // 획 둘레로 번지는 검은 띠가 실제 배경이 되어 대비를 배경 원화에서 떼어 놓는다.
      .setStroke("#000000", Math.round(size * TITLE_SHADOW.haloRatio))
      .setAlpha(TITLE_SHADOW.alpha)
      .setDepth(-11);
    const main = this.add.text(x, y, read(), style).setOrigin(0.5).setDepth(-10);
    this.localized.push({ text: shadow, read }, { text: main, read });
    return [shadow, main];
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
    const inkWidth = width * (TITLE_LOGOTYPE_CONTENT.right - TITLE_LOGOTYPE_CONTENT.left);
    const inkHeight = height * (TITLE_LOGOTYPE_CONTENT.bottom - TITLE_LOGOTYPE_CONTENT.top);
    const inkY = cy + ((TITLE_LOGOTYPE_CONTENT.top + TITLE_LOGOTYPE_CONTENT.bottom) / 2 - 0.5) * height;
    // 섬광은 보이는 글자에 맞춘다. 그림 상자로 잡으면 글자 밖 투명 여백까지 번쩍인다.
    const flash = this.add
      .rectangle(cx, inkY, 4, inkHeight * TITLE_REVEAL.flashHeightRatio, 0xffffff, 0.85)
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
      displayWidth: inkWidth * 1.12,
      alpha: 0,
      duration: TITLE_REVEAL.flashMs,
      ease: "Quad.Out",
      onComplete: () => flash.destroy(),
    });
  }

  /** 다섯 칸이 다 찬 뒤에만 부른다. 이때부터 화면 어디를 눌러도 다음으로 넘어간다. */
  private showEntry(cx: number): void {
    const prompt = this.add
      .text(cx, LOADING_PROMPT_Y, t("title.enter"), textStyle({ role: "emphasis", size: 36 }))
      .setOrigin(0.5)
      // 이 자리는 배경 원화의 밝은 부분과 겹칠 수 있어 검은 그림자로 대비를 만든다.
      .setShadow(0, 3, "#000000", 6, true, true);

    this.localized.push({ text: prompt, read: () => t("title.enter") });
    // 하단 버튼 줄. 지금은 언어 하나이고 로그인·계정 전환이 같은 줄에 이어 붙는다.
    this.actionRow = new TitleActionRow(this, [
      {
        icon: "globe",
        label: () => LANGUAGE_NATIVE_NAME[settingsManager.get().game.language],
        onClick: () => this.openLanguagePicker(),
      },
      {
        icon: "friends",
        label: () => t("title.switchAccount"),
        onClick: () => this.confirmSwitchAccount(),
      },
    ]);

    this.tweens.add({
      targets: prompt,
      alpha: { from: 1, to: 0.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    // 화면 전체 히트영역은 가장 아래 깊이에 깔고 pointerup에서 확정한다.
    const tapAnywhere = this.add
      .zone(cx, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT)
      .setInteractive({ useHandCursor: true })
      .setDepth(-1);
    const enter = () => {
      void (this.gate ??= checkStartupGate(packageInfo.version)).then((result) => {
        if (result.gate === "open") {
          // 서버가 출시 초기화를 한 뒤에 처음 여는 기기는 초기화 이전의 토큰·저장을 지우고 처음부터 다시 시작한다.
          if (result.config && reconcileLaunchEpoch(result.config.launchEpoch)) {
            window.location.reload();
            return;
          }
          // 서버가 진행을 소유하는 빌드는 연결이 선 뒤에만 들어간다. 실패하면 이 기기에서 이어 가지 않는다.
          void connectProgress((local, remote) => new Promise<SaveConflictChoice>((resolve) => { if (this.popups) openSaveConflictPopup(this, this.popups, local, remote, resolve); else resolve("cancel"); })).then((connected) => {
            if (!this.scene.isActive()) return;
            if (connected.ok) {
              startScene(this, openingPending(storyManager.isCompleted(OPENING_TRAIN.id), session.cleared) ? "opening" : "lobby");
              return;
            }
            console.warn("[forgarden] connect failed", connected.code, connected.detail ?? "-");
            this.showConnectFailure(connected.code, connected.detail);
            tapAnywhere.once("pointerup", enter);
          });
          return;
        }
        // 막힌 동안에도 다시 누르면 새로 묻는다 — 점검이 끝났는데 앱을 다시 켜게 하지 않는다.
        this.gate = undefined;
        this.showGateNotice(result);
        tapAnywhere.once("pointerup", enter);
      });
    };
    tapAnywhere.once("pointerup", enter);

    // 로딩 중 먼저 그려진 글자(부제)가 문구표보다 앞섰을 수 있으므로 한 번 더 읽는다.
    this.relocalize();
    setDebugReady(true);
  }

  /** 서버 연결이 서지 못한 이유를 알리고 다시 누르면 새로 시도한다. */
  private showConnectFailure(code: AccountFailureCode, detail?: string): void {
    this.popups?.confirm({
      title: t("settings.account.notice"),
      message: t(code === "conflict-cancelled" ? "settings.account.conflictCancelled" : code === "network-error" ? "settings.account.network" : "settings.account.unavailable") + (detail ? `\n${t("settings.account.errorCode", { code: detail })}` : ""),
      confirmLabel: t("settings.action.confirm"),
      cancelLabel: false,
    });
  }

  private showGateNotice(result: StartupGateResult): void {
    if (!this.popups) return;
    const config = result.config;
    if (result.gate === "maintenance") {
      const until = config?.maintenanceEndsAt ? new Date(config.maintenanceEndsAt).toLocaleString() : "";
      const base = config?.maintenanceMessage || t("title.gate.maintenance.default");
      this.popups.confirm({
        title: t("title.gate.maintenance.title"),
        message: until ? `${base}\n${t("title.gate.maintenance.until", { time: until })}` : base,
        confirmLabel: t("title.gate.confirm"),
        cancelLabel: false,
      });
      return;
    }
    this.popups.confirm({
      title: t("title.gate.update.title"),
      message: t("title.gate.update.body", { version: config?.latestAppVersion || config?.minAppVersion || "" }),
      confirmLabel: t("title.gate.confirm"),
      cancelLabel: false,
    });
  }

  /** 설정의 언어 줄과 같은 선택창·같은 저장 경로다. 둘이 어긋나지 않는다. */
  private openLanguagePicker(): void {
    if (!this.popups || SELECTABLE_LANGUAGE_IDS.length < 2) return;
    openChoicePicker(this, this.popups, {
      title: t("settings.play.language"),
      value: settingsManager.get().game.language,
      choices: SELECTABLE_LANGUAGE_IDS,
      display: (id) => LANGUAGE_NATIVE_NAME[id],
      onPick: (id) => {
        settingsManager.update({ game: { language: id } });
        // 글꼴 스택과 문구표가 함께 바뀌므로 둘 다 도착한 뒤에 글자를 갈아 끼운다.
        void Promise.all([loadGameFonts(id), loadTextCatalog(id), loadDataOverlay(id)]).then(() => {
          if (this.scene.isActive()) this.relocalize();
        });
      },
    });
  }

  /**
   * 로그아웃이 성공한 뒤에만 이 기기의 로컬 저장을 지운다 — 미지원·통신 실패로 끝나면 아무것도 잃지 않는다.
   * 이후 부트가 저장 검증을 다시 거쳐 새 계정으로 시작한다.
   */
  private confirmSwitchAccount(): void {
    if (!this.popups) return;
    this.popups.confirm(
      { title: t("title.switchAccount"), message: t("title.switchAccount.body"), confirmLabel: t("title.switchAccount"), destructive: true },
      () => {
        void accountApi.logout().then((result) => {
          if (!this.scene.isActive()) return;
          if (result.ok) {
            disconnectProgress();
            saveManager.reset();
            startScene(this, "boot");
            return;
          }
          this.popups?.confirm({
            title: t("settings.account.notice"),
            message: t(result.code === "unsupported" ? "settings.account.unsupported" : "settings.account.network"),
            confirmLabel: t("settings.action.confirm"),
            cancelLabel: false,
          });
        });
      },
    );
  }

  /** 타이틀 글자를 지금 언어의 문장·글꼴로 갈아 끼운다. 씬을 다시 세우지 않아 연출이 끊기지 않는다. */
  private relocalize(): void {
    this.localized.forEach(({ text, read }) => {
      if (!text.active) return;
      text.setFontFamily(activeFontFamily()).setText(read());
    });
    this.actionRow?.relocalize();
  }
}
