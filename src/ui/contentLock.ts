import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { ALL_GATED_CONTENT, CONTENT_STAGE_UNLOCKS, contentUnlockLevel, isContentUnlocked, type ContentId } from "../core/contentUnlock";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { showContentToast } from "./ContentToast";
import { chipPoints, drawLayer } from "./holo";
import { LOCK_COVER, UNLOCK_BURST, UNLOCK_MOTION, UNLOCK_SEQUENCE, UNLOCK_SEQUENCE_TOTAL_MS, padlockGeometry } from "./lockStyle";
import { addPadlock, padlockParts } from "./Padlock";
import { COLOR, textStyle } from "./theme";

/** 콘텐츠 이름은 그 콘텐츠의 화면이 이미 쓰는 문구를 빌린다 — 같은 말을 두 번 적지 않는다. */
export function contentNameKey(id: ContentId): TextKey {
  const keys: Record<ContentId, TextKey> = {
    excavation: "excavation.title", interaction: "interaction.title", cakeOperation: "cake.title", bounty: "bounty.title",
    expedition: "expedition.entry", raid: "raid.title", duel: "lobby.duel", archaeology: "nav.archaeology",
    shop: "lobby.rail.shop", trade: "lobby.rail.trade", friends: "rail.friends", guild: "rail.guild",
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

/** 열림 연출이 끝나는 시각(ms). 호출하는 화면이 뒤따르는 등장을 이 뒤에 건다. */
export const UNLOCK_POP_TOTAL_MS = UNLOCK_SEQUENCE_TOTAL_MS;

export interface UnlockOptions {
  /** 자물쇠와 함께 걷힐 덮개. */
  cover?: Phaser.GameObjects.Container;
  /** 열린 콘텐츠 — 개방 토스트가 이름을 말한다. */
  id: ContentId;
  /** 연출이 시작될 때 — 흐려 둔 칸을 이때부터 밝힌다(자물쇠가 깨어나는 박자와 함께). */
  onStart?: () => void;
  /** 자물쇠를 놓는 순간(덮개가 걷히기 시작할 때) 불린다. 원래 아이콘이 이때 그 자리에 들어선다. */
  onOpen?: () => void;
}

function worldCenter(obj: Phaser.GameObjects.Container): { x: number; y: number } {
  const world = obj.getWorldTransformMatrix();
  return { x: world.tx, y: world.ty };
}

/**
 * 개방 연출 — 진짜 자물쇠가 풀리듯 흐른다: 깨어남(칸이 밝아지며 자물쇠가 살짝 움츠린다) → 덜컥(잦아드는 흔들림) →
 * 찰칵(고리만 튀어 올라 옆으로 젖혀지고 한 번 하얗게 번쩍인다) → 머묾 → 놓음(자물쇠가 위로 떠오르며 녹고 덮개가 걷힌다).
 *
 * 예전에는 맥동·흔들림·점멸·부풂 뒤 파편과 함께 **터졌는데**, 잠금이 깨지는 것으로 읽혀 「열렸다」는 말이 서지 않았다.
 * 지금은 터뜨리지 않고 옅은 마름모 섬광 하나와 위로 흩어지는 작은 조각 몇 개만 남긴다(난수 없이 번호에서 방향).
 * 움직임 줄이기에서는 몸짓 없이 짧게 녹는다. 놓는 순간 개방 토스트가 선다.
 */
export function playUnlockSequence(scene: Phaser.Scene, lock: Phaser.GameObjects.Container, options: UnlockOptions): void {
  const T = UNLOCK_SEQUENCE;
  const M = UNLOCK_MOTION;
  const factor = motionPolicy(session.settings).nonEssentialDistanceFactor;
  const cover = options.cover;
  const parts = padlockParts(lock);
  const size = parts?.size ?? 60;
  const open = () => {
    showContentToast(scene, t("content.unlocked", { content: t(contentNameKey(options.id)) }), "unlocked");
    options.onOpen?.();
  };
  const finish = () => { lock.destroy(); cover?.destroy(); };
  options.onStart?.();
  if (factor < 1) {
    open();
    scene.tweens.add({ targets: cover ?? lock, alpha: 0, duration: 160, onComplete: finish });
    return;
  }
  const base = lock.scale;
  const baseY = lock.y;
  const guard = () => lock.active;
  // 1 깨어남 — 흐린 자물쇠가 또렷해지며 한 번 움츠렸다 돌아온다.
  scene.tweens.add({ targets: lock, alpha: 1, duration: T.wake, ease: "Sine.easeOut" });
  scene.tweens.add({ targets: lock, scale: base * 0.9, duration: T.wake / 2, yoyo: true, ease: "Sine.easeInOut", onComplete: () => {
    if (!guard()) return;
    // 2 덜컥 — 크게 시작해 잦아드는 흔들림. 같은 폭으로 떨면 고장 난 것처럼 읽힌다.
    scene.tweens.addCounter({ from: 0, to: 1, duration: T.jiggle, onUpdate: (tween) => {
      const p = tween.getValue() ?? 0;
      lock.setAngle(M.jiggleAngle * Math.sin(p * Math.PI * 2 * M.jiggleTurns) * (1 - p));
    }, onComplete: () => {
      if (!guard()) return;
      lock.setAngle(0);
      // 3 찰칵 — 고리만 튀어 올라 왼쪽 다리를 축으로 젖혀지고, 그 순간 한 번 하얗게 번쩍인다.
      const pivotY = padlockGeometry(size).pivot.y;
      if (parts) {
        scene.tweens.add({ targets: parts.shackles, y: pivotY - size * M.shackleLift, angle: M.shackleTilt, duration: T.open, ease: "Back.easeOut" });
        scene.tweens.add({ targets: parts.whites, alpha: { from: 0, to: 0.85 }, duration: T.open / 2, yoyo: true, ease: "Sine.easeOut" });
      }
      scene.tweens.add({ targets: lock, scale: base * 1.08, duration: T.open / 2, yoyo: true, ease: "Sine.easeOut" });
      // 4 머묾 → 5 놓음 — 열린 자물쇠를 잠깐 보여 준 뒤 위로 떠오르며 녹인다.
      scene.tweens.add({ targets: lock, y: baseY, delay: T.open + T.hold, duration: 1, onComplete: () => {
        if (!guard()) return;
        const { x, y } = worldCenter(lock);
        const depth = 3500;
        const ping = scene.add.graphics({ x, y }).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
        ping.fillStyle(0xffffff, UNLOCK_BURST.flashAlpha);
        ping.fillPoints([new Phaser.Geom.Point(0, -size * 0.5), new Phaser.Geom.Point(size * 1.1, 0), new Phaser.Geom.Point(0, size * 0.5), new Phaser.Geom.Point(-size * 1.1, 0)], true);
        scene.tweens.add({ targets: ping, scaleX: 1.8, scaleY: 0.8, alpha: 0, duration: T.release, ease: "Cubic.easeOut", onComplete: () => ping.destroy() });
        for (let i = 0; i < UNLOCK_BURST.shards; i++) {
          // 위쪽 반원으로만 흩어진다 — 풀린 것이 떠오르는 방향이다.
          const angle = -Math.PI * (0.15 + (0.7 * i) / Math.max(1, UNLOCK_BURST.shards - 1));
          const shard = scene.add.graphics({ x, y }).setDepth(depth).setRotation(angle + Math.PI / 2);
          shard.fillStyle(i % 2 === 0 ? COLOR.accent : 0xffffff, 0.9);
          shard.fillPoints([new Phaser.Geom.Point(0, -7), new Phaser.Geom.Point(5, 1), new Phaser.Geom.Point(0, 7), new Phaser.Geom.Point(-4, -1)], true);
          scene.tweens.add({ targets: shard, x: x + Math.cos(angle) * UNLOCK_BURST.reach, y: y + Math.sin(angle) * UNLOCK_BURST.reach - UNLOCK_BURST.rise * 0.4, alpha: 0, scale: 0.5, duration: T.release + 120, ease: "Cubic.easeOut", onComplete: () => shard.destroy() });
        }
        open();
        scene.tweens.add({ targets: lock, y: baseY - size * M.releaseRise, alpha: 0, scale: base * 1.12, duration: T.release, ease: "Cubic.easeOut", onComplete: () => { if (!cover) finish(); } });
        if (cover) scene.tweens.add({ targets: cover, alpha: 0, duration: T.release, ease: "Sine.easeIn", onComplete: finish });
      } });
    } });
  } });
}

/** 잠긴 콘텐츠를 눌렀을 때 뜨는 한 줄. 어느 레벨에 열리는지만 말한다. */
export function showContentLockedToast(scene: Phaser.Scene, id: ContentId): void {
  showContentToast(scene, contentLockText(id), "locked");
}

export interface LockCoverOptions {
  /** 원본 판의 깎임 — 덮개는 원본과 같은 실루엣으로 잘려 모서리 밖으로 새지 않는다. */
  bevel?: { topLeft?: number; topRight?: number; bottomRight?: number; bottomLeft?: number };
  /** 개방 레벨을 자물쇠 밑에 적는다(큰 판만). 작은 칸은 눌러야 토스트가 말한다. */
  text?: boolean;
  /** 아래 입력을 이 덮개가 막고 누르면 토스트를 띄운다. 이미 위에 입력면이 있는 자리는 끈다. */
  blockInput?: boolean;
}

/**
 * 원화가 깔린 큰 판(출격 칸)을 덮는 잠금 덮개 — 원본과 **같은 실루엣**의 어두운 면 한 장과 한가운데의 자물쇠.
 *
 * 자물쇠는 받침 판 없이 그림과 그 그림의 검은 복제 그림자만으로 선다 — 덮개가 이미 어두운 면이라 받침을 한 겹 더 깔면
 * 판 위에 판이 쌓인다. 마스크가 아니라 도형 자체를 원본의 깎임으로 만들어 컨테이너 이동·확대와 함께 가므로 어긋나지 않는다.
 */
export function addLockCover(scene: Phaser.Scene, id: ContentId, width: number, height: number, options: LockCoverOptions = {}): Phaser.GameObjects.Container {
  const cover = scene.add.container(0, 0);
  const shape = chipPoints(width, height, { bevel: options.bevel ?? {} });
  cover.add(drawLayer(scene, 0, 0, shape, { fill: 0x05080c, alpha: LOCK_COVER.dimAlpha, shadow: false }));
  const lockSize = Math.min(LOCK_COVER.lockMax, Math.min(width, height) * LOCK_COVER.lockRatio);
  const text = options.text === true;
  const lock = addPadlock(scene, 0, text ? -height * 0.1 : 0, lockSize, { color: 0xeef2f6, shadow: true });
  cover.add(lock);
  cover.setData("lock", lock);
  if (text) cover.add(scene.add.text(0, height * 0.28, contentLockText(id), textStyle({ role: "emphasis", size: 30, color: COLOR.accentText })).setOrigin(0.5));
  if (options.blockInput !== false) {
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => showContentLockedToast(scene, id));
    cover.add(hit);
  }
  return cover;
}

/** `addLockCover`가 만든 덮개에 개방 연출을 돌린다. */
export function unlockCover(scene: Phaser.Scene, cover: Phaser.GameObjects.Container, id: ContentId, onOpen?: () => void): void {
  const lock = cover.getData("lock") as Phaser.GameObjects.Container | undefined;
  if (!lock) { cover.destroy(); onOpen?.(); return; }
  // 연출 중에는 입력을 막은 채 두고, 걷히면서 덮개가 사라진다.
  playUnlockSequence(scene, lock, { cover, id, onOpen });
}
