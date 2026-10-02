import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { ALL_GATED_CONTENT, CONTENT_STAGE_UNLOCKS, contentUnlockLevel, isContentUnlocked, type ContentId } from "../core/contentUnlock";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { COLOR, textStyle } from "./theme";

/** 콘텐츠 이름은 그 콘텐츠의 화면이 이미 쓰는 문구를 빌린다 — 같은 말을 두 번 적지 않는다. */
export function contentNameKey(id: ContentId): TextKey {
  const keys: Record<ContentId, TextKey> = {
    excavation: "excavation.title", interaction: "interaction.title", cakeOperation: "cake.title", bounty: "bounty.title",
    expedition: "expedition.entry", raid: "raid.title", duel: "lobby.duel", archaeology: "nav.archaeology",
    shop: "lobby.rail.shop", trade: "lobby.rail.trade", friends: "rail.friends",
  };
  return keys[id];
}

/** 지금 연구원 레벨로 그 콘텐츠가 열려 있는지. 화면이 레벨을 직접 비교하지 않는다. */
export function contentOpen(id: ContentId): boolean {
  return isContentUnlocked(id, session.playerResearch.level, undefined, session.cleared);
}

/** 「LV.4 개방 · 교류」 — 프로필의 다음 개방 줄과 같은 문구다. */
export function contentLockText(id: ContentId): string {
  const stage = CONTENT_STAGE_UNLOCKS[id];
  if (stage !== undefined) return t("profile.nextUnlockStage", { stage, content: t(contentNameKey(id)) });
  return t("profile.nextUnlock", { level: contentUnlockLevel(id), content: t(contentNameKey(id)) });
}

/**
 * 로비가 들어올 때마다 이전에 본 열림 상태와 지금 상태를 비교해(레벨·스테이지 클리어 어느 쪽이든), 그 사이 새로 열린 콘텐츠를 **한 번씩만** 연출하게 모아 둔다.
 *
 * 메모리에만 둔다 — 앱을 껐다 켠 첫 진입에는 연출 없이 열린 채로 서고, 같은 세션에서 레벨이 오른 뒤 로비로 돌아올 때만
 * 터진다. 연출을 부르는 화면이 `consumeUnlockCelebration`으로 제 몫을 가져가므로 두 번 터지지 않는다.
 */
let seenOpen: Set<ContentId> | undefined;
const pendingCelebrations = new Set<ContentId>();

export function collectUnlockCelebrations(): void {
  const open = new Set(ALL_GATED_CONTENT.filter((id) => contentOpen(id)));
  const previous = seenOpen;
  seenOpen = open;
  if (!previous) return;
  for (const id of open) if (!previous.has(id)) pendingCelebrations.add(id);
}

/** 이 콘텐츠의 열림 연출이 남아 있으면 true를 돌려주고 비운다. */
export function consumeUnlockCelebration(id: ContentId): boolean {
  return pendingCelebrations.delete(id);
}

