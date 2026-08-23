import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { RelicDef } from "../core/types";
import type { Fighter } from "../core/skirmish";
import { setDebugInfoOpen } from "../debug";
import type { PuppetAsset, PuppetCreature } from "../puppets/assets";
import { battleAssetFor, enemyPortraitAssetFor, spawnPuppet } from "../puppets/assets";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { addSceneBackground, BACKGROUND } from "./backgrounds";
import { drawGlassFade, drawHairline, drawLayer, HoloBar, slantedRect } from "./holo";
import { addBackButton } from "./IconButton";
import { COLOR, textStyle } from "./theme";

/**
 * 적 분석창.
 *
 * 적에게는 급여·돌파·유대·룬이 없다. 그래서 아군 정보창(`info.ts`)을 문맥만 바꿔 재사용하지
 * 않고 화면 자체를 따로 둔다 — 같은 판을 쓰면 "이 적에게 치즈케이크를 먹일 수 있나" 같은
 * 물음이 화면에 남는다. 여기서 읽는 것은 **이 개체가 얼마나 위험한가** 하나다.
 *
 * 전투 중(`live`가 있을 때)은 지금 값을, 출전 전에는 스테이지 레벨까지 반영한 예상 전력을
 * 같은 자리에 같은 모양으로 보여 준다. 지도·편성·전투가 서로 다른 적 창을 갖지 않는다.
 */
export class EnemyStatusWindow {
  private readonly root: Phaser.GameObjects.Container;
  private portrait?: PuppetCreature;
  /** 늦게 끝난 비동기 원화가 새 선택을 덮지 않게 구분하는 요청 번호다. */
  private request = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  /** 전투 중인 적. 지금 게이지와 상태이상까지 그대로 보여 준다. */
  showFighter(fighter: Fighter): void {
    this.show(fighter.def, { live: fighter });
  }

  /**
   * 적 하나를 연다.
   *
   * `def.stats`는 이미 스테이지 레벨이 반영된 값이다(`getStageEnemies`). 창이 레벨 보정을
   * 다시 하지 않는 이유는, 보정 규칙이 둘로 갈라지면 지도에서 본 수치와 전투의 수치가
   * 어긋나기 때문이다. 창은 받은 것을 그대로 읽는다.
   */
  show(def: RelicDef, options: { level?: number; live?: Fighter } = {}): void {
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
    const name = this.scene.add.text(48, 98, def.name, textStyle({ role: "display", size: 76 }));
    const level = options.live ? "" : options.level === undefined ? "" : `  ·  LV.${options.level}`;
    const specimen = this.scene.add.text(52, 198, `위협 개체 · NO.${def.specimenNumber}${level}`, textStyle({ role: "body", size: 26, color: COLOR.inkDim }));
    this.root.add([title, name, specimen]);
    this.root.add(new AffinityBadge(this.scene, 790, 160, ELEMENT_ICON[def.element], 86));
    this.root.add(new AffinityBadge(this.scene, 900, 164, ROLE_ICON[def.role], 68));

    // 분석판은 내용을 다 쌓은 **뒤에** 그 뒤로 깔린다. 전투 중에는 게이지 셋이, 출전 전에는
    // 야성 발현이 들어와 길이가 달라지는데, 판 높이를 못으로 박아 두면 한쪽이 판 밖으로
    // 흘러넘친다. 자리는 여기서 기억해 두고 크기가 정해지면 이 자리로 끼워 넣는다.
    const panelIndex = this.root.length;
    const panelTop = 405;

    // 판 안의 세로 자리는 위에서부터 쌓아 내려간다. 칸이 하나 빠지는 출전 전에도 아래가
    // 비어 보이지 않고, 칸을 더할 때 좌표를 전부 다시 세지 않는다.
    const live = options.live;
    let y = this.addSection(live ? "현재 전투 상태" : "예상 전력", 548);
    if (live) {
      y = this.addGauge("HP", live.hp / live.maxHp, `${Math.ceil(live.hp)} / ${live.maxHp}`, y, COLOR.hpEnemy);
      y = this.addGauge("궁극", live.energy / 100, `${Math.round(live.energy)} / 100`, y, COLOR.energy);
      y = this.addGauge("야성", live.ferocity / 100, `${Math.round(live.ferocity)} / 100`, y, COLOR.ferocityLow);
      const ailment = live.bleed ? `출혈 · ${Math.ceil(live.bleed.remaining)}초` : "상태이상 없음";
      this.root.add(this.scene.add.text(558, y, ailment, textStyle({ role: "emphasis", size: 25, color: live.bleed ? "#e16a63" : COLOR.inkDim })));
      y += 104;
    } else {
      // 출전 전에는 아직 깎인 체력도 찬 게이지도 없다. 가득 찬 체력만 보여 주고, 남은 자리는
      // "무엇을 조심해야 하는가"(야성 발현)로 채운다.
      y = this.addGauge("HP", 1, `${def.stats.hp}`, y, COLOR.hpEnemy);
      const trait = this.scene.add.text(558, y, `야성 발현 · ${def.ferocityTrait.name}\n${def.ferocityTrait.desc}`, textStyle({ role: "body", size: 23, color: COLOR.inkDim }));
      trait.setWordWrapWidth(400);
      this.root.add(trait);
      y += trait.height + 44;
    }

    y = this.addSection("전투 능력", y);
    const stats = def.stats;
    const rows = [`공격  ${stats.atk}`, `주문  ${stats.ap}`, `방어  ${stats.def}`, `저항  ${stats.res}`, `공속  ${stats.attackSpeed}`, `이속  ${stats.moveSpeed}`];
    rows.forEach((row, index) => this.root.add(this.scene.add.text(568 + (index % 2) * 210, y + Math.floor(index / 2) * 72, row, textStyle({ role: "body", size: 25, color: COLOR.ink }))));
    y += Math.ceil(rows.length / 2) * 72 + 32;

    const skills = this.scene.add.text(558, y, `패시브 · ${def.passive.name}\n${def.passive.desc}\n\n궁극기 · ${def.ultimate.name}\n${def.ultimate.desc}`, textStyle({ role: "body", size: 23, color: COLOR.inkDim, lineSpacing: 4 }));
    skills.setWordWrapWidth(400);
    this.root.add(skills);

    const panelBottom = y + skills.height + 46;
    this.root.addAt(drawLayer(this.scene, 760, (panelTop + panelBottom) / 2, slantedRect(500, panelBottom - panelTop, 20), {
      fill: 0x111923,
      alpha: 0.88,
      edge: COLOR.hpEnemy,
      edgeAlpha: 0.55,
    }), panelIndex);

    const back = addBackButton(this.scene, () => this.close());
    back.setDepth(1002);
    this.root.add(back);
    void this.loadPortrait(def);
  }

