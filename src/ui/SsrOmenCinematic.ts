/**
 * SSR 전조 — 3D 한 장.
 *
 * `scripts/prepare_ssr_omen.py`가 `docs/reference/ssr-omen-cinematic.html`에서 구운 three.js 무대를
 * 게임 캔버스와 같은 상자에 겹쳐 태운다. 검은 화석이 네 번 울리며 갈라지는데 울림 사이가 점점
 * 짧아지고(콰지지직), 터지는 순간 호박빛 섬광이 번진다(팡). 그 정점에서 `onBurst`가 불리고
 * 소개 장면은 대사 막을 연다. 무대는 그 뒤로 **감속**하며 흩어지는 조각이 거의 멈춘 채로 대사 막
 * 위에서 천천히 걷힌다 — 끊기지 않고 이어진다. 시간은 굽는 스크립트의 `OMEN_WARP` 한 표가 갖는다.
 *
 * **무대는 한 번만 세우고 계속 쓴다**(`warmSsrOmen`). three.js 무대를 뽑을 때마다 새로 세우면
 * 셰이더 컴파일과 1024² 돌 질감 굽기가 그 순간에 몰려 SSR이 뜨는 자리에서 화면이 멎는다.
 * 연구소에 들어가 손이 노는 동안 한 번 세워 첫 장면까지 그려 두고, 그 뒤로는 판만 보였다 감춘다.
 *
 * **판은 손을 받지 않는다**(`pointer-events: none`). 누르는 것은 그 아래 캔버스의 소개 장면이
 * 받아 전조를 건너뛴다.
 *
 * **되돌아갈 길을 남긴다.** E2E 빌드이거나 WebGL2가 없거나 묶음이 제때 오지 않으면 `undefined`를
 * 돌려주고, 소개 장면은 Phaser로 그린 전조를 대신 돌린다. 성공을 흉내 내지 않는다.
 */

import Phaser from "phaser";

interface OmenInstance {
  play(): Promise<string>;
  cancel(): void;
  dispose(): void;
}

interface OmenBundle {
  Omen: new (container: HTMLElement, options: {
    sound?: boolean;
    volume?: number;
    reducedMotion?: boolean;
    onReveal?: () => void;
  }) => OmenInstance;
  duration: number;
}

declare global {
  interface Window {
    __SSR_OMEN__?: OmenBundle;
  }
}

const SCRIPT_URL = "cinematic/ssrOmen.js";
/** 묶음을 이만큼만 기다린다. 넘으면 이번 한 번은 Phaser 전조로 넘기고, 읽기는 뒤에서 마저 한다. */
const LOAD_WAIT_MS = 1500;
/** 판이 검게 덮이는 시간(샤락). */
const FADE_IN_MS = 110;
/** 섬광 정점 뒤 감속하는 무대가 대사 막 위에서 걷히는 시간. */
const HANDOFF_MS = 720;
/** 누르거나 씬이 내려가 곧바로 걷을 때. */
const QUICK_FADE_MS = 140;

let bundlePromise: Promise<OmenBundle> | undefined;

/** 묶음을 한 번만 읽는다. SSR이 나온 판에서 미리 불러 두면 전조가 기다리지 않는다. */
export function preloadSsrOmen(): Promise<OmenBundle> | undefined {
  if (!ssrOmenEnabled()) return undefined;
  if (window.__SSR_OMEN__) return Promise.resolve(window.__SSR_OMEN__);
  bundlePromise ??= new Promise<OmenBundle>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL(SCRIPT_URL, document.baseURI).href;
    script.async = true;
    script.onload = () => (window.__SSR_OMEN__ ? resolve(window.__SSR_OMEN__) : reject(new Error("ssr omen did not register")));
    script.onerror = () => reject(new Error("ssr omen failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    bundlePromise = undefined;
    throw error;
  });
  return bundlePromise;
}

