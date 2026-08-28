import Phaser from "phaser";
import type { ExpeditionAugmentOffer, ExpeditionAugmentSelection } from "../core/expeditionRewards";
import { getExpeditionAugment, type ExpeditionAugmentDef } from "../data/expeditionAugments";
import { Button } from "./Button";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { chipPoints, drawHairline, drawLayer } from "./holo";
// 판 아래로 생존 HUD 한 줄이 그대로 보이도록 규격은 지도 배치표 한 곳에서만 정한다.
import { EXPEDITION_AUGMENT_POPUP } from "./expeditionLayout";

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

/**
 * 개인 증강의 대상을 고르는 아군 그리드는 이 팝업이 다시 그리지 않는다.
 *
 * 지도 화면에는 이미 같은 세 기가 생존 HUD로 서 있다. 팝업 안에 얼굴을 한 번 더 그리면
 * 같은 아군이 한 화면에 두 벌로 보이고, 크기와 상태 표기도 두 곳에서 따로 늙는다.
 * 그래서 팝업은 판을 그 위로 올리기만 하고, 고르는 일은 화면에 이미 선 HUD에 맡긴다.
 */
export interface AugmentTargetPicker {
  /** 팝업이 열려 있는 동안 HUD를 암전 위로 올리고 아군 입력을 팝업으로 돌린다. */
  attach(onPick: (relicId: string) => void): void;
  /** 개인 후보를 고른 동안 선택 가능한 아군만 또렷하게 남긴다. `null`은 전체 효과다. */
  setEligible(relicIds: readonly string[] | null): void;
  /** 고른 대상 하나만 발광으로 남긴다. */
  setChosen(relicId: string | undefined): void;
  /** 선택이 끝나면 HUD를 원래 깊이·명도·입력으로 되돌린다. */
  detach(): void;
}

interface ExpeditionAugmentPopupOptions {
  round: number;
  totalRounds: number;
  offers: readonly ExpeditionAugmentOffer[];
  targets: AugmentTargetPicker;
  onChoose: (selection: ExpeditionAugmentSelection) => void;
}

/**
 * 전투 진입 전에 저장된 증강 후보를 고르는 작업판이다.
 *
 * 전체/개인 효과 모두 후보를 고른 뒤 하단 확정 버튼에서만 저장한다. 판은 지도 하단의
 * 생존 HUD 위로 올라앉고, 개인 대상은 그 HUD를 그대로 눌러 고른다.
 */
export class ExpeditionAugmentPopup {
  private readonly popup: PopupLayer;
  private selectedOffer?: ExpeditionAugmentOffer;
  private selectedTargetRelicId?: string;
  /** 후보를 바꿀 때 이전 호박빛 면을 반드시 끄기 위한 카드별 선택 레이어다. */
  private offerSelections = new Map<string, Phaser.GameObjects.GameObject & { setVisible(value: boolean): unknown }>();
  private confirmButton?: Button;

  constructor(private readonly scene: Phaser.Scene, private readonly options: ExpeditionAugmentPopupOptions) {
    this.popup = new PopupLayer(scene, 4000);
  }

