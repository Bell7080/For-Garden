/**
 * SSR 전조 — 3D 한 장.
 *
 * `scripts/prepare_ssr_omen.py`가 `docs/reference/ssr-omen-cinematic.html`에서 구운 three.js 무대를
 * 게임 캔버스와 같은 상자에 겹쳐 태운다. 검은 화석이 네 번 울리며 갈라지는데 울림 사이가 점점
 * 짧아지고(콰지지직), 터지는 순간 호박빛 섬광이 번진다(팡). 그 정점에서 `onBurst`가 불리고
 * 소개 장면은 곧바로 대사 막으로 넘어간다 — 전체가 2초 남짓이다. 시간은 굽는 스크립트의
 * `OMEN_WARP` 한 표가 갖는다.
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
/** 판이 검게 덮이는 시간(샤락)과 끝난 뒤 걷히는 시간. */
const FADE_IN_MS = 110;
const FADE_OUT_MS = 240;

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
  /** 끝났거나(완주) 걷혔을 때(`stop`) 풀린다. */
  done: Promise<void>;
  /** 곧바로 걷는다. 두 번 불러도 된다. */
  stop(): void;
}

export interface SsrOmenOptions {
  reducedMotion: boolean;
  /** 효과음 최종 볼륨(0이면 소리 없음). */
  volume: number;
  /** 섬광 정점 — 대사 막을 열 순간. */
  onBurst: () => void;
}

/** 3D 전조를 연다. 세울 수 없으면 `undefined`다. */
export async function openSsrOmen(scene: Phaser.Scene, options: SsrOmenOptions): Promise<SsrOmenHandle | undefined> {
  const loading = preloadSsrOmen();
  if (!loading) return undefined;
  const bundle = await Promise.race([
    loading.catch(() => undefined),
    new Promise<undefined>((resolve) => window.setTimeout(() => resolve(undefined), LOAD_WAIT_MS)),
  ]);
  if (!bundle || !scene.sys.isActive()) return undefined;

  const canvas = scene.game.canvas;
  const root = document.createElement("div");
  const style = root.style;
  style.position = "fixed";
  style.zIndex = "41";
  style.overflow = "hidden";
  style.background = "#000";
  style.pointerEvents = "none";
  style.opacity = "0";
  style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
  const syncBox = () => {
    const box = canvas.getBoundingClientRect();
    style.left = `${box.left}px`;
    style.top = `${box.top}px`;
    style.width = `${box.width}px`;
    style.height = `${box.height}px`;
  };
  syncBox();
  const observer = new ResizeObserver(syncBox);
  observer.observe(canvas);
  document.body.appendChild(root);

  let omen: OmenInstance;
  try {
    omen = new bundle.Omen(root, {
      sound: options.volume > 0,
      volume: options.volume,
      reducedMotion: options.reducedMotion,
      onReveal: () => options.onBurst(),
    });
  } catch {
    observer.disconnect();
    root.remove();
    return undefined;
  }

  let settle!: () => void;
  const done = new Promise<void>((resolve) => { settle = resolve; });
  let closed = false;
  const close = (fadeMs: number) => {
    if (closed) return;
    closed = true;
    style.transition = `opacity ${fadeMs}ms ease-out`;
    style.opacity = "0";
    window.setTimeout(() => {
      observer.disconnect();
      try { omen.dispose(); } catch { /* 무대가 이미 죽었어도 판은 치운다. */ }
      root.remove();
      settle();
    }, fadeMs);
  };

  // 샤락 — 검은 판이 먼저 화면을 덮고 그 안에서 화석이 울린다.
  requestAnimationFrame(() => { style.opacity = "1"; });
  void omen.play().then(() => close(FADE_OUT_MS));
  // 씬이 내려가면 판도 함께 걷는다.
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => close(0));
  return { done, stop: () => close(FADE_OUT_MS / 2) };
}
