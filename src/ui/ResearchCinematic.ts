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
import { bakeCinematicFace, bakeCinematicIcon, bakeCinematicPortrait } from "./researchCinematicArt";
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
  /** 한 걸음 넘긴다. 공개 단계에서는 등급 한 칸 → 뒤집기 → 다음 칸 순서다. */
  advance(): void;
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

/** 카드 그림을 굽는 크기. 화면 크기마다 굽지 않고 비율만 맞춰 한 번 굽는다. */
const PORTRAIT_BAKE = { width: 420, height: 432 } as const;
const FACE_BAKE = 192;

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

  private constructor(bundle: CinematicBundle, options: ResearchCinematicOptions) {
    this.canvas = options.canvas;
    this.game = options.scene.game;
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
    root.addEventListener("pointerup", (event) => {
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
    void this.paintCards(options.scene, options.art);

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
    if (this.phase === "result") { this.close(); return; }
    this.instance.skipToResult();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.game.input.enabled = this.inputWasEnabled;
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
  }

  /**
   * 화면을 누른 한 번.
   *
   * 연출은 시간이 아니라 이 손이 넘긴다 — 스캔에서 균열로, 균열에서 폭발로, 공개에서는
   * **등급 한 칸 → 뒤집기 → 다음 칸** 순서다. 결산에서는 판을 닫는다.
   */
  private tap(): void {
    if (this.phase === "result") { this.close(); return; }
    this.instance.advance();
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
  private async paintCards(scene: Phaser.Scene, art: readonly CinematicCardArt[]): Promise<void> {
    const cards = Array.from(this.root.querySelectorAll<HTMLElement>(".archive-card"));
    for (const [index, card] of cards.entries()) {
      const slot = art[index];
      const box = card.querySelector<HTMLElement>(".card-art");
      if (!slot || !box) continue;
      if (slot.frame === "portrait") {
        box.className = "card-art card-art-portrait";
        box.replaceChildren();
        const url = await bakeCinematicPortrait(scene, slot.portraitAssetId, PORTRAIT_BAKE.width, PORTRAIT_BAKE.height);
        if (this.closed) return;
        if (url) box.appendChild(imageOf(url, "character-art"));
        continue;
      }
      // 액자는 그림이 오기 전에 먼저 선다 — 뒤늦게 액자가 생기면 카드가 한 번 조립되어 보인다.
      box.className = "card-art card-art-framed";
      const frame = document.createElement("div");
      frame.className = "rc-item-frame";
      // 깎인 판과, 그 위에 깎이지 않고 얹히는 수량 — 판 안에 수를 넣으면 빗변이 숫자를 자른다.
      const plate = document.createElement("div");
      plate.className = "rc-item-plate";
      const amount = document.createElement("span");
      amount.className = "rc-item-amount";
      amount.textContent = slot.amount;
      frame.append(plate, amount);
      box.replaceChildren(frame);
      const url = slot.frame === "face"
        ? await bakeCinematicFace(scene, slot.portraitAssetId, FACE_BAKE)
        : bakeCinematicIcon(scene, slot.iconKey, FACE_BAKE);
      if (this.closed) return;
      // 얼굴은 액자를 꽉 채우고(구울 때 모서리를 지웠다) 재화 아이콘만 사방 여백이 규격이다.
      if (url) plate.appendChild(imageOf(url, slot.frame === "face" ? "rc-item-face" : "rc-item-icon"));
    }
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
