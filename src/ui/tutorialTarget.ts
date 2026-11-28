import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { TutorialSpotlight, type TutorialSpotlightOptions } from "./TutorialSpotlight";
import { raiseSettingsAccess } from "./settingsAccess";

type Rect = { x: number; y: number; width: number; height: number };
/** 실제 입력 대상의 수명을 따라간다. 다른 창이 가리면 걷고 돌아오면 다시 가리킨다. */
export function followTutorialTarget(scene: Phaser.Scene, options: {
  enabled: () => boolean; rect: () => Rect | undefined; text: () => string;
  blocked?: () => boolean;
  /** 끌어 옮길 길이 있는 칸은 휘어진 화살표로 그 길을 긋는다. */
  guide?: () => TutorialSpotlightOptions["guide"];
  /** 화면을 막지 않고 가리키기만 한다(`TutorialSpotlight.passive`). 기다리는 동안에도 화면을 잠그지 않는다. */
  passive?: boolean | (() => boolean);
  /** 구멍 둘레가 숨 쉬듯 번진다(`TutorialSpotlight.pulse`) — 꼭 눌러야 할 자리를 한 번 더 짚는다. */
  pulse?: () => boolean;
  /** 안내 글이 설 쪽. 없으면 대상이 화면 위쪽이면 아래, 아니면 위다. */
  side?: () => "above" | "below" | undefined;
  /** 누를 대상이 없는 알림 칸 — 화면 아무 곳이나 누르면 불린다(`TutorialSpotlight.onAdvance`). */
  onAdvance?: () => void;
  /** 안내 글 곁의 작은 한 줄(「화면을 눌러 확인」 등). */
  hint?: () => string;
  /** 가리킬 것의 실루엣(씬 좌표) — 주면 강조가 네모가 아니라 그 모양을 따른다(`TutorialSpotlight.shape`). */
  shape?: () => ReadonlyArray<{ x: number; y: number }> | undefined;
  /** 구멍에서 안내 글까지의 거리(`TutorialSpotlight.textGap`) — 글이 가리킬 것 곁의 다른 칸을 덮지 않게 비켜 세운다. */
  textGap?: () => number | undefined;
  /** 어둠만 걷고 손은 받지 않는 곁 자리(`TutorialSpotlight.reveal`). */
  reveal?: () => ReadonlyArray<Rect> | undefined;
}): () => void {
  let stopped = false, spotlight: TutorialSpotlight | undefined, signature = "";
  let waiting: Phaser.GameObjects.Rectangle | undefined;
  /** 다음 칸을 기다리며 화면을 잠그는 동안에도 설정은 열린다(창이 떠 있으면 그 창 아래라 올리지 않는다). */
  let releaseSettings: (() => void) | undefined;
  const dropWaiting = () => { waiting?.destroy(); waiting = undefined; releaseSettings?.(); releaseSettings = undefined; };
  const clear = () => { spotlight?.destroy(); spotlight = undefined; signature = ""; };
  const stop = () => { stopped = true; scene.events.off(Phaser.Scenes.Events.PRE_UPDATE, poll); scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop); clear(); dropWaiting(); };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
  const poll = () => {
    if (stopped || !scene.scene.isActive()) return;
    if (!options.enabled()) { stop(); return; }
    const modal = options.blocked?.() === true;
    const passive = typeof options.passive === "function" ? options.passive() : options.passive === true;
    const rect = modal ? undefined : options.rect();
    if (!rect) {
      clear();
      if (passive) return;
      // 대기 중에도 원래 화면은 잠근다. 열린 팝업은 이 막 위에서 정상 입력을 받는다.
      waiting ??= scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0, 0).setInteractive();
      waiting.setDepth(modal ? 999 : 6000);
      if (modal) { releaseSettings?.(); releaseSettings = undefined; }
      else releaseSettings ??= raiseSettingsAccess(scene, 6000);
    }
    else {
      dropWaiting();
      const text = options.text();
      const guide = options.guide?.();
      const hint = options.hint?.();
      const pulse = options.pulse?.() === true;
      const shape = options.shape?.();
      const textGap = options.textGap?.();
      const reveal = options.reveal?.();
      const next = JSON.stringify([rect.x, rect.y, rect.width, rect.height, text, guide, options.side?.(), hint, passive, pulse, textGap, reveal, shape?.map((p) => [Math.round(p.x), Math.round(p.y)])]);
      if (next !== signature) {
        // 처음 서는 안내만 번져 들어온다 — 자리만 옮겨 다시 세우는 안내까지 번지면 깜빡인다.
        const enter = !spotlight;
        clear(); signature = next;
        spotlight = new TutorialSpotlight(scene, { rect, text, guide, hint, side: options.side?.() ?? (rect.y < 700 ? "below" : "above"), onAdvance: options.onAdvance, passive, pulse, shape, textGap, reveal, enter });
      }
    }
  };
  // 생성 직후와 매 프레임 갱신해 안내 사이의 입력 공백을 없앤다.
  scene.events.on(Phaser.Scenes.Events.PRE_UPDATE, poll);
  // 팝업 본문을 조립하는 중에는 isOpen이 아직 false일 수 있어 첫 프레임에 다시 확인한다.
  if (options.enabled()) poll();
  return stop;
}