  /** 지도보다 위에 닫을 수 없는 선택판을 열어 저장된 보상을 건너뛸 입력을 없앤다. */
  open(): void {
    // 판은 생존 HUD 위에서 멈춘다. 아래 세 칸이 곧 대상 선택지라 가려서는 안 된다.
    this.popup.open({ width: EXPEDITION_AUGMENT_POPUP.width, height: EXPEDITION_AUGMENT_POPUP.height, y: EXPEDITION_AUGMENT_POPUP.centerY, title: `증강 선택 ${this.options.round} / ${this.options.totalRounds}`, dim: true, dimAlpha: 0.86, closeOnBackdrop: false, hideCloseButton: true, titleSize: 40 }, (body) => {
      // 세 후보는 요청된 가로 ㅁㅁㅁ 배열로 두고, 아이콘→이름→설명의 세 층으로 읽힌다.
      body.add(this.scene.add.text(0, -330, "전투 프로토콜", textStyle({ role: "emphasis", size: 24, color: COLOR.sortieText })).setOrigin(0.5));
      this.options.offers.forEach((offer, index) => this.addOffer(body, offer, -300 + index * 300, -110));
      body.add(this.scene.add.text(0, 145, "개인 증강은 아래 원정대에서 대상을 고릅니다", textStyle({ role: "emphasis", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
      this.confirmButton = new Button(this.scene, 0, 300, { width: 500, height: 104, label: "선택 확정", variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => this.confirmSelection() });
      this.confirmButton.setEnabled(false);
      body.add(this.confirmButton);
    });
    this.options.targets.attach((relicId) => this.selectTarget(relicId));
    this.options.targets.setEligible(null);
  }

  /** 후보 판은 이름·등급·범위·효과 수치를 한 묶음으로 읽히게 한다. */
  private addOffer(body: Phaser.GameObjects.Container, offer: ExpeditionAugmentOffer, x: number, y: number): void {
    const def = getExpeditionAugment(offer.augmentId);
    if (!def) return;
    const card = this.scene.add.container(x, y);
    const shape = chipPoints(270, 360, { bevel: { topLeft: 30, bottomRight: 24 } });
    card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x151b24, alpha: 0.94, edge: def.target === "party" ? COLOR.accent : COLOR.sortie, edgeAlpha: 0.65 }));
    // 개인 후보를 누른 상태는 호박빛 면으로 바뀌어 대상 선택 단계임을 카드 자체가 말한다.
    const selected = drawLayer(this.scene, 0, 0, shape, { fill: 0x5a3a12, alpha: 0.72, edge: COLOR.missionClaim, edgeAlpha: 0.96 }).setVisible(false);
    this.offerSelections.set(offer.augmentId, selected);
    card.add(selected);
    card.add(this.scene.add.image(0, -112, "skill-icon-buff").setDisplaySize(76, 76).setTint(def.target === "party" ? COLOR.accent : COLOR.sortie));
    card.add(this.scene.add.text(0, -32, def.name, textStyle({ role: "display", size: 29 })).setOrigin(0.5));
    card.add(drawHairline(this.scene, 0, 20, 210, { color: COLOR.accent, alpha: 0.3 }));
    // 범위와 수치는 고르는 근거라 흐린 회색으로 두지 않는다. 범위는 제 색으로, 효과는 본문 밝기로 읽힌다.
    card.add(this.scene.add.text(0, 52, expeditionAugmentMetaLabel(def), textStyle({ role: "emphasis", size: 21, color: def.target === "party" ? COLOR.accentText : COLOR.sortieText })).setOrigin(0.5));
    card.add(this.scene.add.text(0, 110, expeditionAugmentEffectLabel(def), textStyle({ role: "body", size: 23, color: COLOR.ink, align: "center", wrap: 228, lineSpacing: 8 })).setOrigin(0.5));
    const hit = this.scene.add.rectangle(0, 0, 270, 360, 0xffffff, 0).setInteractive({ useHandCursor: true });
    card.add(hit); hit.on("pointerup", () => this.selectOffer(offer, def));
    body.add(card);
  }

  /** 후보 하나만 호박빛으로 유지하고 전체/개인 모두 확정 전 선택 상태에 머문다. */
  private selectOffer(offer: ExpeditionAugmentOffer, def: ExpeditionAugmentDef): void {
    this.selectedOffer = offer;
    this.selectedTargetRelicId = undefined;
    this.offerSelections.forEach((layer, augmentId) => layer.setVisible(augmentId === offer.augmentId));
    const partyWide = def.target === "party";
    // 다음에 누를 자리는 팝업 안이 아니라 아래 HUD다. 고를 수 있는 칸만 또렷하게 남는다.
    this.options.targets.setEligible(partyWide ? null : offer.eligibleTargetRelicIds);
    // 전체 효과는 대상이 없으므로 후보 선택만으로 확정 가능하지만 실제 저장은 버튼에서만 한다.
    this.confirmButton?.setEnabled(partyWide);
  }

  /** eligibleTargetRelicIds에 든 카드만 발광시키며 사망 여부는 클라이언트가 다시 배제하지 않는다. */
  private selectTarget(relicId: string): void {
    const def = this.selectedOffer && getExpeditionAugment(this.selectedOffer.augmentId);
    // 전체 효과를 고른 동안의 아군 입력은 대상 선택으로 읽지 않는다.
    if (!def || def.target === "party" || !this.selectedOffer?.eligibleTargetRelicIds.includes(relicId)) return;
    this.selectedTargetRelicId = relicId;
    this.options.targets.setChosen(relicId);
    this.confirmButton?.setEnabled(true);
  }

  /** 씬 콜백이 반드시 ExpeditionManager.chooseAugment를 통과시키도록 선택 DTO만 반환한다. */
  private confirmSelection(): void {
    if (!this.selectedOffer) return;
    const def = getExpeditionAugment(this.selectedOffer.augmentId);
    if (!def || (def.target === "relic" && !this.selectedTargetRelicId)) return;
    // 지도 HUD는 빌려 온 것이라 확정과 동시에 원래 깊이와 명도로 돌려준다.
    this.options.targets.detach();
    this.options.onChoose({ augmentId: this.selectedOffer.augmentId, ...(this.selectedTargetRelicId ? { targetRelicId: this.selectedTargetRelicId } : {}) });
  }
}
