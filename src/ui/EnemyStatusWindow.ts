import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { Fighter } from "../core/skirmish";
import { setDebugInfoOpen } from "../debug";
import type { PuppetCreature } from "../puppets/assets";
import { enemyPortraitAssetFor, spawnPuppet } from "../puppets/assets";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addSceneBackground, BACKGROUND } from "./backgrounds";
import { drawGlassFade, drawHairline, drawLayer, HoloBar, slantedRect } from "./holo";
import { addBackButton } from "./IconButton";
import { COLOR, textStyle } from "./theme";

/** 전투 중인 적에게만 허용되는 현재 수치를 보여 주는 읽기 전용 분석창이다. */
export class EnemyStatusWindow {
  private readonly root: Phaser.GameObjects.Container;
  private portrait?: PuppetCreature;
  /** 늦게 끝난 비동기 원화가 새 선택을 덮지 않게 구분하는 요청 번호다. */
  private request = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
  }

  /** 소유자 성장 UI를 만들지 않고 전투 스냅샷만으로 적 분석 화면을 연다. */
  show(fighter: Fighter): void {
    this.close(false);
    this.root.removeAll(true);
    this.root.setVisible(true);
    setDebugInfoOpen(true);

    // 전장과 구분되는 공용 정보 배경 위에 기존 홀로그램 면과 얇은 선만 사용한다.
    this.root.add(addSceneBackground(this.scene, BACKGROUND.info, 0));
    this.root.add(this.scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.58).setInteractive());
    this.root.add(drawGlassFade(this.scene, BASE_WIDTH / 2, 180, BASE_WIDTH, 430, { topAlpha: 0.94, bottomAlpha: 0 }));
    this.root.add(drawHairline(this.scene, BASE_WIDTH / 2, 286, BASE_WIDTH - 84, { color: COLOR.hpEnemy, alpha: 0.7 }));

    const title = this.scene.add.text(48, 52, "HOSTILE ANALYSIS", textStyle({ role: "emphasis", size: 24, color: "#e16a63" }));
    const name = this.scene.add.text(48, 98, fighter.def.name, textStyle({ role: "display", size: 76 }));
    const specimen = this.scene.add.text(52, 198, `위협 개체 · NO.${fighter.def.specimenNumber}`, textStyle({ role: "body", size: 26, color: COLOR.inkDim }));
    this.root.add([title, name, specimen]);
    this.root.add(new AffinityBadge(this.scene, 790, 160, ELEMENT_ICON[fighter.def.element], 86));
    this.root.add(new AffinityBadge(this.scene, 900, 164, ROLE_ICON[fighter.def.role], 68));

    // 오른쪽 분석판은 강화·급여·유대 입력 없이 현재 전투값과 정적 전투 능력만 담는다.
    const panel = drawLayer(this.scene, 760, 930, slantedRect(500, 1050, 20), { fill: 0x111923, alpha: 0.88, edge: COLOR.hpEnemy, edgeAlpha: 0.55 });
    this.root.add(panel);
    this.addSection("현재 전투 상태", 548);
    this.addGauge("HP", fighter.hp / fighter.maxHp, `${Math.ceil(fighter.hp)} / ${fighter.maxHp}`, 630, COLOR.hpEnemy);
    this.addGauge("궁극", fighter.energy / 100, `${Math.round(fighter.energy)} / 100`, 732, COLOR.energy);
    this.addGauge("야성", fighter.ferocity / 100, `${Math.round(fighter.ferocity)} / 100`, 834, COLOR.ferocityLow);
    const ailment = fighter.bleed ? `출혈 · ${Math.ceil(fighter.bleed.remaining)}초` : "상태이상 없음";
    this.root.add(this.scene.add.text(558, 912, ailment, textStyle({ role: "emphasis", size: 25, color: fighter.bleed ? "#e16a63" : COLOR.inkDim })));

    this.addSection("전투 능력", 1016);
    const stats = fighter.def.stats;
    const rows = [`공격  ${stats.atk}`, `주문  ${stats.ap}`, `방어  ${stats.def}`, `저항  ${stats.res}`, `공속  ${stats.attackSpeed}`, `이속  ${stats.moveSpeed}`];
    rows.forEach((row, index) => this.root.add(this.scene.add.text(568 + (index % 2) * 210, 1082 + Math.floor(index / 2) * 72, row, textStyle({ role: "body", size: 25, color: COLOR.ink }))));
    const passive = this.scene.add.text(558, 1330, `패시브 · ${fighter.def.passive.name}\n${fighter.def.passive.desc}`, textStyle({ role: "body", size: 23, color: COLOR.inkDim }));
    passive.setWordWrapWidth(400);
    this.root.add(passive);

    const back = addBackButton(this.scene, () => this.close());
    back.setDepth(1002);
    this.root.add(back);
    void this.loadPortrait(fighter);
  }

  /** 제목과 짧은 붉은 표식만으로 분석판 안의 정보 위계를 나눈다. */
  private addSection(label: string, y: number): void {
    this.root.add(this.scene.add.rectangle(558, y + 14, 7, 34, COLOR.hpEnemy).setOrigin(0, 0.5));
    this.root.add(this.scene.add.text(580, y, label, textStyle({ role: "emphasis", size: 27, color: COLOR.ink })));
  }

  /** 전투 게이지는 다른 화면과 같은 HoloBar 모양으로 읽히게 한다. */
  private addGauge(label: string, ratio: number, value: string, y: number, color: number): void {
    this.root.add(this.scene.add.text(558, y, label, textStyle({ role: "body", size: 21, color: COLOR.inkDim })));
    this.root.add(this.scene.add.text(958, y, value, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(1, 0));
    const bar = new HoloBar(this.scene, 758, y + 48, 400, 14, { color });
    bar.setValue(Math.max(0, Math.min(1, ratio)));
    this.root.add([...bar.objects]);
  }

  /** 적 번호별 전용 전신 Puppet을 왼쪽 분석 영역에 세운다. */
  private async loadPortrait(fighter: Fighter): Promise<void> {
    const request = ++this.request;
    const portrait = await spawnPuppet(this.scene, enemyPortraitAssetFor(fighter.def.id), { x: 280, groundY: 1650, height: 1190, depth: 1001 });
    if (request !== this.request || !this.root.visible) return void portrait.destroy();
    this.portrait = portrait;
    this.root.addAt(portrait, 4);
  }

  /** 닫을 때 원화와 디버그 표시를 함께 정리하며, 재오픈 준비 때는 표시 갱신을 생략할 수 있다. */
  close(updateDebug = true): void {
    this.request += 1;
    this.portrait?.destroy();
    this.portrait = undefined;
    this.root.setVisible(false);
    if (updateDebug) setDebugInfoOpen(false);
  }
}
