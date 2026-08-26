import Phaser from "phaser";
import type { ExpeditionAugmentOffer, ExpeditionAugmentSelection } from "../core/expeditionRewards";
import { getExpeditionAugment, type ExpeditionAugmentDef } from "../data/expeditionAugments";
import { getRelic } from "../data/relics";
import { Button } from "./Button";
import { PortraitCard, relicCardTint } from "./PortraitCard";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

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
 * 전체 효과는 후보를 누르는 즉시 확정하고, 개인 효과만 후보 → 얼굴 → 확정의 세 단계로 둔다.
 * 얼굴 선택은 PortraitCard 자체의 확대·발광을 사용해 별도 선택 테두리를 만들지 않는다.
 */
export class ExpeditionAugmentPopup {
  private readonly popup: PopupLayer;
  private selectedOffer?: ExpeditionAugmentOffer;
  private selectedTargetRelicId?: string;
  private targetCards = new Map<string, PortraitCard>();
  private confirmButton?: Button;

  constructor(private readonly scene: Phaser.Scene, private readonly options: ExpeditionAugmentPopupOptions) {
    this.popup = new PopupLayer(scene, 4000);
  }

  /** 지도보다 위에 닫을 수 없는 선택판을 열어 저장된 보상을 건너뛸 입력을 없앤다. */
  open(): void {
    this.popup.open({ width: 940, height: 1330, y: 970, title: `증강 선택 ${this.options.round} / ${this.options.totalRounds}`, dim: true, dimAlpha: 0.86, closeOnBackdrop: false, hideCloseButton: true, titleSize: 40 }, (body) => {
      body.add(this.scene.add.text(0, -565, "전투 프로토콜", textStyle({ role: "emphasis", size: 24, color: COLOR.sortieText })).setOrigin(0.5));
      this.options.offers.forEach((offer, index) => this.addOffer(body, offer, -390 + index * 285));
      body.add(this.scene.add.text(0, 160, "개인 증강 대상을 선택하세요", textStyle({ role: "emphasis", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
      this.addTargets(body);
      this.confirmButton = new Button(this.scene, 0, 535, { width: 500, height: 104, label: "대상 확정", variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => this.confirmPersonal() });
      this.confirmButton.setEnabled(false);
      body.add(this.confirmButton);
    });
  }

  /** 후보 판은 이름·등급·범위·효과 수치를 한 묶음으로 읽히게 한다. */
  private addOffer(body: Phaser.GameObjects.Container, offer: ExpeditionAugmentOffer, y: number): void {
    const def = getExpeditionAugment(offer.augmentId);
    if (!def) return;
    const button = new Button(this.scene, 0, y, {
      width: 760,
      height: 220,
      label: def.name,
      sub: `${expeditionAugmentMetaLabel(def)}\n${expeditionAugmentEffectLabel(def)}`,
      subFontSize: 23,
      accentColor: def.target === "party" ? COLOR.accent : COLOR.sortie,
      onClick: () => this.selectOffer(offer, def),
    });
    body.add(button);
  }

  /** 서버 후보에 든 사망 렐릭도 흐리게 숨기지 않고, 상태 문구만 이름 아래에 남긴다. */
  private addTargets(body: Phaser.GameObjects.Container): void {
    this.options.relics.forEach((state, index) => {
      const def = getRelic(state.relicId);
      const card = new PortraitCard(this.scene, -280 + index * 280, 350, {
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

  /** 전체는 즉시 확정하고 개인 후보만 대상 선택 단계에 유지한다. */
  private selectOffer(offer: ExpeditionAugmentOffer, def: ExpeditionAugmentDef): void {
    if (def.target === "party") { this.options.onChoose({ augmentId: offer.augmentId }); return; }
    this.selectedOffer = offer;
    this.selectedTargetRelicId = undefined;
    this.targetCards.forEach((card, relicId) => {
      card.setAlpha(offer.eligibleTargetRelicIds.includes(relicId) ? 1 : 0.28);
      card.setSelected(false, COLOR.sortie);
    });
    this.confirmButton?.setEnabled(false);
  }

  /** eligibleTargetRelicIds에 든 카드만 발광시키며 사망 여부는 클라이언트가 다시 배제하지 않는다. */
  private selectTarget(relicId: string): void {
    if (!this.selectedOffer?.eligibleTargetRelicIds.includes(relicId)) return;
    this.selectedTargetRelicId = relicId;
    this.targetCards.forEach((card, id) => card.setSelected(id === relicId, COLOR.sortie));
    this.confirmButton?.setEnabled(true);
  }

  /** 씬 콜백이 반드시 ExpeditionManager.chooseAugment를 통과시키도록 선택 DTO만 반환한다. */
  private confirmPersonal(): void {
    if (!this.selectedOffer || !this.selectedTargetRelicId) return;
    this.options.onChoose({ augmentId: this.selectedOffer.augmentId, targetRelicId: this.selectedTargetRelicId });
  }
}

