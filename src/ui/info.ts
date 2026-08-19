import Phaser from "phaser";
import type { PuppetCreature } from "puppetforge/phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "../config/gameConfig";
import type { BattleUnit } from "../core/battle";
import { ULTIMATE_MAX } from "../core/battle";
import type { RelicDef } from "../core/types";
import { setDebugInfoOpen } from "../debug";
import { enableHitOnClick, portraitAssetFor, spawnPuppet, tintPuppet } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { COLOR, textStyle } from "./theme";
import { addSceneBackground, BACKGROUND } from "./backgrounds";

/** 전신 일러스트는 화면 왼쪽을 크게 쓰고, 오른쪽에 전투 정보를 겹쳐 배치한다. */
const PORTRAIT = { x: 390, groundY: 1540, height: 1320 } as const;

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
  private readonly scene: Phaser.Scene;
  private readonly portraitDepth: number;
  private readonly root: Phaser.GameObjects.Container;
  /** 캐릭터보다 앞에 그려지는 정보 레이어. */
  private readonly chrome: Phaser.GameObjects.Container;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly rarityText: Phaser.GameObjects.Text;
  /** 전신 일러스트. 파일을 읽는 동안에도 정보창은 열 수 있어야 해서 늦게 붙는다. */
  private portrait?: PuppetCreature;
  private portraitWanted = false;
  /** 빠른 캐릭터 전환 중 이전 로딩 결과가 최신 원화를 덮지 않게 하는 요청 번호다. */
  private portraitRequest = 0;

  constructor(scene: Phaser.Scene, portraitDepth = 1001) {
    this.scene = scene;
    this.portraitDepth = portraitDepth;
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    this.chrome = scene.add.container(0, 0).setDepth(1002).setVisible(false);

    // 반투명 암막 대신 화면 전체를 쓰는 도감 페이지로 만들어 전신이 잘리지 않게 한다.
    // background_003의 문양이 정보창 전체를 도감의 전시 공간처럼 감싸도록 루트에 넣는다.
    const background = addSceneBackground(scene, BACKGROUND.info, 0);
    this.root.add(background);
    const shade = scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.58)
      .setInteractive();
    this.root.add(shade);

    // 옅은 세로선과 큰 인덱스 숫자가 연구 기록지 같은 기존 세계관을 이어 준다.
    this.root.add(scene.add.rectangle(28, BASE_HEIGHT / 2, 4, BASE_HEIGHT, COLOR.accent, 0.75));
    this.root.add(scene.add.rectangle(48, 620, 2, 1040, COLOR.panelEdge, 0.8));
    this.root.add(
      scene.add.text(72, 186, "RELIC / ARCHIVE", textStyle({ size: 20, color: COLOR.inkDim })).setAngle(-90),
    );

    // 닫기 버튼은 모바일 엄지로도 누르기 쉬운 88px 터치 영역을 확보한다.
    const closeHit = scene.add
      .rectangle(BASE_WIDTH - 72, 76, 88, 88, COLOR.panel, 0.9)
      .setStrokeStyle(2, COLOR.panelEdge)
      .setInteractive({ useHandCursor: true });
    closeHit.on("pointerup", () => this.hide());
    this.chrome.add(closeHit);
    this.chrome.add(scene.add.text(BASE_WIDTH - 72, 76, "×", textStyle({ size: 54, bold: false })).setOrigin(0.5));

    this.rarityText = scene.add
      .text(86, 82, "SSR", textStyle({ size: 30, color: COLOR.accentText }))
      .setOrigin(0, 0.5);
    this.chrome.add(this.rarityText);
    this.chrome.add(scene.add.rectangle(166, 82, 190, 3, COLOR.accent, 0.8).setOrigin(0, 0.5));

    this.titleText = scene.add
      .text(82, 124, "", textStyle({ size: 72 }))
      .setOrigin(0, 0);
    this.chrome.add(this.titleText);

    this.subtitleText = scene.add
      .text(86, 212, "", textStyle({ size: 25, color: COLOR.inkDim }))
      .setOrigin(0, 0);
    this.chrome.add(this.subtitleText);

    // 우측 능력 패널은 일러스트 위에 떠 있는 계기판처럼 반투명하게 처리한다.
    const dataPanel = scene.add
      .rectangle(786, 770, 500, 760, COLOR.panel, 0.92)
      .setStrokeStyle(2, COLOR.panelEdge);
    this.chrome.add(dataPanel);
    this.chrome.add(scene.add.rectangle(544, 404, 8, 82, COLOR.accent));
    this.chrome.add(scene.add.text(574, 414, "COMBAT DATA", textStyle({ size: 23, color: COLOR.accentText })));

    this.bodyText = scene.add
      .text(
        580,
        482,
        "",
        textStyle({ size: 23, lineSpacing: 8, wrap: 420 }),
      )
      .setOrigin(0, 0);
    this.chrome.add(this.bodyText);

    // 하단의 탭과 장식은 참고 이미지의 조작 밀도를 빌리되 실제 기능처럼 오해하지 않게 고정 라벨로 둔다.
    const footerY = 1660;
    const footer = scene.add.rectangle(BASE_WIDTH / 2, footerY, BASE_WIDTH - 100, 250, COLOR.panel, 0.96)
      .setStrokeStyle(2, COLOR.panelEdge);
    this.chrome.add(footer);
    this.chrome.add(scene.add.text(78, footerY - 96, "STATUS", textStyle({ size: 22, color: COLOR.accentText })));
    ["DNA", "ROLE", "SKILL"].forEach((label, index) => {
      const x = 710 + index * 105;
      const tile = scene.add.rectangle(x, footerY + 10, 82, 82, index === 2 ? COLOR.accent : COLOR.panelEdge, 0.9)
        .setStrokeStyle(2, index === 2 ? COLOR.accent : COLOR.panelEdge);
      this.chrome.add(tile);
      this.chrome.add(scene.add.text(x, footerY + 10, label.slice(0, 1), textStyle({
        size: 24,
        color: index === 2 ? "#1a1d21" : COLOR.ink,
      })).setOrigin(0.5));
      this.chrome.add(scene.add.text(x, footerY + 70, label, textStyle({ size: 15, color: COLOR.inkDim })).setOrigin(0.5));
    });
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  hide(): void {
    this.root.setVisible(false);
    this.chrome.setVisible(false);
    this.portraitWanted = false;
    this.portrait?.setVisible(false);
    setDebugInfoOpen(false);
  }

  private async loadPortrait(relicId: string): Promise<void> {
    const request = ++this.portraitRequest;
    // 루트 배경과 정보 레이어 사이에 세워 UI가 캐릭터 위로 선명하게 읽힌다.
    const portrait = await spawnPuppet(this.scene, portraitAssetFor(relicId), {
      ...PORTRAIT,
      depth: Math.max(this.portraitDepth, 1001),
    });
    if (request !== this.portraitRequest) {
      portrait.destroy();
      return;
    }
    this.portrait?.destroy();
    this.portrait = portrait;
    enableHitOnClick(this.scene, portrait);
    // 아직 전용 원화가 없는 렐릭만 기존 임시 tint로 구분한다.
    if (relicId !== "anky" && relicId !== "rex") tintPuppet(portrait, mixWhite(tintFor(relicId), 0.55));
    portrait.setVisible(this.portraitWanted && this.root.visible);
  }

  /** 일러스트는 렐릭 한 명을 볼 때만 띄운다. 목록을 볼 때는 글이 들어갈 자리가 필요하다. */
  private open(title: string, subtitle: string, body: string, relicId?: string): void {
    this.titleText.setText(title);
    this.subtitleText.setText(subtitle);
    this.bodyText.setText(body);
    const hasPortrait = relicId !== undefined;
    this.rarityText.setText(hasPortrait ? "SSR" : "INFO");
    this.bodyText.setPosition(hasPortrait ? 580 : 100, hasPortrait ? 482 : 370);
    this.bodyText.setWordWrapWidth(hasPortrait ? 420 : 880);

    this.portraitWanted = hasPortrait;
    this.portrait?.setVisible(false);
    if (relicId) void this.loadPortrait(relicId);

    this.root.setVisible(true);
    this.chrome.setVisible(true);
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
