/**
 * 연구 시네마틱을 캔버스 위에 띄우는 경계.
 *
 * 3D 무대는 Phaser가 아니라 three.js가 그리므로, 게임 캔버스 **위에 겹치는 DOM 한 겹**으로
 * 세운다. 무거운 묶음(three.js + 무대)은 번들에 넣지 않고 **뽑기를 누른 순간 처음 읽는다** —
 * 로비까지 가는 길에 그만큼을 기다리게 하지 않기 위해서다.
 *
 * 뿌리 요소는 캔버스와 **정확히 같은 상자**에 앉는다. 화면 전체를 덮으면 레터박스까지 연출이
 * 새어 나가고, 무엇보다 우하단 건너뛰기가 다른 탭의 뒤로가기와 다른 자리에 선다.
 *
 * 묶음을 못 읽거나 WebGL이 없는 기기는 **성공을 흉내 내지 않고** `null`을 돌려준다. 씬은 그때
 * 예전의 Phaser 연출로 되돌아간다.
 */

import type Phaser from "phaser";
import { activeFontFamily, FONT_FALLBACK } from "./fonts";
import { bakeCinematicFace, bakeCinematicIcon, bakeCinematicPortrait, prewarmCinematicArt } from "./researchCinematicArt";
import type { CinematicCardArt, CinematicReward } from "./researchCinematicModel";

const SCRIPT_URL = "cinematic/researchCinematic.js";
const STYLE_URL = "cinematic/researchCinematic.css";

/** 에셋이 `window`에 내놓는 것. 이름은 그 파일의 꼬리와 정확히 같아야 한다. */
interface CinematicBundle {
  Cinematic: new (root: HTMLElement, options: CinematicOptions) => CinematicInstance;
  text: { gray: string };
  tiers: Record<string, { color: string; duration: number; level: number }>;
}

interface CinematicOptions {
  rewards: readonly CinematicReward[];
  reducedMotion?: boolean;
  maxPixelRatio?: number;
  onComplete?: (rewards: readonly CinematicReward[]) => void;
  onContextLost?: () => void;
}

interface CinematicInstance {
  start(): void;
  /** 방금 넘긴 걸음과 그 칸. 뒤집힌 순간을 화면이 알아야 중복이 파편으로 바뀐다. */
  revealStep?: "tier" | "flip" | "next";
  revealIndex?: number;
  /** 한 걸음 넘긴다. 공개 단계에서는 등급 한 칸 → 뒤집기 → 다음 칸 순서다. */
  advance(): void;
  /** 다음 한 걸음이 무엇일지 넘기지 않고 본다. 공개 단계가 아니면 비어 있다. */
  peekReveal?(): { index: number; step: "tier" | "flip" | "next" } | undefined;
  /** 남은 연출을 건너뛰고 **결산 화면으로 곧장** 간다. 판을 지우지 않는다. */
  skipToResult(): void;
  destroy(): void;
  getState(): { phase: string; count: number; activeTier: string };
}

declare global {
  interface Window {
    __RESEARCH_CINEMATIC__?: CinematicBundle;
  }
}

/** 화면에 서는 낱말. 씬이 문구 표에서 골라 넘긴다 — 에셋은 문장을 들고 있지 않는다. */
export interface ResearchCinematicText {
  /** 건너뛰기 칩에 서는 짧은 낱말. */
  skip: string;
  /** 회색 카드의 등급 자리에 서는 낱말. */
  gray: string;
  /** 표본 블록의 세 줄. 세계관 안의 명칭만 적는다. */
  specimen: { code: string; name: string; note: string };
}

export interface ResearchCinematicOptions {
  /** 연출을 덮어씌울 게임 캔버스. 뿌리 요소가 이 상자를 그대로 따라간다. */
  canvas: HTMLCanvasElement;
  /** 원화를 굽는 데 쓸 씬. 게임이 이미 올려 둔 텍스처를 그대로 읽는다. */
  scene: Phaser.Scene;
  rewards: readonly CinematicReward[];
  /** 카드마다 무엇을 세울지. 순서는 `rewards`와 같다. */
  art: readonly CinematicCardArt[];
  reducedMotion: boolean;
  text: ResearchCinematicText;
  /**
   * 새로 만난 렐릭의 카드가 **뒤집히기 직전에** 부른다. 판은 그동안 숨고 게임이 손을 받는다.
   * 약속이 풀리면 판이 돌아와 그 카드를 뒤집는다.
   */
  introduce?: (index: number) => Promise<void>;
  /**
   * 소개 장면을 돌릴 칸. 적지 않으면 새로 만난 렐릭(원화 카드) 칸이다 — SSR은 중복이어도
   * 소개하므로 씬이 `showcaseRelicIds`에서 골라 넘긴다.
   */
  introduceSlots?: readonly number[];
}

