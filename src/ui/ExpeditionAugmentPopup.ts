import Phaser from "phaser";
import type { ExpeditionAugmentOffer, ExpeditionAugmentSelection } from "../core/expeditionRewards";
import { getExpeditionAugment, type ExpeditionAugmentDef } from "../data/expeditionAugments";
import { getRelic } from "../data/relics";
import { Button } from "./Button";
import { PortraitCard, relicCardTint } from "./PortraitCard";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { chipPoints, drawHairline, drawLayer, HOLO } from "./holo";

/** 선택 화면과 확정 목록이 공유하는 효과 수치 표기다. 운영 데이터의 값을 문구에 다시 적지 않는다. */
export function expeditionAugmentEffectLabel(def: ExpeditionAugmentDef): string {
  if (def.effect.kind === "attackPowerPercent") return `공격력 +${def.effect.percent}%`;
  if (def.effect.kind === "healAfterBattlePercent") return `전투 후 체력 +${def.effect.percent}%`;
  return `공격 시 출혈 ${def.effect.percent}% · ${def.effect.seconds}초`;
}

/** 등급과 범위를 짧은 인게임 표기로 바꾸되 실제 판정은 정적 데이터의 값을 그대로 사용한다. */
export function expeditionAugmentMetaLabel(def: ExpeditionAugmentDef): string {
  return `${def.rarity === "advanced" ? "고급" : "일반"} · ${def.target === "party" ? "전체" : "개인"}`;
}

interface ExpeditionAugmentPopupOptions {
  round: number;
  totalRounds: number;
  offers: readonly ExpeditionAugmentOffer[];
  relics: readonly { relicId: string; alive: boolean }[];
  onChoose: (selection: ExpeditionAugmentSelection) => void;
}

/**
 * 전투 진입 전에 저장된 증강 후보를 고르는 작업판이다.
 *
 * 전체/개인 효과 모두 후보를 고른 뒤 하단 확정 버튼에서만 저장한다.
 * 얼굴 선택은 PortraitCard 자체의 확대·발광을 사용해 별도 선택 테두리를 만들지 않는다.
 */
export class ExpeditionAugmentPopup {
  private readonly popup: PopupLayer;
  private selectedOffer?: ExpeditionAugmentOffer;
  private selectedTargetRelicId?: string;
  private targetCards = new Map<string, PortraitCard>();
  /** 후보를 바꿀 때 이전 호박빛 면을 반드시 끄기 위한 카드별 선택 레이어다. */
  private offerSelections = new Map<string, Phaser.GameObjects.GameObject & { setVisible(value: boolean): unknown }>();
  /** 개인 증강을 고른 동안 선택 가능한 얼굴에만 살아 있는 호흡을 부여한다. */
  private targetPulses: Phaser.Tweens.Tween[] = [];
  private confirmButton?: Button;

  constructor(private readonly scene: Phaser.Scene, private readonly options: ExpeditionAugmentPopupOptions) {
    this.popup = new PopupLayer(scene, 4000);
  }

