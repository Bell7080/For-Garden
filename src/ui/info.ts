import Phaser from "phaser";
import type { PuppetCreature } from "puppetforge/phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import type { BattleUnit } from "../core/battle";
import { ULTIMATE_MAX } from "../core/battle";
import type { RelicDef } from "../core/types";
import { setDebugInfoOpen } from "../debug";
import { CHAR_ASSET, spawnPuppet, tintPuppet } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { COLOR, textStyle } from "./theme";

/** 전신 일러스트가 설 자리. 발끝을 바닥선에 맞춘다. */
const PORTRAIT = { x: BASE_WIDTH / 2, groundY: 880, height: 500 } as const;
/** 일러스트를 띄울 때와 아닐 때의 본문 시작 높이. */
const BODY_TOP = { withPortrait: 920, plain: 360 } as const;

export const ROLE_LABEL: Record<string, string> = {
  attacker: "공격",
  tank: "방어",
  support: "지원",
};

/** `?` 아이콘. 정보가 붙어 있는 것 위에 얹어 누를 수 있게 한다. */
export function addHelpBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onClick: () => void,
  radius = 26,
): Phaser.GameObjects.Container {
  const badge = scene.add.container(x, y);
  const circle = scene.add
    .circle(0, 0, radius, COLOR.void)
    .setStrokeStyle(3, COLOR.accent)
    .setInteractive({ useHandCursor: true });
  badge.add(circle);
  badge.add(
    scene.add.text(0, 0, "?", textStyle({ size: Math.round(radius * 1.3), color: COLOR.accentText })).setOrigin(0.5),
  );
  // 툴팁을 여는 것뿐이라 대상의 클릭까지 함께 발동하면 안 된다.
  circle.on("pointerdown", (_p: unknown, _x: unknown, _y: unknown, event?: Phaser.Types.Input.EventData) => {
    event?.stopPropagation();
    onClick();
  });
  return badge;
}

/**
 * 정보창을 한 곳에서 관리한다.
 *
 * 아군이든 적이든, 편성 화면이든 전투 중이든 정보창의 생김새와 항목 순서는 같다.
 * 씬은 "누구의 정보를 열지"만 말하고, 무엇을 어떤 순서로 보여줄지는 여기서 정한다.
 */
export class InfoManager {
  private readonly root: Phaser.GameObjects.Container;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  /** 전신 일러스트. 파일을 읽는 동안에도 정보창은 열 수 있어야 해서 늦게 붙는다. */
  private portrait?: PuppetCreature;
  private portraitWanted = false;

  constructor(scene: Phaser.Scene, portraitDepth = 1001) {
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    void this.loadPortrait(scene, portraitDepth);

    const shade = scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.9)
      .setInteractive();
    shade.on("pointerdown", () => this.hide()); // 바깥을 누르면 닫힌다
    this.root.add(shade);

