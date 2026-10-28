import Phaser from "phaser";
import { audioManager } from "../managers/AudioManager";
import { BASE_WIDTH } from "../config/gameConfig";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { LOCK_TOAST, toastTextWrap, toastWidth } from "./lockStyle";
import { addPadlock } from "./Padlock";
import { COLOR, textStyle } from "./theme";

/**
 * - `locked` — 잠긴 콘텐츠를 눌렀다(자물쇠 + 「아직」 소리).
 * - `unlocked` — 막 열렸다(강조색 글자).
 * - `refused` — 재화 부족·조건 미충족·실패처럼 **누른 일이 되지 않았다**(흰 글자 + 「아직」 소리, 자물쇠 없음).
 * - `info` — 된 일을 알리기만 한다(강조색 글자, 소리 없음).
 */
export type ContentToastTone = "locked" | "unlocked" | "refused" | "info";

/** 장면마다 하나만 선다 — 연타하면 새 토스트가 이전 것을 대신한다. */
const live = new WeakMap<Phaser.Scene, Phaser.GameObjects.Container>();

/**
 * 짧은 안내 토스트의 **유일한 프리팹**. 잠긴 콘텐츠를 눌렀을 때·열린 직후·재화가 모자랄 때·조작이 거절됐을 때가
 * 모두 같은 자리·같은 판을 쓴다 — 화면마다 맨 글자를 띄우면 같은 「안 된다」가 어디서는 판, 어디서는 글자로 선다.
 *
 * 맨 글자는 밝은 배경 원화 위에서 읽히지 않으므로 어두운 유리 판이 글자를 받치고, 윗변에만 얇은 강조선을 긋는다
 * (사방 테두리는 두르지 않는다). 잠김은 자물쇠 아이콘이, 개방은 강조색 글자가 알린다. 값은 `lockStyle.ts`가 갖는다.
 */
export function showContentToast(scene: Phaser.Scene, message: string, tone: ContentToastTone): Phaser.GameObjects.Container {
  live.get(scene)?.destroy();
  const bright = tone === "unlocked" || tone === "info";
  const padlock = tone === "locked";
  // 막힌 손에는 막혔다는 소리로 답한다. 개방 소리는 자물쇠가 풀리는 연출(`playUnlockSequence`)이 낸다.
  if (!bright) audioManager?.playUi("ui.deny");
  const label = scene.add.text(0, 0, message, textStyle({ role: "emphasis", size: LOCK_TOAST.fontSize, color: bright ? COLOR.accentText : COLOR.ink, align: "center", wrap: toastTextWrap(padlock) })).setOrigin(0.5);
  const width = toastWidth(label.width, padlock);
  // 긴 거절 사유(소탕권·스테미나 안내)는 두 줄로 접히므로 판도 그만큼 키운다.
  const height = Math.max(LOCK_TOAST.height, Math.ceil(label.height) + LOCK_TOAST.padY * 2);
  const box = scene.add.container(BASE_WIDTH / 2, LOCK_TOAST.y).setDepth(LOCK_TOAST.depth);
  box.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: 22, bottomRight: 22 } }), {
    fill: 0x070b10, alpha: LOCK_TOAST.fillAlpha, edge: COLOR.accent, edgeAlpha: bright ? 0.95 : 0.6,
  }));
  if (!padlock) {
    box.add(label);
  } else {
    const iconSize = 40;
    const contentWidth = iconSize + LOCK_TOAST.iconGap + label.width;
    box.add(addPadlock(scene, -contentWidth / 2 + iconSize / 2, 0, iconSize, { color: COLOR.accent }));
    label.setOrigin(0, 0.5).setX(-contentWidth / 2 + iconSize + LOCK_TOAST.iconGap);
    box.add(label);
  }
  live.set(scene, box);
  box.once(Phaser.GameObjects.Events.DESTROY, () => { if (live.get(scene) === box) live.delete(scene); });

  const factor = motionPolicy(session.settings).nonEssentialDistanceFactor;
  const rise = LOCK_TOAST.riseDistance * factor;
  box.setAlpha(factor > 0 ? 0 : 1).setY(LOCK_TOAST.y + rise);
  scene.tweens.add({ targets: box, alpha: 1, y: LOCK_TOAST.y, duration: factor > 0 ? LOCK_TOAST.riseMs : 1, ease: "Cubic.easeOut" });
  scene.tweens.add({ targets: box, alpha: 0, delay: LOCK_TOAST.riseMs + LOCK_TOAST.holdMs, duration: LOCK_TOAST.fadeMs, onComplete: () => box.destroy() });
  return box;
}