  /** 지도보다 위에 닫을 수 없는 선택판을 열어 저장된 보상을 건너뛸 입력을 없앤다. */
  open(): void {
    this.popup.open({ width: 940, height: 1450, y: 970, title: `증강 선택 ${this.options.round} / ${this.options.totalRounds}`, dim: true, dimAlpha: 0.86, closeOnBackdrop: false, hideCloseButton: true, titleSize: 40 }, (body) => {
      // 세 후보는 요청된 가로 ㅁㅁㅁ 배열로 두고, 아이콘→이름→설명의 세 층으로 읽힌다.
      body.add(this.scene.add.text(0, -625, "전투 프로토콜", textStyle({ role: "emphasis", size: 24, color: COLOR.sortieText })).setOrigin(0.5));
      this.options.offers.forEach((offer, index) => this.addOffer(body, offer, -300 + index * 300, -345));
      body.add(this.scene.add.text(0, 70, "개인 증강을 고르면 아군을 선택합니다", textStyle({ role: "emphasis", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
      this.addTargets(body);
      this.confirmButton = new Button(this.scene, 0, 625, { width: 500, height: 104, label: "선택 확정", variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => this.confirmSelection() });
      this.confirmButton.setEnabled(false);
      body.add(this.confirmButton);
    });
  }

  /** 후보 판은 이름·등급·범위·효과 수치를 한 묶음으로 읽히게 한다. */
  private addOffer(body: Phaser.GameObjects.Container, offer: ExpeditionAugmentOffer, x: number, y: number): void {
    const def = getExpeditionAugment(offer.augmentId);
    if (!def) return;
    const card = this.scene.add.container(x, y);
    const shape = chipPoints(270, 360, { bevel: { topLeft: 30, bottomRight: 24 } });
    card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x171c24, alpha: HOLO.glass, edge: def.target === "party" ? COLOR.accent : COLOR.sortie, edgeAlpha: 0.65 }));
    // 개인 후보를 누른 상태는 호박빛 면으로 바뀌어 대상 선택 단계임을 카드 자체가 말한다.
    const selected = drawLayer(this.scene, 0, 0, shape, { fill: 0x5a3a12, alpha: 0.72, edge: COLOR.missionClaim, edgeAlpha: 0.96 }).setVisible(false);
    this.offerSelections.set(offer.augmentId, selected);
    card.add(selected);
    card.add(this.scene.add.image(0, -105, "skill-icon-buff").setDisplaySize(76, 76).setTint(def.target === "party" ? COLOR.accent : COLOR.sortie));
    card.add(this.scene.add.text(0, -20, def.name, textStyle({ role: "display", size: 25 })).setOrigin(0.5));
    card.add(drawHairline(this.scene, 0, 28, 210, { color: COLOR.accent, alpha: 0.3 }));
    card.add(this.scene.add.text(0, 82, `${expeditionAugmentMetaLabel(def)}\n${expeditionAugmentEffectLabel(def)}`, textStyle({ role: "body", size: 20, color: COLOR.inkDim, align: "center", wrap: 225, lineSpacing: 8 })).setOrigin(0.5));
    const hit = this.scene.add.rectangle(0, 0, 270, 360, 0xffffff, 0).setInteractive({ useHandCursor: true });
    card.add(hit); hit.on("pointerup", () => this.selectOffer(offer, def));
    body.add(card);
  }

  /** 서버 후보에 든 사망 렐릭도 흐리게 숨기지 않고, 상태 문구만 이름 아래에 남긴다. */
  private addTargets(body: Phaser.GameObjects.Container): void {
    this.options.relics.forEach((state, index) => {
      const def = getRelic(state.relicId);
      const card = new PortraitCard(this.scene, -280 + index * 280, 405, {
        width: 210, height: 230, portraitAssetId: def.portraitAssetId, tint: relicCardTint(def),
        label: def.name, sub: state.alive ? "활동 중" : "휴식 부활 가능", rarity: def.rarity,
      });
      card.hit.on("pointerup", () => this.selectTarget(state.relicId));
      body.add(card);
      // 컨테이너에 붙인 뒤 월드 좌표가 정해지므로 기하 마스크를 한 번 더 맞춘다.
      card.syncMask();
      this.targetCards.set(state.relicId, card);
    });
  }

  /** 후보 하나만 호박빛으로 유지하고 전체/개인 모두 확정 전 선택 상태에 머문다. */
  private selectOffer(offer: ExpeditionAugmentOffer, def: ExpeditionAugmentDef): void {
    this.selectedOffer = offer;
    this.selectedTargetRelicId = undefined;
    this.offerSelections.forEach((layer, augmentId) => layer.setVisible(augmentId === offer.augmentId));
    const partyWide = def.target === "party";
    this.targetCards.forEach((card, relicId) => {
      card.setAlpha(!partyWide && offer.eligibleTargetRelicIds.includes(relicId) ? 1 : 0.28);
      card.setSelected(false, COLOR.sortie);
    });
    // 선택 가능한 아군만 느리게 맥동해 다음 입력 위치를 안내한다.
    this.targetPulses.forEach((pulse) => pulse.stop()); this.targetPulses = [];
    this.targetCards.forEach((card, relicId) => {
      if (partyWide || !offer.eligibleTargetRelicIds.includes(relicId)) return;
      this.targetPulses.push(this.scene.tweens.add({ targets: card, scale: 1.055, duration: 650, yoyo: true, repeat: -1, ease: "Sine.InOut" }));
    });
    // 전체 효과는 대상이 없으므로 후보 선택만으로 확정 가능하지만 실제 저장은 버튼에서만 한다.
    this.confirmButton?.setEnabled(partyWide);
  }

  /** eligibleTargetRelicIds에 든 카드만 발광시키며 사망 여부는 클라이언트가 다시 배제하지 않는다. */
  private selectTarget(relicId: string): void {
    if (!this.selectedOffer?.eligibleTargetRelicIds.includes(relicId)) return;
    this.selectedTargetRelicId = relicId;
    this.targetPulses.forEach((pulse) => pulse.stop()); this.targetPulses = [];
    // 대상을 고른 뒤에는 선택자만 호박빛 발광으로 남고 나머지는 한 톤 어두워진다.
    this.targetCards.forEach((card, id) => { card.setScale(1); card.setSelected(id === relicId, COLOR.missionClaim); card.setAlpha(id === relicId ? 1 : 0.42); });
    this.confirmButton?.setEnabled(true);
  }

  /** 씬 콜백이 반드시 ExpeditionManager.chooseAugment를 통과시키도록 선택 DTO만 반환한다. */
  private confirmSelection(): void {
    if (!this.selectedOffer) return;
    const def = getExpeditionAugment(this.selectedOffer.augmentId);
    if (!def || (def.target === "relic" && !this.selectedTargetRelicId)) return;
    this.options.onChoose({ augmentId: this.selectedOffer.augmentId, ...(this.selectedTargetRelicId ? { targetRelicId: this.selectedTargetRelicId } : {}) });
  }
}
