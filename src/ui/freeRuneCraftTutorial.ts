import Phaser from "phaser";
import { t } from "../i18n";
import { tutorialManager } from "../managers/TutorialManager";
import type { PopupLayer } from "./PopupLayer";
import { followTutorialTarget } from "./tutorialTarget";

/**
 * 무료 각인 체험(1-5 초회 룬) — 가방·장착 가방처럼 룬을 보는 자리에 들어오면 한 번 권하고, 받아들이면 그 룬의
 * 세공 화면을 곧장 연다. 실제 안내(어느 줄을 고르고 무엇을 누르는지)는 세공 화면이 `guideFreeRuneCraft`로 건다 —
 * 가방에서 그 룬을 직접 눌러 세공으로 들어와도 같은 안내가 서야 이어하기가 된다.
 *
 * 권하는 쪽지는 앱을 켜 둔 동안 한 번만 뜬다. 「나중에」로 닫아도 체험은 남아 가방의 점이 그대로 서고, 다음에 앱을
 * 켜 가방을 열면 다시 권한다. 영영 끝내는 길은 세공 화면의 「건너뛰기」와 각인 확정 둘뿐이다.
 */
let offeredThisRun = false;

export function offerFreeRuneCraft(scene: Phaser.Scene, popups: PopupLayer, openCraft: (runeInstanceId: string) => void): void {
  if (offeredThisRun || tutorialManager.freeRuneId() === undefined) return;
  offeredThisRun = true;
  let stopped = false;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { stopped = true; });
  // 가방 판이 제자리를 잡은 뒤에 얹는다 — 여는 연출 도중에 쪽지가 서면 두 판이 함께 흔들린다.
  scene.time.delayedCall(420, () => {
    const runeId = tutorialManager.freeRuneId();
    if (stopped || !scene.scene.isActive() || runeId === undefined) return;
    popups.confirm({
      title: t("tutorial.rune.intro.title"),
      message: t("tutorial.rune.intro.body"),
      confirmLabel: t("tutorial.rune.intro.start"),
      cancelLabel: t("tutorial.rune.intro.later"),
    }, () => openCraft(runeId));
  });
}

type Rect = { x: number; y: number; width: number; height: number };

/** 세공 화면이 안내에 넘기는 지금의 조작 자리. 다시 그릴 때마다 바뀌므로 매 프레임 묻는다. */
export interface FreeRuneCraftTargets {
  /** 체험 룬이 아직 체험 중인가(세공 화면이 닫히지 않았고 체험이 끝나지 않았다). */
  active: () => boolean;
  /** 지금 화면이 다른 판에 덮였나. 덮이면 안내를 걷는다. */
  covered: () => boolean;
  stage: () => "pick" | "craft" | "craftAll" | "engravePick" | "engrave" | undefined;
  firstRow: () => Rect | undefined;
  allRows: () => Rect | undefined;
  craftButton: () => Rect | undefined;
  craftAllButton: () => Rect | undefined;
  onSkip: () => void;
}

export function unionRects(rects: readonly Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 세공 화면 위에 한 칸씩 가리키는 안내를 건다. 체험이 끝나면(각인·건너뛰기) 저절로 걷힌다. */
export function guideFreeRuneCraft(scene: Phaser.Scene, targets: FreeRuneCraftTargets): () => void {
  return followTutorialTarget(scene, {
    enabled: targets.active,
    blocked: targets.covered,
    onSkip: targets.onSkip,
    rect: () => {
      switch (targets.stage()) {
        case "pick": return targets.firstRow();
        case "craft": case "engrave": return targets.craftButton();
        case "craftAll": return targets.craftAllButton();
        case "engravePick": return targets.allRows();
        default: return undefined;
      }
    },
    text: () => {
      switch (targets.stage()) {
        case "pick": return t("tutorial.rune.pick");
        case "craft": return t("tutorial.rune.craft");
        case "craftAll": return t("tutorial.rune.craftAll");
        case "engravePick": return t("tutorial.rune.engravePick");
        default: return t("tutorial.rune.engrave");
      }
    },
  });
}
