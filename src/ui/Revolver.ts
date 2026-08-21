import Phaser from "phaser";
import type { BattleUnit, Team } from "../core/battle";
import { canSwap } from "../core/battle";
import { addHelpBadge } from "./info";
import { COLOR, textStyle } from "./theme";

/** 슬롯별 각도(도). 0번이 맨 위 — 출전 중인 자리다. */
const SLOT_ANGLE = [-90, 150, 30];
const SPIN_MS = 320;

interface Profile {
  container: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  active: Phaser.GameObjects.Text;
  /** 지금 놓인 각도. 다음 각도로 돌릴 때 짧은 쪽으로 돌리기 위해 들고 있는다. */
  angle: number;
}

/**
 * 교대 렐릭 3명을 원형으로 세운 리볼버. 맨 위가 출전 중이고,
 * 아래 두 명 중 하나를 누르면 실린더가 돌 듯 자리를 바꿔 전방으로 올라온다.
 */
export class Revolver {
  private readonly profiles: Profile[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cx: number,
    private readonly cy: number,
    private readonly radius: number,
    team: Team,
    private readonly onSwap: (memberIndex: number) => void,
    onInfo: (memberIndex: number) => void,
  ) {
    // 회전판 바탕. 테두리 대신 옅은 원 하나로 자리만 알린다.
    scene.add.circle(cx, cy, radius + 74, 0x141920, 0.75);

    team.units.forEach((unit, memberIndex) => {
      const slot = team.order.indexOf(memberIndex);
      const angle = SLOT_ANGLE[slot];
      const container = scene.add.container(...this.pointAt(angle));

      const ring = scene.add
        .circle(0, 0, 66, 0x1a1f27, 0.94)
        .setStrokeStyle(3, COLOR.ally, 0.9)
        .setInteractive({ useHandCursor: true });
      ring.on("pointerdown", () => this.onSwap(memberIndex));
      container.add(ring);

      const name = scene.add
        .text(0, -14, unit.def.name, textStyle({ role: "display", size: 32 }))
        .setOrigin(0.5);
      container.add(name);

      const hp = scene.add
        .text(0, 24, "", textStyle({ role: "body", size: 24, color: COLOR.inkDim }))
        .setOrigin(0.5);
      container.add(hp);

      const active = scene.add
        .text(0, -92, "출전", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText }))
        .setOrigin(0.5);
      container.add(active);

      container.add(addHelpBadge(scene, 52, -52, () => onInfo(memberIndex), 22));

      this.profiles.push({ container, ring, name, hp, active, angle });
    });
  }

  private pointAt(angleDeg: number): [number, number] {
    const rad = Phaser.Math.DegToRad(angleDeg);
    return [this.cx + Math.cos(rad) * this.radius, this.cy + Math.sin(rad) * this.radius];
  }

  update(team: Team, interactive: boolean): void {
    team.units.forEach((unit, memberIndex) => {
      const profile = this.profiles[memberIndex];
      const slot = team.order.indexOf(memberIndex);
      this.spinTo(profile, SLOT_ANGLE[slot]);

      profile.name.setText(unit.def.name);
      profile.hp.setText(unit.hp > 0 ? `${unit.hp}/${unit.maxHp}` : "전투 불능");
      profile.active.setVisible(slot === 0);

      const front = slot === 0;
      // 선봉은 굵은 테두리가 아니라 강조색 선과 살짝 큰 크기로 알린다.
      profile.ring.setStrokeStyle(3, front ? COLOR.accent : COLOR.ally, front ? 1 : 0.7);
      profile.container.setScale(front ? 1.08 : 1);

      // 지금 교대할 수 있는 애만 또렷하게 둔다.
      const swappable = interactive && canSwap(team, memberIndex);
      profile.container.setAlpha(unit.hp > 0 ? (front || swappable ? 1 : 0.4) : 0.25);
      if (swappable) profile.ring.setInteractive({ useHandCursor: true });
      else profile.ring.disableInteractive();
    });
  }

  /** 목표 각도까지 짧은 쪽으로 돌린다. 실린더가 도는 것처럼 보이게 하는 부분이다. */
  private spinTo(profile: Profile, targetDeg: number): void {
    let delta = targetDeg - profile.angle;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    if (Math.abs(delta) < 0.5) return;

    const from = profile.angle;
    profile.angle = targetDeg;

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: SPIN_MS,
      ease: "Cubic.easeInOut",
      onUpdate: (tween) => {
        const [x, y] = this.pointAt(from + delta * tween.getValue()!);
        profile.container.setPosition(x, y);
      },
    });
  }
}

export type { BattleUnit };