/** 자물쇠 칩. 중심 기준의 컨테이너 — 판 위에 얹어 입력도 함께 막는 쪽은 부르는 쪽이 정한다. */
export function addLockBadge(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Container {
  const box = scene.add.container(x, y);
  const plate = drawLayer(scene, 0, 0, chipPoints(size * 1.5, size * 1.5, { bevel: { topLeft: size * 0.32, bottomRight: size * 0.32 } }), { fill: 0x0d1219, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.7 });
  box.add(plate);
  box.add(drawGlyph(scene, "lock", size, 0, size * 0.04, COLOR.accent, 1, Math.max(3, size * 0.09)));
  return box;
}

const SHAKE_MS = 560;
const POP_MS = 260;
/** 자물쇠가 흔들리고 터져 사라지기까지의 총 시간. 호출하는 화면이 뒤따르는 등장을 이 뒤에 건다. */
export const UNLOCK_POP_TOTAL_MS = SHAKE_MS + POP_MS;

/**
 * 자물쇠가 부들부들 흔들리다 팡! 하고 터져 사라진다.
 *
 * 파편은 동그라미가 아니라 마름모이고 위로 튄다(화면 전체의 이펙트 규칙). 난수를 쓰지 않고 번호에서 방향을 정해 같은 열림이
 * 늘 같은 그림을 그린다. 움직임 줄이기에서는 흔들림과 파편 없이 짧게 사라진다.
 */
export function playLockPop(scene: Phaser.Scene, lock: Phaser.GameObjects.Container, onDone?: () => void): void {
  const factor = motionPolicy(session.settings).nonEssentialDistanceFactor;
  const finish = () => { lock.destroy(); onDone?.(); };
  if (factor < 1) {
    scene.tweens.add({ targets: lock, alpha: 0, duration: 160, onComplete: finish });
    return;
  }
  const baseScale = lock.scale;
  scene.tweens.add({ targets: lock, angle: { from: -11, to: 11 }, duration: 70, yoyo: true, repeat: Math.floor(SHAKE_MS / 140) - 1, ease: "Sine.easeInOut",
    onUpdate: (_tween, _target, _key, value: number) => { lock.setScale(baseScale * (1 + Math.abs(value) * 0.004)); },
    onComplete: () => {
      if (!lock.active) return;
      lock.setAngle(0);
      // 컨테이너(팝업 본문) 안의 자물쇠여도 파편은 화면 좌표로 터진다.
      const world = lock.getWorldTransformMatrix();
      const x = world.tx;
      const y = world.ty;
      const flash = scene.add.graphics({ x, y }).setDepth(lock.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      flash.fillStyle(COLOR.accent, 0.5);
      flash.fillPoints([new Phaser.Geom.Point(0, -70), new Phaser.Geom.Point(110, 0), new Phaser.Geom.Point(0, 70), new Phaser.Geom.Point(-110, 0)], true);
      scene.tweens.add({ targets: flash, scaleX: 1.9, scaleY: 0.9, alpha: 0, duration: POP_MS, onComplete: () => flash.destroy() });
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8 + 0.3;
        const shard = scene.add.graphics({ x, y }).setDepth(lock.depth + 1).setRotation(angle);
        shard.fillStyle(i % 2 === 0 ? COLOR.accent : 0xffffff, 0.95);
        shard.fillPoints([new Phaser.Geom.Point(0, -9), new Phaser.Geom.Point(7, 1), new Phaser.Geom.Point(0, 9), new Phaser.Geom.Point(-5, -1)], true);
        scene.tweens.add({ targets: shard, x: x + Math.cos(angle) * 120, y: y + Math.sin(angle) * 90 - 40, alpha: 0, scale: 0.4, duration: POP_MS + 120, ease: "Cubic.easeOut", onComplete: () => shard.destroy() });
      }
      scene.tweens.add({ targets: lock, scale: baseScale * 1.6, alpha: 0, duration: POP_MS, ease: "Back.easeIn", onComplete: finish });
    },
  });
}

/**
 * 숨겨 둔 요소를 **자물쇠가 터지는 자리에서** 나타나게 한다.
 *
 * 요소는 먼저 보이지 않게 두고(입력도 함께 꺼진다), 같은 자리에 자물쇠를 세워 흔들고 터뜨린 뒤 한 번 튀어 오르며 선다.
 */
export function revealWithLockPop(scene: Phaser.Scene, target: Phaser.GameObjects.Container, x: number, y: number, delay = 450): void {
  const scale = target.scale;
  target.setVisible(false);
  scene.time.delayedCall(delay, () => {
    if (!scene.sys.isActive()) { target.setVisible(true); return; }
    const lock = addLockBadge(scene, x, y, 54).setDepth(target.depth + 50);
    playLockPop(scene, lock, undefined);
    scene.time.delayedCall(UNLOCK_POP_TOTAL_MS - 120, () => {
      if (!target.active) return;
      target.setVisible(true).setScale(scale * 0.82).setAlpha(0);
      scene.tweens.add({ targets: target, alpha: 1, scale, duration: 320, ease: "Back.easeOut" });
    });
  });
}

/** 잠긴 콘텐츠를 눌렀을 때 뜨는 한 줄. 어느 레벨에 열리는지만 말한다. */
export function showContentLockedToast(scene: Phaser.Scene, id: ContentId): void {
  const toast = scene.add
    .text(BASE_WIDTH / 2, BASE_HEIGHT - 420, contentLockText(id), textStyle({ role: "emphasis", size: 30, color: COLOR.accentText }))
    .setOrigin(0.5)
    .setDepth(3000);
  scene.tweens.add({ targets: toast, y: toast.y - 24, alpha: 0, delay: 500, duration: 900, onComplete: () => toast.destroy() });
}

/** 판 하나를 덮는 잠금 덮개 — 어두운 막, 자물쇠, 개방 레벨. 누르면 토스트가 뜨고 아래 입력은 막힌다. */
export function addLockCover(scene: Phaser.Scene, id: ContentId, width: number, height: number, bare = false): Phaser.GameObjects.Container {
  const cover = scene.add.container(0, 0);
  cover.add(drawLayer(scene, 0, 0, chipPoints(width, height, {}), { fill: 0x05080c, alpha: 0.78, shadow: false }));
  if (bare) return cover;
  cover.add(addLockBadge(scene, 0, -height * 0.12, Math.min(64, height * 0.3)));
  cover.add(scene.add.text(0, height * 0.22, contentLockText(id), textStyle({ role: "emphasis", size: 30, color: COLOR.accentText })).setOrigin(0.5));
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => showContentLockedToast(scene, id));
  cover.add(hit);
  return cover;
}
