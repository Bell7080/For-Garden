import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { deriveSummonStats } from "../core/summonStats";
import type { RelicDef, Stats, SummonDef } from "../core/types";
import { setDebugInfoAssetReady } from "../debug";
import { t } from "../i18n";
import { KeywordManager } from "../managers/KeywordManager";
import { battleAssetFor, enableHitOnClick, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { enemyInfoPanelCenterY } from "./enemyInfoLayout";
import { paintInfoHeader, paintInfoSkills, paintInfoStats, type InfoPopupContext } from "./EnemyInfoPopup";
import { FaceFrame } from "./FaceFrame";
import { addInfoFigureStand, addInfoPanel } from "./info";
import { mountInfoPopupFrame } from "./infoPopupFrame";
import { addObservationJournalButton, openObservationJournal } from "./ObservationJournal";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { addSectionTitle } from "./SectionTitle";
import { statToneHex } from "./statTones";
import { SUMMON_INFO as L } from "./summonInfoLayout";
import { COLOR, textStyle } from "./theme";

/** 소환수 창이 세우는 것. 능력치는 창이 다시 셈하지 않도록 지휘자의 **지금** 능력치를 받는다. */
export interface SummonInfoSubject {
  /** 부른 지휘자. 이름·얼굴과 레벨·돌파를 읽는다. */
  owner: RelicDef;
  /** 지휘자가 지금 가진 최종 능력치(레벨·돌파·룬 반영). 늑대의 모든 수치가 여기서 나온다. */
  ownerStats: Readonly<Stats>;
  summon: SummonDef;
}

/** 팝업 몸판 가운데가 앉는 화면 자리. Puppet은 컨테이너 변환을 물려받지 않아 화면 좌표로 선다. */
const SCREEN_CENTER = { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 } as const;

/**
 * 소환수 정보창 — 쿠로·시로처럼 **지휘자에게 딸린 몸**을 여는 한 장.
 *
 * 판·이름 블록·능력치 칸·스킬 액자는 적 정보창과 같은 프리팹이다(`mountInfoPopupFrame`·
 * `paintInfo*`). 다른 것은 소환수에게 뜻이 없는 칸(등급·돌파·레벨·전신 원화·패시브)을 빼고, 그
 * 자리에 **누구의 몸인가 · 무엇으로 자라나 · 쓰러지면 어떻게 돌아오나**를 세운 것이다. 자리는
 * `summonInfoLayout.ts`가 갖는다.
 */
export class SummonInfoPopup {
  private readonly keywords: KeywordManager;
  private chrome?: Phaser.GameObjects.Container;
  private figure?: PuppetCreature;
  private generation = 0;
  private open = false;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {
    this.keywords = new KeywordManager(scene, popups);
  }

  get isOpen(): boolean { return this.open; }

  show(subject: SummonInfoSubject): void {
    if (this.open) return;
    this.open = true;
    const generation = ++this.generation;
    const { owner, ownerStats, summon } = subject;
    const def: RelicDef = { ...summon.def, stats: deriveSummonStats(ownerStats, summon) };
    this.popups.open({
      width: L.width, height: L.height, title: t("info.summon.title"), titleSize: POPUP_TITLE_SIZE.workboard,
      dim: true, dimAlpha: 0.64, closeOnBackdrop: false, backButton: true,
      onClose: () => this.dispose(),
    }, (body) => {
      const { chrome, mask, depth } = mountInfoPopupFrame(this.scene, this.popups, body, L);
      this.chrome = chrome;
      const ctx: InfoPopupContext = { scene: this.scene, popups: this.popups, keywords: this.keywords };
      paintInfoHeader(ctx, chrome, def, L, t("info.summon.owner", { owner: owner.name }));
      this.paintOwnerFace(chrome, owner);
      this.paintGrowth(chrome, owner, ownerStats, summon);
      paintInfoStats(ctx, chrome, def, L);
      this.paintResummon(chrome, summon);
      // 늑대는 레벨·돌파를 따로 갖지 않는다. 돌파가 스킬에 붙이는 몫도 없어 0으로 넘긴다.
      paintInfoSkills(ctx, chrome, { def, level: 1, breakthrough: 0 }, L, ["basic", "ultimate"]);
      addInfoFigureStand(this.scene, chrome, L.figure.x, L.figure.groundY);
      addObservationJournalButton({ scene: this.scene, popups: this.popups }, chrome,
        L.journalButton.x, L.journalButton.y,
        (from) => openObservationJournal(ctx, { def, owned: true, interviews: false, from }),
        L.journalButton.size);
      void this.loadFigure(def, generation, depth + 0.4, mask);
    });
  }

  close(): void { if (this.open) this.popups.closeTop(); }

  private dispose(): void {
    this.open = false;
    this.generation += 1;
    setDebugInfoAssetReady(undefined);
    this.figure?.destroy(); this.figure = undefined;
    this.chrome?.destroy(); this.chrome = undefined;
  }

  /** 누구의 몸인가 — 적 창의 돌파 등급 표식 자리에 지휘자의 얼굴이 선다. */
  private paintOwnerFace(chrome: Phaser.GameObjects.Container, owner: RelicDef): void {
    chrome.add(new FaceFrame(this.scene, L.ownerFace.x, L.ownerFace.y, { portraitAssetId: owner.portraitAssetId, size: L.ownerFace.size }));
  }

  /**
   * 성장 기준 칸 — 적 창의 레벨 칸과 같은 자리·같은 글자 크기다.
   *
   * 큰 수는 **지휘자의 그 능력치**이고 색도 그 능력치의 색이다. 늑대의 수치가 무엇을 따라 오르는지는
   * 이 수 하나가 말하고, 실제로 얼마가 되었는지는 바로 아래 오각형이 말한다.
   */
  private paintGrowth(chrome: Phaser.GameObjects.Container, owner: RelicDef, ownerStats: Readonly<Stats>, summon: SummonDef): void {
    const { column, growthPanel } = L;
    const panel = addInfoPanel(this.scene, chrome, column.x, enemyInfoPanelCenterY(growthPanel), column.width, growthPanel.height);
    addSectionTitle(this.scene, column.x - column.width / 2, growthPanel.top - 4, t("info.summon.growth"), { parent: chrome });
    const stat = summon.growthStat;
    const value = this.scene.add
      .text(-column.width / 2 + 54, -66, String(Math.round(ownerStats[stat])), textStyle({ role: "display", size: 96, color: statToneHex(stat) }))
      .setOrigin(0, 0)
      .setScale(1, 1.16)
      .setShadow(3, 8, "#05070a", 10, false, true);
    panel.add(value);
    panel.add(this.scene.add
      .text(value.x + value.displayWidth + 14, value.y + value.displayHeight - 4,
        t("info.summon.growthSource", { owner: owner.name, stat: t(stat === "atk" ? "skill.stat.atk" : "skill.stat.ap") }),
        textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim }))
      .setOrigin(0, 1));
  }

  /**
   * 재소환 칸 — 쓰러지면 몇 초 뒤, 체력 얼마로 돌아오는가.
   *
   * 큰 수가 시간이고 체력은 발치에 체력 색으로 붙는다. 다시 서지 않는 소환수는 그 사실만 적는다.
   */
  private paintResummon(chrome: Phaser.GameObjects.Container, summon: SummonDef): void {
    const { column, resummonPanel } = L;
    const panel = addInfoPanel(this.scene, chrome, column.x, enemyInfoPanelCenterY(resummonPanel), column.width, resummonPanel.height);
    addSectionTitle(this.scene, column.x - column.width / 2, resummonPanel.top - 4, t("info.summon.resummon"), { parent: chrome });
    const rule = summon.resummon;
    const value = this.scene.add
      .text(-column.width / 2 + 54, -62, rule.enabled ? t("info.summon.resummonValue", { seconds: rule.cooldownSeconds }) : t("info.summon.resummonNone"),
        textStyle({ role: "display", size: 84 }))
      .setOrigin(0, 0)
      .setScale(1, 1.16)
      .setShadow(3, 8, "#05070a", 10, false, true);
    panel.add(value);
    if (!rule.enabled) return;
    panel.add(this.scene.add
      .text(value.x + value.displayWidth + 14, value.y + value.displayHeight - 4, t("info.summon.resummonHp", { percent: rule.hpPercent }),
        textStyle({ role: "emphasis", size: 28, color: statToneHex("hp") }))
      .setOrigin(0, 1));
  }

  /**
   * SD — 전신 원화가 없는 몸이라 **SD가 곧 이 창의 인물**이다. 왼쪽 기둥에 받침째 크게 서고, 칸·
   * 액자보다 아래 층이라 폭주 뱃지나 능력치 칸을 덮지 않는다. 누르면 받침의 SD처럼 한 번 튄다.
   */
  private async loadFigure(def: RelicDef, generation: number, depth: number, mask: Phaser.Display.Masks.GeometryMask): Promise<void> {
    setDebugInfoAssetReady({ portrait: false, sd: false });
    const figure = await spawnPuppet(this.scene, battleAssetFor(def.id), {
      x: SCREEN_CENTER.x + L.figure.x,
      groundY: SCREEN_CENTER.y + L.figure.groundY,
      height: L.figure.height,
      depth,
    });
    if (generation !== this.generation || !this.open) { figure.destroy(); return; }
    this.figure?.destroy();
    this.figure = figure;
    figure.disableInteractive();
    figure.setMask(mask);
    figure.setAlpha(0);
    this.scene.tweens.add({ targets: figure, alpha: 1, duration: 220 });
    enableHitOnClick(this.scene, figure);
    setDebugInfoAssetReady({ portrait: true, sd: true });
  }
}
