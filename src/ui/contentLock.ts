import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { ALL_GATED_CONTENT, CONTENT_STAGE_UNLOCKS, contentUnlockLevel, isContentUnlocked, type ContentId } from "../core/contentUnlock";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { showContentToast } from "./ContentToast";
import { chipPoints, drawLayer } from "./holo";
import { LOCK_COVER, UNLOCK_BURST, UNLOCK_SEQUENCE, UNLOCK_SEQUENCE_TOTAL_MS, padlockGeometry } from "./lockStyle";
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

/** 자물쇠 그림 한 벌 — 채운 몸통, 굵은 고리, 열쇠 구멍. 같은 모양을 `color`로 칠한다. */
function paintPadlock(g: Phaser.GameObjects.Graphics, size: number, color: number, alpha: number, keyholeColor: number): void {
  const geo = padlockGeometry(size);
  g.lineStyle(geo.shackleWidth, color, alpha);
  g.beginPath();
  g.moveTo(geo.shackle[0], geo.shackle[1]);
  for (let i = 2; i < geo.shackle.length; i += 2) g.lineTo(geo.shackle[i], geo.shackle[i + 1]);
  g.strokePath();
  g.fillStyle(color, alpha);
  g.fillRect(geo.body.x, geo.body.y, geo.body.width, geo.body.height);
  g.fillStyle(keyholeColor, alpha);
  g.fillPoints(Array.from({ length: 4 }, (_, i) => new Phaser.Geom.Point(geo.keyhole[i * 2], geo.keyhole[i * 2 + 1])), true);
}

/**
 * 자물쇠 칩 — 어두운 받침 위에 **채운** 자물쇠. 선으로만 그린 자물쇠는 밝은 원화 위에서 잠겼다는 말이 읽히지 않았다.
 * 개방 연출의 하얗게 점멸하는 몫은 같은 모양을 흰색으로 한 장 더 얹어(`white`) 알파만 오가게 한다.
 */