let assetPromise: Promise<CinematicBundle> | undefined;

/** 묶음을 한 번만 읽는다. 실패하면 다음 뽑기에서 다시 시도할 수 있게 약속을 버린다. */
function loadAsset(): Promise<CinematicBundle> {
  if (window.__RESEARCH_CINEMATIC__) return Promise.resolve(window.__RESEARCH_CINEMATIC__);
  assetPromise ??= new Promise<CinematicBundle>((resolve, reject) => {
    const base = document.baseURI;
    if (!document.querySelector(`link[data-research-cinematic]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = new URL(STYLE_URL, base).href;
      link.dataset.researchCinematic = "";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = new URL(SCRIPT_URL, base).href;
    script.async = true;
    script.onload = () => {
      const bundle = window.__RESEARCH_CINEMATIC__;
      if (bundle) resolve(bundle);
      else reject(new Error("cinematic bundle did not register"));
    };
    script.onerror = () => reject(new Error("cinematic bundle failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    assetPromise = undefined;
    throw error;
  });
  return assetPromise;
}

/**
 * 지금 빌드에서 시네마틱을 세워도 되는가.
 *
 * E2E 빌드에서는 세우지 않는다. GPU 없는 컨테이너의 소프트웨어 렌더러는 three.js의 합성
 * 한 프레임에 수백 ms를 쓰므로, 열두 초짜리 연출 한 판이 실제로는 수 분이 된다 — 확인하려던
 * 것(뽑기가 결과를 낸다)은 확인하지 못하고 기다림만 늘어난다. 그래서 그 빌드는 Phaser 연출
 * 경로를 그대로 타고, 이 경계 자체는 `tests/unit/researchCinematic.test.ts`가 지킨다.
 */
/**
 * 묶음만 미리 읽는다. 타이틀 로딩이 부른다 — 첫 뽑기에서 570KB를 받고 파싱하느라 화면이 멎지 않게.
 * 세울 수 없는 환경이면 아무것도 하지 않고, 실패해도 뽑기에서 다시 시도한다.
 */
export function preloadResearchCinematic(): Promise<void> {
  if (!researchCinematicEnabled() || !supportsWebgl2()) return Promise.resolve();
  return loadAsset().then(() => undefined, () => undefined);
}

export function researchCinematicEnabled(): boolean {
  return import.meta.env.MODE !== "test";
}

/** WebGL2가 없는 기기에서는 묶음을 읽어도 무대가 서지 않는다. 읽기 전에 먼저 본다. */
function supportsWebgl2(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * 뿌리 DOM.
 *
 * 임시 제목·횟수 고르기·등급 미리보기·하단 터미널과 진행 게이지는 세우지 않는다 — 조작을
 * 바꾸지 않는 글이고, 뽑기 버튼은 이미 연구소 화면이 갖고 있다. 아이디는 에셋이 찾는 이름
 * 그대로여야 하며, 여기 없는 것은 에셋이 붙어 있지 않은 조각에 조용히 쓴다.
 */
function buildMarkup(text: ResearchCinematicText): string {
  return `
<div id="stage" aria-hidden="true"></div>
<div class="rc-vignette"></div>
<div class="rc-noise"></div>
<div class="rc-ui">
  <div class="rc-sequence">
    <div class="rc-small" id="sequence-code">SEQUENCE 01 / 03</div>
    <h2 id="sequence-title">DNA SYNC.</h2>
    <div class="stage-ticks"><i></i><i></i><i></i></div>
  </div>
  <div class="rc-reticle"><i></i><i></i><i></i><i></i></div>
  <div class="rc-meta">CORE STATUS<br><b id="core-status">STABLE</b><br>────────<br>DNA <em id="dna">00.0</em>%</div>
  <div class="rc-cross">+</div>
  <div class="rc-specimen">${escapeHtml(text.specimen.code)}<b>${escapeHtml(text.specimen.name)}</b>${escapeHtml(text.specimen.note)}</div>
  <div class="rc-aura"></div>
  <div class="cards" id="cards"></div>
  <div class="rc-callout"><span id="card-step"></span><strong id="card-tier"></strong></div>
  <div class="rc-counts" id="tier-counts"></div>
  <button id="skip" class="rc-skip" type="button">${escapeHtml(text.skip)}</button>
  <button id="primary" class="rc-hidden" type="button" tabindex="-1" aria-hidden="true"></button>
</div>
<div class="rc-scanline" id="scanline"></div>
<div class="rc-flash" id="flash"></div>
<div class="rc-impact" id="impact-word">AWAKEN.</div>
<div id="loading" class="rc-loading"><i></i><i></i><i></i></div>`;
}

/**
 * 카드 그림을 굽는 크기.
 *
 * 카드와 **같은 비율**(0.66)로 굽는다 — 원화가 카드를 가장자리까지 채우기 때문이다. 액자 안에
 * 정사각으로 넣으면 인물이 아이콘처럼 잘려 그리드 카드와 다른 그림이 된다. 화면 크기마다
 * 굽지 않고 비율만 맞춰 한 번 굽는다.
 */
const PORTRAIT_BAKE = { width: 440, height: 667 } as const;
const FACE_BAKE = 192;

/**
 * 중복이 파편으로 바뀌기까지.
 *
 * 뒤집히는 순간 곧바로 파편이면 누구를 만났는지 읽을 새가 없다. 뒤집힘(0.45초)이 끝나고 한 박자
 * 더 두었다가 섬광과 함께 바뀐다.
 */
const SHATTER_DELAY_MS = 900;

function imageOf(url: string, className: string): HTMLImageElement {
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.className = className;
  return image;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] ?? ch));
}

/**
 * 시네마틱 한 판.
 *
 * 열고 나면 끝날 때까지 `done`이 기다린다. 건너뛰기든 마지막 카드든 같은 약속 하나로 끝나며,
 * 결과 화면에서 화면 아무 곳이나 누르면 닫힌다 — 고를 것이 없는 영수증이라 확인 버튼을
 * 두지 않는다.
 */
export class ResearchCinematic {
  private readonly root: HTMLElement;
  private readonly instance: CinematicInstance;
  private readonly canvas: HTMLCanvasElement;
  private readonly game: Phaser.Game;
  private readonly observer: ResizeObserver;
  private readonly onWindowChange = () => this.syncBox();
  private settle?: () => void;
  private closed = false;
  /** 연출이 떠 있는 동안 게임이 받던 입력. 닫을 때 그대로 되돌린다. */
  private readonly inputWasEnabled: boolean;
  /** 결산까지 실제로 흘렀는지. 검사 채널이 읽는다. */
  private reachedResult = false;
  /** 카드마다 무엇이 서는지. 뒤집힌 칸이 중복인지 볼 때 읽는다. */
  private readonly art: readonly CinematicCardArt[];
  /** 파편으로 바뀌기를 기다리는 타이머. 판을 닫을 때 남김없이 걷는다. */
  private readonly timers = new Set<number>();
  /**
   * 이미 파편이 된 칸.
   *
   * DOM이 아니라 **상태로** 기억한다 — 그림을 굽는 사이에 건너뛰기가 들어오면 그 칸은 아직
   * 액자도 서기 전이라, 화면만 보고 바꾸면 늦게 도착한 원화가 파편을 덮어쓴다.
   */
  private readonly shattered = new Set<number>();
  /** 소개 장면을 이미 본 새 렐릭 칸. 같은 개체를 두 번 소개하지 않는다. */
  private readonly introduced = new Set<number>();
  /** 소개 장면이 도는 동안에는 판이 손을 받지 않는다. */
  private introducing = false;
  private readonly introduce?: (index: number) => Promise<void>;
  private readonly introduceSlots: ReadonlySet<number>;

  private constructor(bundle: CinematicBundle, options: ResearchCinematicOptions) {
    this.canvas = options.canvas;
    this.game = options.scene.game;
    this.art = options.art;
    this.introduce = options.introduce;
    this.introduceSlots = new Set(options.introduceSlots
      ?? options.art.flatMap((slot, index) => (slot.frame === "portrait" ? [index] : [])));
    bundle.text.gray = options.text.gray;
    /*
     * **게임의 입력을 끈다.**
     *
     * Phaser는 캔버스 밖에서 손을 떼는 것도 받으려고 `pointerup`을 window에도 건다. 그래서
     * 캔버스 위를 덮은 이 판을 눌러도 그 아래 좌표의 버튼이 함께 눌렸다 — 우하단 건너뛰기가
     * 하단 탭의 프리미엄 자리와 겹쳐, 건너뛰면 연출이 끝나는 대신 화면이 통째로 넘어갔다.
     * 판이 떠 있는 동안은 게임이 손을 받지 않는다.
     */
    this.inputWasEnabled = this.game.input.enabled;
    this.game.input.enabled = false;

    const root = document.createElement("div");
    root.className = "rc-root";
    root.dataset.phase = "idle";
    root.style.setProperty("--rc-font", `"${activeFontFamily()}", ${FONT_FALLBACK}`);
    root.innerHTML = buildMarkup(options.text);
    document.body.appendChild(root);
    this.root = root;

    // 연출을 재촉하는 손은 화면 **전체**가 받는다. 균열에서는 그 손이 깨는 순간을 앞당기고,
    // 결과 화면에서는 판을 닫는다 — 눌러야 하는 자리를 따로 세우지 않는다.
    /*
     * **판 위의 손은 판 밖으로 새지 않는다.**
     *
     * Phaser가 `pointerup`을 window에도 걸어 두므로, 여기서 멈추지 않으면 같은 한 번이 판을
     * 닫고 나서 그 아래 좌표의 하단 탭까지 누른다 — 결산에서 화면 밑동을 누르면 뒤의 탭이
     * 함께 눌리던 원인이다. 게임 입력을 끄는 것만으로는 모자랐다: 판을 닫는 그 순간 입력을
     * 되돌리므로, 같은 사건이 window에 닿을 때는 이미 켜져 있었다.
     */
    // **잡는 단계(capture)에서 멈추지 않는다.** 같은 요소에서 잡는 단계에 끊으면 그 요소의
    // 거품 단계 처리기까지 함께 죽어, 화면을 눌러도 아무 일이 일어나지 않는다.
    for (const kind of ["pointerdown", "pointercancel", "click"] as const) {
      root.addEventListener(kind, (event) => event.stopPropagation());
    }
    root.addEventListener("pointerup", (event) => {
      event.stopPropagation();
      if (event.target instanceof Element && event.target.closest(".rc-skip")) return;
      this.tap();
    });
    root.querySelector(".rc-skip")?.addEventListener("click", () => this.skip());

    this.instance = new bundle.Cinematic(root, {
      rewards: options.rewards,
      reducedMotion: options.reducedMotion,
      onComplete: () => { this.settleResult(); },
      onContextLost: () => { this.close(); },
    });
    // 카드가 깔린 **뒤에** 그림을 채운다. 무대가 도는 동안 뒤에서 구우므로 연출이 기다리지 않고,
    // 공개 단계에 닿기 전에 도착한다. 묶음 하나가 늦거나 실패해도 그 칸만 액자로 남는다.
    this.paintCards(options.scene, options.art);

    this.observer = new ResizeObserver(() => this.syncBox());
    this.observer.observe(this.canvas);
    window.addEventListener("resize", this.onWindowChange);
    window.addEventListener("orientationchange", this.onWindowChange);
    this.syncBox();
    this.instance.start();
  }

  /**
   * 시네마틱을 연다.
   *
   * 묶음이 없거나 WebGL2가 없으면 `null`이다 — 씬은 그때 예전 연출로 되돌아간다.
   */
  static async open(options: ResearchCinematicOptions): Promise<ResearchCinematic | null> {
    if (!supportsWebgl2()) return null;
    // 묶음을 내려받는 동안 원화를 미리 굽는다 — 판이 뜨자마자 카드가 제 그림을 갖는다.
    prewarmCinematicArt(options.scene, options.art, PORTRAIT_BAKE, FACE_BAKE);
    try {
      const bundle = await loadAsset();
      return new ResearchCinematic(bundle, options);
    } catch {
      return null;
    }
  }

  /** 지금 몇 장 중 몇 장이 공개됐는지. 검사 채널이 읽는 값이라 화면에는 서지 않는다. */
  get revealed(): number {
    return this.root.querySelectorAll(".archive-card.collected").length;
  }

  get phase(): string {
    return this.root.dataset.phase ?? "idle";
  }

  /** 결산 격자까지 흘렀는가. */
  get finished(): boolean {
    return this.reachedResult;
  }

  /** 연출이 끝나고 화면이 닫힐 때까지 기다린다. */
  done(): Promise<void> {
    if (this.closed) return Promise.resolve();
    return new Promise<void>((resolve) => { this.settle = resolve; });
  }

  /**
   * 결산으로 곧장 간다.
   *
   * 판을 지우는 것이 아니다 — 남은 카드를 전부 공개한 결산 격자를 보여 주고, 거기서 화면을
   * 누르면 닫힌다. 보상은 이미 서버가 확정했으므로 건너뛴다고 달라지는 것은 없다.
   */
  skip(): void {
    if (this.introducing) return;
    if (this.phase === "result") { this.close(); return; }
    void this.skipAfterIntroductions();
  }

  /**
   * 건너뛰어도 **아직 소개하지 않은 새 렐릭은 먼저 차례로 소개한다.** 결산 격자에서 처음 보는
   * 얼굴이 카드 한 장으로만 지나가면 "새로 왔다"가 읽히지 않는다.
   */
  private async skipAfterIntroductions(): Promise<void> {
    for (const index of this.pendingIntroductions()) {
      await this.runIntroduction(index);
      if (this.closed) return;
    }
    this.instance.skipToResult();
  }

  /** 아직 소개하지 않은 새 렐릭 칸. 카드 순서대로다. */
  private pendingIntroductions(): number[] {
    if (!this.introduce) return [];
    return this.art.flatMap((_, index) => (this.introduceSlots.has(index) && !this.introduced.has(index) ? [index] : []));
  }

  /**
   * 소개 장면 한 번.
   *
   * 판을 숨기고 게임에 손을 돌려준다 — 장면은 Phaser가 그리고(원화가 Puppet이다) 누르는 것도
   * 그 장면이 받는다. 입력은 지금 도는 사건이 지나간 **다음에** 켠다. 곧바로 켜면 판을 누른 그
   * 한 번이 window까지 흘러가 막 뜬 장면을 넘겨 버린다.
   */
  private async runIntroduction(index: number): Promise<void> {
    if (!this.introduce || this.introduced.has(index)) return;
    this.introduced.add(index);
    this.introducing = true;
    // `visibility`로 숨기지 않는다 — 카드 층(`.cards.opening`·`.overview`)이 제 `visibility: visible`을
    // 들고 있어 부모가 숨어도 카드만 그대로 떠, 소개 장면이 카드 **아래**에 깔렸다. 판 전체를
    // 투명하게 하고 손도 통과시켜 그 아래 캔버스(소개 장면)가 받게 한다.
    //
    // **판은 소개 장면이 한 번 그려진 뒤에 숨긴다.** 먼저 숨기면 소개 장면이 캔버스에 서기 전의
    // 한 프레임 동안 그 아래의 연구소 화면이 그대로 드러나, 뽑기 화면으로 한 번 튕겨 나갔다가
    // 소개가 뜨는 것처럼 보였다. 손은 곧바로 캔버스로 넘기고, 보이는 것만 한 박자 늦춘다.
    this.root.style.pointerEvents = "none";
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    if (!this.closed) this.game.input.enabled = true;
    try {
      const introduced = this.introduce(index);
      await this.afterNextGameFrame();
      if (!this.closed && this.introducing) this.root.style.opacity = "0";
      await introduced;
    } finally {
      this.introducing = false;
      if (!this.closed) {
        this.game.input.enabled = false;
        this.root.style.opacity = "";
        this.root.style.pointerEvents = "";
      }
    }
  }

  /**
   * 게임 캔버스가 한 번 더 그려질 때까지 기다린다. 그린 직후에 판을 숨겨야 그 사이에 뒤 화면이
   * 드러나지 않는다. 게임 루프가 멈춰 있어도(탭이 숨는 등) 갇히지 않도록 상한을 둔다.
   */
  private afterNextGameFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.game.events.off("postrender", finish);
        // postrender는 그린 직후지만 화면에 붙는 것은 다음 합성이다 — 한 프레임 더 넘긴다.
        requestAnimationFrame(() => resolve());
      };
      this.game.events.once("postrender", finish);
      window.setTimeout(finish, 250);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    // 입력은 지금 도는 사건이 지나간 **다음에** 되돌린다. 여기서 곧바로 켜면 판을 닫은 그
    // 한 번이 window까지 흘러가 뒤의 탭을 누른다.
    const restore = this.inputWasEnabled;
    window.setTimeout(() => { this.game.input.enabled = restore; }, 0);
    this.observer.disconnect();
    window.removeEventListener("resize", this.onWindowChange);
    window.removeEventListener("orientationchange", this.onWindowChange);
    try { this.instance.destroy(); } catch { /* 무대가 이미 죽었어도 화면은 치운다. */ }
    this.root.remove();
    this.settle?.();
    this.settle = undefined;
  }

  /**
   * 결과 화면에 닿았다.
   *
   * 여기서 닫지 않는다 — 결산 격자를 한 번은 보여 줘야 하고, 닫는 것은 화면을 누르는 손이다.
   */
  private settleResult(): void {
    this.reachedResult = true;
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    // 건너뛰어 곧장 온 칸도 파편으로 세운다. 격자에 원화와 파편이 섞이면 무엇이 중복인지
    // 읽히지 않는다.
    this.art.forEach((slot, index) => { if (slot.frame === "face") this.shatter(index, true); });
  }

  /**
   * 화면을 누른 한 번.
   *
   * 연출은 시간이 아니라 이 손이 넘긴다 — 스캔에서 균열로, 균열에서 폭발로, 공개에서는
   * **등급 한 칸 → 뒤집기 → 다음 칸** 순서다. 결산에서는 판을 닫는다.
   */
  private tap(): void {
    if (this.introducing) return;
    if (this.phase === "result") { this.close(); return; }
    const next = this.instance.peekReveal?.();
    if (next?.step === "flip" && this.introduceSlots.has(next.index) && !this.introduced.has(next.index) && this.introduce) {
      // 새로 만난 렐릭 — 카드를 뒤집기 **전에** 먼저 소개하고, 돌아와서 뒤집는다.
      void this.runIntroduction(next.index).then(() => {
        if (this.closed) return;
        this.instance.advance();
        this.scheduleShatter();
      });
      return;
    }
    this.instance.advance();
    this.scheduleShatter();
  }

  /**
   * 카드마다 무엇을 세울지 채운다.
   *
   * 결과판과 **같은 규칙**이다 — 새로 만난 렐릭만 실제 원화가 카드를 채우고, 중복 파편과
   * 재화는 액자 한 장에 수량이 우하단으로 겹친다. 도형 아이콘으로 대신하면 같은 골드가
   * 뽑기에서만 다른 그림으로 서게 된다.
   *
   * 그림은 뒤에서 굽는다. 묶음 하나가 늦거나 실패해도 그 칸은 액자만 남고 연출은 이어진다.
   */
  private paintCards(scene: Phaser.Scene, art: readonly CinematicCardArt[]): void {
    const cards = Array.from(this.root.querySelectorAll<HTMLElement>(".archive-card"));
    // 1) 뼈대는 **기다리지 않고 한 번에** 세운다.
    for (const [index, card] of cards.entries()) {
      const slot = art[index];
      const box = card.querySelector<HTMLElement>(".card-art");
      if (!slot || !box) continue;
      box.replaceChildren();
      if (slot.frame === "icon") {
        // 재화는 원화가 없다. 액자 한 장이 칸 안에 서고 수량이 우하단에 겹친다.
        box.className = "card-art card-art-framed";
        box.appendChild(this.buildFrame(slot.amount));
        continue;
      }
      /*
       * 렐릭은 신규든 중복이든 **원화가 카드를 가장자리까지 채운다.**
       *
       * 중복은 그 위에 파편 액자를 미리 숨겨 두었다가, 뒤집힌 뒤 한 박자 지나면 섬광과 함께
       * 갈아 끼운다 — 누구를 만났는지 먼저 읽히고, 그다음에 "이미 가진 개체였다"가 온다.
       */
      box.className = "card-art card-art-portrait";
      if (slot.frame !== "face") continue;
      box.appendChild(this.buildFrame(slot.amount));
      const flash = document.createElement("span");
      flash.className = "rc-shatter-flash";
      box.appendChild(flash);
      this.applyShattered(index, box);
    }
    // 2) 굽는 일만 **나란히** 돌린다. 하나가 늦거나 실패해도 나머지는 제 그림을 받는다.
    for (const [index, card] of cards.entries()) void this.fillCard(scene, art[index], index, card);
  }

  /**
   * 구운 그림을 제자리에 끼운다.
   *
   * 칸마다 따로 돌기 때문에 **순서를 기다리지 않는다** — 한 장씩 차례로 구우면 열 장짜리 판의
   * 뒤쪽 두어 칸이 아직 차례도 오기 전에 건너뛰기가 들어와, 결산에 그림 없는 칸이 남았다.
   * 굽는 사이에 결산에 닿았다면 그 칸은 곧바로 파편으로 세운다.
   */
  private async fillCard(
    scene: Phaser.Scene,
    slot: CinematicCardArt | undefined,
    index: number,
    card: HTMLElement,
  ): Promise<void> {
    const box = card.querySelector<HTMLElement>(".card-art");
    if (!slot || !box) return;
    if (slot.frame === "icon") {
      const url = bakeCinematicIcon(scene, slot.iconKey, FACE_BAKE);
      if (url && !this.closed) box.querySelector(".rc-item-plate")?.appendChild(imageOf(url, "rc-item-icon"));
      return;
    }
    const portrait = await bakeCinematicPortrait(scene, slot.portraitAssetId, PORTRAIT_BAKE.width, PORTRAIT_BAKE.height);
    if (this.closed) return;
    if (portrait) box.insertBefore(imageOf(portrait, "character-art"), box.firstChild);
    if (slot.frame !== "face") return;
    const face = await bakeCinematicFace(scene, slot.portraitAssetId, FACE_BAKE);
    if (this.closed) return;
    // 얼굴은 액자를 꽉 채우고(구울 때 모서리를 지웠다) 재화 아이콘만 사방 여백이 규격이다.
    if (face) box.querySelector(".rc-item-plate")?.appendChild(imageOf(face, "rc-item-face"));
    this.applyShattered(index, box);
  }

  /** 게임의 아이템 액자 한 장. 깎인 판과, 그 위에 깎이지 않고 얹히는 수량 두 겹이다. */
  private buildFrame(amount: string): HTMLElement {
    const frame = document.createElement("div");
    frame.className = "rc-item-frame";
    const plate = document.createElement("div");
    plate.className = "rc-item-plate";
    const label = document.createElement("span");
    label.className = "rc-item-amount";
    label.textContent = amount;
    frame.append(plate, label);
    return frame;
  }

  /**
   * 중복 카드를 파편으로 갈아 끼운다.
   *
   * 뒤집은 그 칸만, 한 번만 바꾼다. 건너뛰어 결산으로 바로 간 칸은 기다리지 않고 곧바로
   * 바뀐다 — 결산 격자에 원화와 파편이 섞여 있으면 무엇이 중복인지 읽히지 않는다.
   */
  private shatter(index: number, instant: boolean): void {
    if (this.shattered.has(index)) return;
    this.shattered.add(index);
    const card = this.root.querySelectorAll<HTMLElement>(".archive-card")[index];
    const box = card?.querySelector<HTMLElement>(".card-art");
    if (!box) return;
    box.className = instant ? "card-art card-art-framed" : "card-art card-art-framed rc-shattering";
  }

  /** 뼈대나 그림이 늦게 선 칸에 이미 정해진 파편 상태를 입힌다. 섬광은 다시 켜지 않는다. */
  private applyShattered(index: number, box: HTMLElement): void {
    if (this.shattered.has(index)) box.className = "card-art card-art-framed";
  }

  /** 방금 넘긴 걸음이 중복 카드의 뒤집기였다면, 한 박자 뒤에 파편으로 바꾼다. */
  private scheduleShatter(): void {
    const index = this.instance.revealIndex;
    if (this.instance.revealStep !== "flip" || index === undefined) return;
    if (this.art[index]?.frame !== "face") return;
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (!this.closed) this.shatter(index, false);
    }, SHATTER_DELAY_MS);
    this.timers.add(timer);
  }

  /** 뿌리 상자를 캔버스에 맞춘다. 캔버스가 레터박스로 줄어들면 연출도 같이 줄어든다. */
  private syncBox(): void {
    const box = this.canvas.getBoundingClientRect();
    const style = this.root.style;
    style.left = `${box.left}px`;
    style.top = `${box.top}px`;
    style.width = `${box.width}px`;
    style.height = `${box.height}px`;
  }
}
