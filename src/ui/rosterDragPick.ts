import Phaser from "phaser";
import { audioManager } from "../managers/AudioManager";
import { rosterPickIntent } from "../core/rosterPick";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import type { PuppetCreature } from "../puppets/assets";
import { FORMATION_DRAG_VISUAL, type FormationLiftPose } from "./formationDragVisual";
import { applyLiftPose, clearLiftPose, EXTERNAL_DRAG, type FormationDragVisualController } from "./formationDragVisualController";

/**
 * 편성 목록의 카드를 **끌어서** 칸에 놓는 손.
 *
 * 카드를 집는 순간 그 렐릭의 SD가 손끝에서 톡 튀어나와(공용 든 몸 자세 `formationLiftPose`의 부풂)
 * 따라다니고, 칸 위에 오면 칸을 끄는 손과 같은 네모칸·감광(`FormationDragVisualController`)이 놓을
 * 자리를 알린다. 놓으면 화면의 `drop`이 확정 규칙(`dropRosterRelic`)을 부른다 — 배열은 이 모듈이
 * 만지지 않는다. 짧은 탭·꾹 누르기·세로 스크롤은 그대로 남는다(판정은 `rosterPickIntent`).
 */
export interface RosterDragPickOptions {
  scene: Phaser.Scene;
  visual: () => FormationDragVisualController | undefined;
  /** 목록 창의 윗변과 지금 굴릴 것이 있는지. */
  viewportTop: () => number;
  scrollable: () => boolean;
  /** 집는 순간 스크롤을 멈추고, 가로로 집었으면 누를 때의 스크롤 자리로 되돌린다. */
  onPickStart: () => void;
  /** 든 SD를 세운다. 씬을 떠났으면 `undefined`. */
  spawn: (relicId: string) => Promise<PuppetCreature | undefined>;
  /** 든 SD를 손끝에 세운다(화면마다 SD 높이·에셋이 다르다). */
  place: (creature: PuppetCreature, relicId: string, x: number, y: number, lift: FormationLiftPose) => void;
  /** 칸에 서 있는 SD. 가리킨 칸의 렐릭은 갈아 끼워질 것이라 흐리게 둔다. */
  slotCreatures: () => readonly (PuppetCreature | undefined)[];
  color: number;
  liftDepth?: () => number | undefined;
  /** 놓은 칸. 칸 밖에 놓으면 부르지 않는다. */
  drop: (relicId: string, slot: number) => void;
  /** 집기를 막는 순간(튜토리얼 등). */
  enabled?: () => boolean;
}

export interface RosterDragPick {
  /** 목록 카드의 `pointerdown`에서 부른다. */
  press(relicId: string, pointer: Phaser.Input.Pointer): void;
  /** 지금 카드를 들고 있는지. 씬의 스크롤은 그동안 멈춘다. */
  active(): boolean;
  /** 이번 누름이 집기로 쓰였는지. 카드의 짧은 탭을 막는 데 쓴다(다음 누름에서 풀린다). */
  consumed(): boolean;
  /** 공용 표현기의 `renderExternal`로 넘긴다. */
  render(frame: { pointer: { x: number; y: number }; hovered?: number; lift: FormationLiftPose }): void;
}

export function bindRosterDragPick(options: RosterDragPickOptions): RosterDragPick {
  const { scene } = options;
  let press: { relicId: string; x: number; y: number; scrolling: boolean } | undefined;
  let held: { relicId: string; creature?: PuppetCreature; request: number } | undefined;
  let used = false;
  let request = 0;

  const dimSlots = (hovered?: number): void => {
    options.slotCreatures().forEach((creature, index) => {
      if (!creature) return;
      creature.setAlpha(index === hovered ? FORMATION_DRAG_VISUAL.previewAlpha : 1);
    });
  };

  const render: RosterDragPick["render"] = ({ pointer, hovered, lift }) => {
    dimSlots(hovered);
    const creature = held?.creature;
    if (!held || !creature) return;
    options.place(creature, held.relicId, pointer.x, pointer.y, lift);
    creature.setDepth(options.liftDepth?.() ?? 20).setAlpha(FORMATION_DRAG_VISUAL.liftAlpha).setVisible(true);
    applyLiftPose(creature, lift, options.color);
  };

  const release = (): void => {
    const creature = held?.creature;
    if (creature) { clearLiftPose(creature); creature.destroy(); }
    held = undefined;
    request += 1;
  };

  const start = (relicId: string, pointer: Phaser.Input.Pointer): void => {
    const visual = options.visual();
    if (!visual) return;
    used = true;
    options.onPickStart();
    audioManager?.playUi("formation.lift");
    const mine = ++request;
    held = { relicId, request: mine };
    visual.beginExternalDrag(pointer.worldX, pointer.worldY);
    void options.spawn(relicId).then((creature) => {
      if (!creature) return;
      // 기다리는 사이 손을 뗐으면 도착한 몸은 쓰지 않는다.
      if (!held || held.request !== mine) { creature.destroy(); return; }
      creature.setVisible(false);
      held.creature = creature;
    });
  };

  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (held) {
      if (!pointer.isDown) return;
      options.visual()?.moveDrag(EXTERNAL_DRAG, pointer.worldX, pointer.worldY);
      return;
    }
    if (!press || !pointer.isDown || (options.enabled && !options.enabled())) return;
    const intent = rosterPickIntent({
      dx: pointer.worldX - press.x, dy: pointer.worldY - press.y, pointerY: pointer.worldY,
      viewportTop: options.viewportTop(), scrollable: options.scrollable(), scrolling: press.scrolling, slop: TAP_DRAG_SLOP,
    });
    // 세로로 정해진 손은 창 위로 빠져나갈 때까지 스크롤로 남는다 — 굴리다 옆으로 흔들린 손이 카드를 집지 않게.
    if (intent === "scroll") press.scrolling = true;
    if (intent === "pick") { const id = press.relicId; press = undefined; start(id, pointer); }
  };

  const onUp = (): void => {
    press = undefined;
    if (!held) return;
    const visual = options.visual();
    const target = visual?.hovered();
    const relicId = held.relicId;
    visual?.endDrag();
    release();
    if (target !== undefined) { audioManager?.playUi("formation.place"); options.drop(relicId, target); }
  };

  scene.input.on("pointermove", onMove);
  scene.input.on("pointerup", onUp);
  scene.input.on("pointerupoutside", onUp);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off("pointermove", onMove);
    scene.input.off("pointerup", onUp);
    scene.input.off("pointerupoutside", onUp);
    release();
  });

  return {
    press: (relicId, pointer) => { used = false; press = { relicId, x: pointer.worldX, y: pointer.worldY, scrolling: false }; },
    active: () => held !== undefined,
    consumed: () => used,
    render,
  };
}