export function addLockBadge(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Container {
  const box = scene.add.container(x, y);
  const plateSize = size * LOCK_COVER.plateRatio;
  box.add(drawLayer(scene, 0, 0, chipPoints(plateSize, plateSize, { bevel: { topLeft: plateSize * 0.28, bottomRight: plateSize * 0.28 } }), { fill: 0x070b10, alpha: 0.88, edge: COLOR.accent, edgeAlpha: 0.7 }));
  const body = scene.add.graphics();
  paintPadlock(body, size, COLOR.accent, 1, 0x070b10);
  const white = scene.add.graphics().setAlpha(0);
  paintPadlock(white, size, 0xffffff, 1, 0xffffff);
  box.add(body);
  box.add(white);
  box.setData("white", white);
  return box;
}

/** 열림 연출이 끝나는 시각(ms). 호출하는 화면이 뒤따르는 등장을 이 뒤에 건다. */
export const UNLOCK_POP_TOTAL_MS = UNLOCK_SEQUENCE_TOTAL_MS;

interface UnlockOptions {
  /** 자물쇠와 함께 걷힐 덮개. */
  cover?: Phaser.GameObjects.Container;
  /** 열린 콘텐츠 — 개방 토스트가 이름을 말한다. */
  id: ContentId;
  /** 터지는 순간(덮개가 걷히기 시작할 때) 불린다. */
  onOpen?: () => void;
}

function worldCenter(obj: Phaser.GameObjects.Container): { x: number; y: number } {
  const world = obj.getWorldTransformMatrix();
  return { x: world.tx, y: world.ty };
}

/**
 * 개방 연출: 맥동 → 흔들림 → 하얗게 점멸 → 부풂 → 핑! 하며 자물쇠가 터져 나간다.
 *
 * 부풀 때까지는 덮개 모양 안에 머물고(`lockMax` 이하로 자라고 덮개가 그 실루엣을 지킨다), 터지는 순간 파편은 화면 좌표로
 * 위로 튄다. 파편은 마름모이고 난수를 쓰지 않는다(번호에서 방향). 움직임 줄이기에서는 점멸·파편 없이 짧게 사라진다.
 * 터진 직후 개방 토스트가 선다.
 */
export function playUnlockSequence(scene: Phaser.Scene, lock: Phaser.GameObjects.Container, options: UnlockOptions): void {
  const T = UNLOCK_SEQUENCE;
  const factor = motionPolicy(session.settings).nonEssentialDistanceFactor;
  const cover = options.cover;
  const flash = cover?.getData("flash") as Phaser.GameObjects.Graphics | undefined;
  const white = lock.getData("white") as Phaser.GameObjects.Graphics | undefined;
  const open = () => {
    showContentToast(scene, t("content.unlocked", { content: t(contentNameKey(options.id)) }), "unlocked");
    options.onOpen?.();
  };
  const finish = () => { lock.destroy(); cover?.destroy(); };
  if (factor < 1) {
    open();
    scene.tweens.add({ targets: cover ?? lock, alpha: 0, duration: 160, onComplete: finish });
    return;
  }
  const base = lock.scale;
  const guard = () => lock.active;
  // 1 맥동 — 두 번 부풀었다 가라앉는다.
  scene.tweens.add({ targets: lock, scale: base * 1.14, duration: T.pulse / 4, yoyo: true, repeat: 1, ease: "Sine.easeInOut", onComplete: () => {
    if (!guard()) return;
    // 2 흔들림
    scene.tweens.add({ targets: lock, angle: { from: -10, to: 10 }, duration: 35, yoyo: true, repeat: Math.floor(T.shake / 70) - 1, ease: "Sine.easeInOut", onComplete: () => {
      if (!guard()) return;
      lock.setAngle(0);
      // 3 하얗게 점멸 — 자물쇠와 덮개 면이 함께 번쩍인다.
      const blinkTargets = [white, flash].filter((g): g is Phaser.GameObjects.Graphics => g !== undefined);
      scene.tweens.add({ targets: blinkTargets, alpha: { from: 0, to: 1 }, duration: T.blink / 6, yoyo: true, repeat: 2, onComplete: () => {
        if (!guard()) return;
        // 4 부풂 — 흰 채로 커진다.
        white?.setAlpha(1);
        flash?.setAlpha(1);
        scene.tweens.add({ targets: lock, scale: base * 1.4, duration: T.grow, ease: "Cubic.easeIn", onComplete: () => {
          if (!guard()) return;
          // 5 핑 — 섬광 + 마름모 파편이 위로 터지고 덮개가 걷힌다.
          const { x, y } = worldCenter(lock);
          const depth = 3500;
          const ping = scene.add.graphics({ x, y }).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
          ping.fillStyle(0xffffff, UNLOCK_BURST.flashAlpha);
          ping.fillPoints([new Phaser.Geom.Point(0, -60), new Phaser.Geom.Point(130, 0), new Phaser.Geom.Point(0, 60), new Phaser.Geom.Point(-130, 0)], true);
          scene.tweens.add({ targets: ping, scaleX: 2.2, scaleY: 1, alpha: 0, duration: T.ping, ease: "Cubic.easeOut", onComplete: () => ping.destroy() });
          for (let i = 0; i < UNLOCK_BURST.shards; i++) {
            const angle = (Math.PI * 2 * i) / UNLOCK_BURST.shards + 0.3;
            const shard = scene.add.graphics({ x, y }).setDepth(depth).setRotation(angle);
            shard.fillStyle(i % 2 === 0 ? COLOR.accent : 0xffffff, 0.95);
            shard.fillPoints([new Phaser.Geom.Point(0, -11), new Phaser.Geom.Point(8, 1), new Phaser.Geom.Point(0, 11), new Phaser.Geom.Point(-6, -1)], true);
            scene.tweens.add({ targets: shard, x: x + Math.cos(angle) * UNLOCK_BURST.reach, y: y + Math.sin(angle) * UNLOCK_BURST.reach * 0.7 - UNLOCK_BURST.rise, alpha: 0, scale: 0.4, duration: T.ping + 140, ease: "Cubic.easeOut", onComplete: () => shard.destroy() });
          }
          lock.setVisible(false);
          open();
          scene.tweens.add({ targets: cover ?? lock, alpha: 0, duration: T.ping, onComplete: finish });
        } });
      } });
    } });
  } });
}

/**
 * 숨겨 둔 요소를 **자물쇠가 터지는 자리에서** 나타나게 한다.
 *
 * 요소는 먼저 보이지 않게 두고(입력도 함께 꺼진다), 같은 자리에 큰 자물쇠를 세워 개방 연출을 돌린 뒤 한 번 튀어 오르며 선다.
 */
export function revealWithLockPop(scene: Phaser.Scene, target: Phaser.GameObjects.Container, id: ContentId, x: number, y: number, delay = 450): void {
  const scale = target.scale;
  target.setVisible(false);
  scene.time.delayedCall(delay, () => {
    if (!scene.sys.isActive()) { target.setVisible(true); return; }
    const lock = addLockBadge(scene, x, y, 84).setDepth(target.depth + 50);
    playUnlockSequence(scene, lock, { id, onOpen: () => {
      if (!target.active) return;
      target.setVisible(true).setScale(scale * 0.82).setAlpha(0);
      scene.tweens.add({ targets: target, alpha: 1, scale, duration: 320, ease: "Back.easeOut" });
    } });
  });
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
  /** 아래 입력을 이 덮개가 막고 누르면 토스트를 띄운다. 이미 위에 입력면이 있는 자리(하단 탭)는 끈다. */
  blockInput?: boolean;
}

/**
 * 판 하나를 덮는 잠금 덮개 — 원본과 **같은 실루엣**의 어두운 면 한 장과 한가운데의 큰 자물쇠.
 *
 * 마스크가 아니라 도형 자체를 원본의 깎임으로 만들어 컨테이너 이동·확대와 함께 가므로 어긋나지 않는다. 중심 기준 컨테이너라
 * 부르는 쪽이 원본과 같은 좌표에 둔다. 개방 연출의 점멸용 흰 면(`flash`)을 함께 품는다.
 */
export function addLockCover(scene: Phaser.Scene, id: ContentId, width: number, height: number, options: LockCoverOptions = {}): Phaser.GameObjects.Container {
  const cover = scene.add.container(0, 0);
  const shape = chipPoints(width, height, { bevel: options.bevel ?? {} });
  cover.add(drawLayer(scene, 0, 0, shape, { fill: 0x05080c, alpha: LOCK_COVER.dimAlpha, shadow: false }));
  const flash = drawLayer(scene, 0, 0, shape, { fill: 0xffffff, alpha: 0.4, shadow: false }).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  cover.add(flash);
  cover.setData("flash", flash);
  const lockSize = Math.min(LOCK_COVER.lockMax, Math.min(width, height) * LOCK_COVER.lockRatio);
  const text = options.text === true;
  const lock = addLockBadge(scene, 0, text ? -height * 0.1 : 0, lockSize);
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