  /** 제목과 짧은 붉은 표식만으로 분석판 안의 정보 위계를 나눈다. 다음 줄이 시작할 y를 준다. */
  private addSection(label: string, y: number): number {
    this.root.add(this.scene.add.rectangle(558, y + 14, 7, 34, COLOR.hpEnemy).setOrigin(0, 0.5));
    this.root.add(this.scene.add.text(580, y, label, textStyle({ role: "emphasis", size: 27, color: COLOR.ink })));
    return y + 82;
  }

  /** 전투 게이지는 다른 화면과 같은 HoloBar 모양으로 읽히게 한다. */
  private addGauge(label: string, ratio: number, value: string, y: number, color: number): number {
    this.root.add(this.scene.add.text(558, y, label, textStyle({ role: "body", size: 21, color: COLOR.inkDim })));
    this.root.add(this.scene.add.text(958, y, value, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(1, 0));
    const bar = new HoloBar(this.scene, 758, y + 48, 400, 14, { color });
    bar.setValue(Math.max(0, Math.min(1, ratio)));
    this.root.add([...bar.objects]);
    return y + 102;
  }

  /**
   * 적 번호별 전용 전신 Puppet을 왼쪽 분석 영역에 세운다.
   *
   * 전용 전신이 아직 없는 개체는 전투에 서는 SD로 대신한다. 원화 하나가 없다고 분석창 전체가
   * 열리지 않으면, 정작 봐야 할 수치까지 함께 사라진다.
   */
  private async loadPortrait(def: RelicDef): Promise<void> {
    const request = ++this.request;
    let asset: PuppetAsset;
    try {
      asset = enemyPortraitAssetFor(def.id);
    } catch {
      asset = battleAssetFor(def.id);
    }
    const portrait = await spawnPuppet(this.scene, asset, { x: 300, groundY: 1760, height: 1080 });
    if (request !== this.request || !this.root.visible) return void portrait.destroy();
    this.portrait = portrait;
    // 바탕과 어둠막 바로 위, 위쪽 유리면보다는 아래다. 원화가 제목 위로 올라오면 이름과
    // 개체번호가 밝은 그림에 묻혀 읽히지 않는다.
    this.root.addAt(portrait, 2);
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