/** GPU 없는 E2E 컨테이너에서는 합성 한 프레임이 수백 ms라 세우지 않는다(연구 시네마틱과 같은 이유). */
function ssrOmenEnabled(): boolean {
  if (import.meta.env.MODE === "test") return false;
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

export interface SsrOmenHandle {
  /** 무대가 다 걷혔을 때 풀린다. */
  done: Promise<void>;
  /** 걷는다 — 섬광 뒤에는 천천히(감속과 함께), 누른 경우에는 곧바로. 두 번 불러도 된다. */
  stop(quick?: boolean): void;
}

export interface SsrOmenOptions {
  reducedMotion: boolean;
  /** 효과음 최종 볼륨(0이면 소리 없음). */
  volume: number;
  /** 섬광 정점 — 대사 막을 열 순간. */
  onBurst: () => void;
}

/** 한 번 세워 계속 쓰는 무대. 판(`root`)은 캔버스와 같은 상자에 늘 붙어 있고 평소에는 숨는다. */
interface OmenStage {
  root: HTMLDivElement;
  omen: OmenInstance;
  reducedMotion: boolean;
  /** 지금 무대를 쓰는 판의 섬광 알림. */
  onReveal?: () => void;
  busy: boolean;
}

let stage: OmenStage | undefined;
let stagePromise: Promise<OmenStage | undefined> | undefined;

function hideRoot(root: HTMLDivElement): void {
  root.style.transition = "none";
  root.style.opacity = "0";
  root.style.visibility = "hidden";
}

async function buildStage(game: Phaser.Game, reducedMotion: boolean): Promise<OmenStage | undefined> {
  const loading = preloadSsrOmen();
  if (!loading) return undefined;
  const bundle = await loading.catch(() => undefined);
  if (!bundle) return undefined;
  const canvas = game.canvas;
  const root = document.createElement("div");
  const style = root.style;
  style.position = "fixed";
  style.zIndex = "41";
  style.overflow = "hidden";
  style.background = "#000";
  style.pointerEvents = "none";
  hideRoot(root);
  const syncBox = () => {
    const box = canvas.getBoundingClientRect();
    style.left = `${box.left}px`;
    style.top = `${box.top}px`;
    style.width = `${box.width}px`;
    style.height = `${box.height}px`;
  };
  syncBox();
  new ResizeObserver(syncBox).observe(canvas);
  document.body.appendChild(root);
  const built: OmenStage = { root, omen: undefined as unknown as OmenInstance, reducedMotion, busy: false };
  try {
    // 소리는 판마다 볼륨이 달라질 수 있어 켜 두고, 끈 경우만 판을 열 때 무음으로 돌린다.
    built.omen = new bundle.Omen(root, { sound: true, reducedMotion, onReveal: () => built.onReveal?.() });
  } catch {
    root.remove();
    return undefined;
  }
  return built;
}

/**
 * 무대를 미리 세운다. 연구소가 손이 노는 동안 부른다 — 첫 SSR이 뜨는 순간에 셰이더 컴파일이
 * 몰리지 않게 한다. 세울 수 없는 환경이면 아무것도 하지 않는다.
 */
export function warmSsrOmen(game: Phaser.Game, reducedMotion: boolean): Promise<OmenStage | undefined> {
  if (stage) return Promise.resolve(stage);
  stagePromise ??= buildStage(game, reducedMotion).then((built) => {
    stage = built;
    if (!built) stagePromise = undefined;
    return built;
  });
  return stagePromise;
}

/** 3D 전조를 연다. 세울 수 없으면 `undefined`다. */
export async function openSsrOmen(scene: Phaser.Scene, options: SsrOmenOptions): Promise<SsrOmenHandle | undefined> {
  if (!ssrOmenEnabled()) return undefined;
  const ready = await Promise.race([
    warmSsrOmen(scene.game, options.reducedMotion),
    new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), LOAD_WAIT_MS)),
  ]);
  if (!ready || ready.busy || !scene.sys.isActive()) return undefined;
  const current = ready;
  current.busy = true;
  const { root, omen } = current;
  const style = root.style;
  // 무대의 소리는 제 master 볼륨을 쓴다 — 판마다 게임의 효과음 볼륨으로 다시 맞춘다.
  const sound = (omen as unknown as { sound?: { volume?: number; master?: GainNode }; options: { sound?: boolean } });
  sound.options.sound = options.volume > 0;
  if (sound.sound) {
    sound.sound.volume = options.volume;
    if (sound.sound.master) sound.sound.master.gain.value = 0.52 * options.volume;
  }

  let settle!: () => void;
  const done = new Promise<void>((resolve) => { settle = resolve; });
  let closed = false;
  const close = (fadeMs: number) => {
    if (closed) return;
    closed = true;
    current.onReveal = undefined;
    style.transition = `opacity ${fadeMs}ms cubic-bezier(.2,.6,.3,1)`;
    style.opacity = "0";
    window.setTimeout(() => {
      try { omen.cancel(); } catch { /* 무대가 이미 멈췄어도 판은 숨긴다. */ }
      hideRoot(root);
      current.busy = false;
      settle();
    }, fadeMs);
  };

  current.onReveal = () => options.onBurst();
  // 샤락 — 검은 판이 먼저 화면을 덮고 그 안에서 화석이 울린다.
  style.visibility = "visible";
  style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
  requestAnimationFrame(() => { if (!closed) style.opacity = "1"; });
  void omen.play().then(() => close(QUICK_FADE_MS));
  // 씬이 내려가면 판도 함께 걷는다.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => close(0));
  return { done, stop: (quick = false) => close(quick ? QUICK_FADE_MS : HANDOFF_MS) };
}