    const panelW = BASE_WIDTH - 120;
    const panelH = 1560;
    const top = BASE_HEIGHT / 2 - panelH / 2;
    this.root.add(
      scene.add
        .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, panelW, panelH, COLOR.panel)
        .setStrokeStyle(4, COLOR.accent),
    );

    this.titleText = scene.add
      .text(BASE_WIDTH / 2, top + 44, "", textStyle({ size: 52, align: "center" }))
      .setOrigin(0.5, 0);
    this.root.add(this.titleText);

    this.subtitleText = scene.add
      .text(BASE_WIDTH / 2, top + 112, "", textStyle({ size: 30, color: COLOR.accentText, align: "center" }))
      .setOrigin(0.5, 0);
    this.root.add(this.subtitleText);

    this.bodyText = scene.add
      .text(
        BASE_WIDTH / 2 - panelW / 2 + 40,
        BODY_TOP.plain,
        "",
        textStyle({ size: 26, lineSpacing: 9, wrap: panelW - 80 }),
      )
      .setOrigin(0, 0);
    this.root.add(this.bodyText);

    const closeY = BASE_HEIGHT / 2 + panelH / 2 - 76;
    const close = scene.add
      .rectangle(BASE_WIDTH / 2, closeY, 320, 96, COLOR.panelEdge)
      .setStrokeStyle(3, COLOR.accent)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.hide());
    this.root.add(close);
    this.root.add(scene.add.text(BASE_WIDTH / 2, closeY, "닫기", textStyle({ size: 34 })).setOrigin(0.5));
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  hide(): void {
    this.root.setVisible(false);
    this.portraitWanted = false;
    this.portrait?.setVisible(false);
    setDebugInfoOpen(false);
  }

  private async loadPortrait(scene: Phaser.Scene, depth: number): Promise<void> {
    this.portrait = await spawnPuppet(scene, CHAR_ASSET, { ...PORTRAIT, depth });
    this.portrait.setVisible(this.portraitWanted && this.root.visible);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.portrait?.destroy());
  }

  /** 일러스트는 렐릭 한 명을 볼 때만 띄운다. 목록을 볼 때는 글이 들어갈 자리가 필요하다. */
  private open(title: string, subtitle: string, body: string, relicId?: string): void {
    this.titleText.setText(title);
    this.subtitleText.setText(subtitle);
    this.bodyText.setText(body);
    this.bodyText.setY(relicId ? BODY_TOP.withPortrait : BODY_TOP.plain);

    this.portraitWanted = relicId !== undefined;
    if (this.portrait) {
      this.portrait.setVisible(this.portraitWanted);
      // 렐릭마다 제 일러스트가 생기기 전까지는 색으로만 구분한다.
      if (relicId) tintPuppet(this.portrait, mixWhite(tintFor(relicId), 0.55));
    }

    this.root.setVisible(true);
    setDebugInfoOpen(true);
  }

  /** 렐릭 정보창. 편성 화면처럼 아직 전투 전이라 현재 상태가 없을 때 쓴다. */
  showRelic(def: RelicDef): void {
    this.open(def.name, `${def.origin} · ${ROLE_LABEL[def.role]}`, this.describe(def), def.id);
  }

  /** 전투 중인 렐릭 정보창. 지금 HP와 궁극기 게이지가 함께 붙는다. */
  showUnit(unit: BattleUnit, isFront: boolean): void {
    const live = [
      `현재 HP ${unit.hp} / ${unit.maxHp}`,
      `궁극기 게이지 ${unit.energy} / ${ULTIMATE_MAX}`,
      `위치 ${isFront ? "전방(선봉)" : "후방"}`,
    ].join("\n");
    this.open(
      unit.def.name,
      `${unit.def.origin} · ${ROLE_LABEL[unit.def.role]}`,
      `[ 현재 상태 ]\n${live}\n\n${this.describe(unit.def)}`,
      unit.def.id,
    );
  }

  /** 스킬 툴팁. 정보창과 같은 틀을 쓴다. */
  showSkill(kind: string, name: string, desc: string, extra?: string): void {
    this.open(name, kind, extra ? `${desc}\n\n${extra}` : desc);
  }

  /** 적 진형 전체. 선봉이 누구인지 먼저 보이게 순서대로 늘어놓는다. */
  showEnemyTeam(units: BattleUnit[], order: number[]): void {
    const body = order
      .map((unitIndex, slot) => {
        const unit = units[unitIndex];
        return [
          `${slot === 0 ? "[ 전방 · 선봉 ]" : "[ 후방 ]"} ${unit.def.name}`,
          `${unit.def.origin} · ${ROLE_LABEL[unit.def.role]}`,
          `HP ${unit.hp} / ${unit.maxHp}   공격 ${unit.def.stats.atk}   방어 ${unit.def.stats.def}`,
          `패시브 · ${unit.def.passive.name} — ${unit.def.passive.desc}`,
          `궁극기 · ${unit.def.ultimate.name} — ${unit.def.ultimate.desc}`,
        ].join("\n");
      })
      .join("\n\n");
    this.open("적 침식체", "진형 순서대로", body);
  }

  /**
   * 렐릭 한 명의 설명 본문. 능력치 · 패시브 · 기본 공격 · 궁극기를
   * 언제나 이 순서로 낸다. 정보창이 여러 곳에서 열려도 읽는 순서가 흔들리지 않게 하려는 것이다.
   */
  private describe(def: RelicDef): string {
    return [
      "[ 능력치 ]",
      `HP ${def.stats.hp}   공격 ${def.stats.atk}   방어 ${def.stats.def}`,
      "",
      `[ 패시브 ] ${def.passive.name}`,
      def.passive.desc,
      "",
      `[ 기본 공격 ] ${def.basic.name}`,
      def.basic.desc,
      "",
      `[ 궁극기 ] ${def.ultimate.name}   (게이지 ${def.ultimate.cost})`,
      def.ultimate.desc,
    ].join("\n");
  }
}
