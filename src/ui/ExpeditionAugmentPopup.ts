import { KeywordManager } from "../managers/KeywordManager";
import { expeditionAugmentKeywords } from "./expeditionAugmentKeywords";
import Phaser from "phaser";
import { t } from "../i18n";
import type { ExpeditionAugmentOffer, ExpeditionAugmentSelection } from "../core/expeditionRewards";
import { motionPolicy } from "../core/settings";
import { getExpeditionAugment, type ExpeditionAugmentDef } from "../data/expeditionAugments";
import { getRelic } from "../data/relics";
import { session } from "../state/session";
import { Button } from "./Button";
import { ExpeditionAugmentChip } from "./ExpeditionAugmentChip";
import { FaceFrame } from "./FaceFrame";
import { PopupLayer } from "./PopupLayer";
import { RARITY_TONE } from "./rarityMark";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { chipPoints, drawHairline, drawLayer, toPoints } from "./holo";
// 판 아래로 생존 HUD 한 줄이 그대로 보이도록 규격은 지도 배치표 한 곳에서만 정한다.
import { EXPEDITION_AUGMENT_POPUP, expeditionAugmentCardX } from "./expeditionLayout";

// 두 표기는 화면 없이도 읽혀야 하므로 순수 모듈이 소유한다. 기존 호출부가 이 경로를 계속
// 쓸 수 있도록 여기서 다시 내보내기만 한다.
import { augmentBadgeGlyph, expeditionAugmentEffectLabel, expeditionAugmentMetaLabel, type AugmentBadgeView } from "./expeditionAugmentBadges";
export { expeditionAugmentEffectLabel, expeditionAugmentMetaLabel };

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
  /**
   * 개인 후보를 고른 동안 선택 가능한 아군만 또렷하게 남기고, 그 위에 고른 증강의 표식이
   * 숨 쉬며 "여기를 누른다"를 말한다. `null`은 전체 효과다(표식 없음).
   */
  setEligible(relicIds: readonly string[] | null, badge?: AugmentBadgeView): void;
  /** 고른 대상 하나만 발광으로 남긴다. */
  setChosen(relicId: string | undefined): void;
  /** 확정한 카드가 날아 들어갈 화면 좌표 — 대상이 없으면 위쪽 전체 증강 줄이다. */
  landingPoint(relicId: string | undefined): { x: number; y: number };
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

/** 카드 한 장이 들고 다니는 조각들. 고를 때마다 다시 그리지 않고 보이기·배율만 바꾼다. */
interface OfferCard {
  offer: ExpeditionAugmentOffer;
  def: ExpeditionAugmentDef;
  card: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Graphics;
  footer: Phaser.GameObjects.Container;
  restX: number;
}

/** 종류 이름. 키를 글자로 이어 붙이지 않아야 쓰지 않는 문구 검사가 키를 찾는다. */
function categoryLabel(category: ExpeditionAugmentDef["category"]): string {
  const keys = { attack: "augment.group.attack", spell: "augment.group.spell", survival: "augment.group.survival", shield: "augment.group.shield", recovery: "augment.group.heal", status: "augment.group.status", conditional: "augment.group.conditional" } as const;
  return t(keys[category]);
}

/** 연출 시간(ms). 움직임 줄이기에서는 전부 0이 되어 완성된 판이 곧바로 선다. */
const MOTION = { spread: 440, stagger: 70, choose: 200, fly: 360, fold: 220 } as const;

/**
 * 전투 진입 전에 저장된 증강 후보를 고르는 작업판이다.
 *
 * 세 후보는 판 가운데에 포개져 있다가 **부채꼴로 촥 펼쳐지고**, 고른 카드는 떠오르며 빛을
 * 두르고 나머지는 가라앉는다. 확정하면 그 카드가 작아지며 **사락** 붙을 자리(위쪽 전체 증강 줄
 * 또는 대상 렐릭)로 날아 들어간 뒤에야 저장을 부른다 — 카드가 판 위에서 툭 사라지면 무엇을
 * 어디에 붙였는지가 읽히지 않는다. 판은 지도 하단의 생존 HUD 위에 멈추고, 개인 대상은 그
 * HUD를 그대로 눌러 고른다.
 */
export class ExpeditionAugmentPopup {
  private readonly popup: PopupLayer;
  private body?: Phaser.GameObjects.Container;
  private cards: OfferCard[] = [];
  private selected?: OfferCard;
  private selectedTargetRelicId?: string;
  private confirmButton?: Button;
  private step?: Phaser.GameObjects.Container;
  private note?: Phaser.GameObjects.Text;
  /** 확정 연출이 도는 동안 두 번 누르거나 다른 카드를 고르지 못하게 막는다. */
  private sealed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly options: ExpeditionAugmentPopupOptions) {
    this.popup = new PopupLayer(scene, 4000);
  }

  private get moving(): boolean {
    return motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  }

  /** 지도보다 위에 닫을 수 없는 선택판을 열어 저장된 보상을 건너뛸 입력을 없앤다. */
  open(): void {
    const L = EXPEDITION_AUGMENT_POPUP;
    // 판은 생존 HUD 위에서 멈춘다. 아래 세 칸이 곧 대상 선택지라 가려서는 안 된다.
    this.body = this.popup.open({ width: L.width, height: L.height, y: L.centerY, title: t("augment.pick.title", { round: this.options.round, total: this.options.totalRounds }), dim: true, dimAlpha: 0.86, closeOnBackdrop: false, hideCloseButton: true, titleSize: 40 }, (body) => {
      this.step = this.scene.add.container(0, L.stepY);
      body.add(this.step);
      const count = this.options.offers.length;
      this.options.offers.forEach((offer, index) => this.addOffer(body, offer, expeditionAugmentCardX(index, count)));
      this.note = this.scene.add.text(0, L.noteY, "", textStyle({ role: "emphasis", size: 25, color: COLOR.inkDim, align: "center" })).setOrigin(0.5);
      body.add(this.note);
      this.confirmButton = new Button(this.scene, 0, L.confirm.y, { width: L.confirm.width, height: L.confirm.height, label: t("augment.pick.confirm"), variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => this.confirmSelection() });
      this.confirmButton.setEnabled(false);
      body.add(this.confirmButton);
    });
    this.paintStep();
    this.spreadCards();
    this.options.targets.attach((relicId) => this.selectTarget(relicId));
    this.options.targets.setEligible(null);
  }

  /**
   * 단계 표시 — `증강 고르기 › 대상 고르기`.
   *
   * 개인 증강은 손이 판 밖(아래 HUD)으로 나가야 끝나는데, 그 사실을 판 안의 문장 한 줄로만
   * 말하던 때는 카드를 고르고 나서 확정이 왜 꺼져 있는지 읽히지 않았다. 지금 할 단계만 강조색이고
   * 끝난 단계는 흰색, 남은 단계는 흐리다. 전체 효과를 고르면 둘째 칸이 「전원 적용」으로 바뀐다.
   */
  private paintStep(): void {
    const step = this.step;
    if (!step) return;
    step.removeAll(true);
    const def = this.selected?.def;
    const party = def?.target === "party";
    const firstDone = def !== undefined;
    const secondDone = party || this.selectedTargetRelicId !== undefined;
    const first = this.scene.add.text(0, 0, `1  ${t("augment.pick.step.augment")}`, textStyle({ role: "emphasis", size: 25, color: firstDone ? COLOR.ink : COLOR.sortieText })).setOrigin(0, 0.5);
    const arrow = this.scene.add.text(0, 0, "›", textStyle({ role: "display", size: 30, color: COLOR.inkDim })).setOrigin(0, 0.5);
    const secondColor = !firstDone ? COLOR.inkDim : secondDone ? COLOR.ink : COLOR.sortieText;
    const second = this.scene.add.text(0, 0, `2  ${t(party ? "augment.pick.step.party" : "augment.pick.step.target")}`, textStyle({ role: "emphasis", size: 25, color: secondColor })).setOrigin(0, 0.5);
    const gap = 22;
    const total = first.width + gap + arrow.width + gap + second.width;
    first.setX(-total / 2);
    arrow.setX(first.x + first.width + gap);
    second.setX(arrow.x + arrow.width + gap);
    // 지금 할 단계 밑에만 짧은 강조선이 흐른다 — 색만으로 가르면 두 칸의 무게가 비슷하다.
    const active = !firstDone ? first : !secondDone ? second : undefined;
    if (active) step.add(drawHairline(this.scene, active.x + active.width / 2, 22, active.width, { color: COLOR.sortie, alpha: 0.85 }));
    step.add([first, arrow, second]);
  }

  /** 안내 한 줄은 단계마다 다음에 할 일이나 결과를 말하고, 고르기 전에는 비워 둔다. */
  private paintNote(): void {
    if (!this.note) return;
    const def = this.selected?.def;
    if (!def) { this.note.setText(""); return; }
    if (def.target === "party") { this.note.setText(t("augment.pick.noteParty")).setColor(COLOR.accentText); return; }
    if (this.selectedTargetRelicId) {
      this.note.setText(t("augment.pick.noteChosen", { name: getRelic(this.selectedTargetRelicId).name })).setColor(COLOR.sortieText);
      return;
    }
    this.note.setText(t("augment.pick.targetNote")).setColor(COLOR.sortieText);
  }

  /**
   * 후보 카드 한 장 — 등급 띠 → 효과 문양 → 종류 → 이름 → 효과 본문.
   *
   * 카드는 판때기 규칙(사방 테두리 없음)을 따르고, 등급은 윗변에서 스며드는 등급색과 왼쪽 위
   * 글자가, 범위(전체·개인)는 오른쪽 위 작은 칩이 말한다. 문양은 지도·프로필에 붙는 증강 칩과
   * **같은 액자**라 고른 뒤 어디에 무엇으로 붙는지가 그대로 이어진다.
   */
  private addOffer(body: Phaser.GameObjects.Container, offer: ExpeditionAugmentOffer, x: number): void {
    const def = getExpeditionAugment(offer.augmentId);
    if (!def) return;
    const C = EXPEDITION_AUGMENT_POPUP.card;
    const hw = C.width / 2;
    const hh = C.height / 2;
    const tone = RARITY_TONE[def.rarity === "ssr" ? "SSR" : "SR"];
    const party = def.target === "party";
    const scope = party ? COLOR.accent : COLOR.sortie;
    const card = this.scene.add.container(x, C.y);
    const shape = chipPoints(C.width, C.height, { bevel: { topLeft: 34, bottomRight: 26 } });
    // 고른 카드의 빛은 판 **밖**으로 번지는 겹이라 판보다 먼저(아래에) 깐다.
    const glow = this.cardGlow(shape, COLOR.sortie).setVisible(false);
    card.add(glow);
    card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x121820, alpha: 0.96, edge: tone.chip, edgeAlpha: 0.9, edgeWidth: 3, glow: { color: tone.chip, strength: 0.42, height: 0.42 } }));
    card.add(this.scene.add.text(-hw + 30, -hh + 30, def.rarity === "ssr" ? "SSR" : "SR", textStyle({ role: "display", size: 30, color: tone.ink })).setOrigin(0, 0.5).setShadow(0, 0, tone.halo, 10, false, true));
    card.add(this.scopeChip(hw - 22, -hh + 30, t(party ? "augment.target.party" : "augment.target.single"), scope));
    card.add(new ExpeditionAugmentChip(this.scene, 0, -118, { augmentId: def.id, name: def.name, meta: "", effect: "", glyph: augmentBadgeGlyph(def), rarity: def.rarity }, 104));
    card.add(this.scene.add.text(0, -46, categoryLabel(def.category), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0.5));
    card.add(shrinkTextToWidth(this.scene.add.text(0, -6, def.name, textStyle({ role: "display", size: 32 })).setOrigin(0.5), C.width - 34));
    card.add(drawHairline(this.scene, 0, 32, C.width - 70, { color: tone.chip, alpha: 0.45 }));
    // 효과는 고르는 근거라 본문 밝기로 크게 선다. 칸 높이 안에 들 때까지만 줄인다.
    // 개인 증강은 대상을 고르면 그 얼굴이 카드 밑동에 붙어, 확정 전에 "누구에게"가 카드 안에서 끝난다.
    const footer = this.scene.add.container(0, hh - 38);
    card.add(footer);
    const hit = this.scene.add.rectangle(0, 0, C.width, C.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    card.add(hit);
    hit.on("pointerup", () => this.selectOffer(entry));
    // 태그 입력은 카드 선택 입력 위에 둔다.
    const effect = new KeywordManager(this.scene, new PopupLayer(this.scene, 6000)).layout(expeditionAugmentEffectLabel(def), {
      width: C.width - 40, size: 26, lineSpacing: 6, contextualKeywords: expeditionAugmentKeywords(def),
    });
    const scale = Math.min(1, 130 / effect.height);
    effect.setScale(scale).setPosition(-(C.width - 40) * scale / 2, 112 - effect.height * scale / 2);
    card.add(effect);
    body.add(card);
    const entry: OfferCard = { offer, def, card, glow, footer, restX: x };
    this.cards.push(entry);
  }

  /** 범위 칩 — 오른쪽 위에 붙는 작은 판. 오른쪽 끝을 `right`에 맞춘다. */
  private scopeChip(right: number, y: number, label: string, color: number): Phaser.GameObjects.Container {
    const chip = this.scene.add.container(0, y);
    const text = this.scene.add.text(0, 0, label, textStyle({ role: "emphasis", size: 20, color: "#ffffff" })).setOrigin(0.5);
    const width = text.width + 26;
    chip.add(drawLayer(this.scene, 0, 0, chipPoints(width, 34, { bevel: { topLeft: 8, bottomRight: 8 } }), { fill: color, alpha: 0.85, shadow: false }));
    chip.add(text);
    chip.setX(right - width / 2);
    return chip;
  }

  /** 카드 실루엣을 조금씩 키워 겹친 빛. 테두리를 두르지 않고 고른 것을 알린다(캐릭터 카드와 같은 문법). */
  private cardGlow(shape: number[], color: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.setBlendMode(Phaser.BlendModes.ADD);
    const points = toPoints(shape);
    for (let i = 1; i <= 6; i += 1) {
      const grow = 1 + i * 0.014;
      graphics.lineStyle(7, color, 0.42 * (1 - i / 7));
      graphics.strokePoints(points.map((point) => new Phaser.Geom.Point(point.x * grow, point.y * grow)), true);
    }
    return graphics;
  }

  /**
   * 열리는 순간 — 판 가운데 포개진 세 장이 부채꼴로 촥 펼쳐진다.
   *
   * 가운데 카드가 맨 위에 포개져 있다가 좌우가 차례로 빠져나가므로, 눈이 가운데에서 시작해 세
   * 장을 한 번에 훑는다. 움직임 줄이기에서는 펼친 자리에 곧바로 선다.
   */
  private spreadCards(): void {
    if (!this.moving) return;
    const C = EXPEDITION_AUGMENT_POPUP.card;
    const middle = (this.cards.length - 1) / 2;
    // 가운데 카드가 맨 위에 오도록 바깥부터 다시 쌓는다.
    [...this.cards].sort((a, b) => Math.abs(b.restX) - Math.abs(a.restX)).forEach(({ card }) => this.body?.bringToTop(card));
    if (this.confirmButton) this.body?.bringToTop(this.confirmButton);
    this.cards.forEach(({ card, restX }, index) => {
      const side = Math.sign(index - middle);
      card.setPosition(0, C.y + 30).setScale(0.82).setAlpha(0).setAngle(side * 9);
      this.scene.tweens.add({
        targets: card, x: restX, y: C.y, scale: 1, alpha: 1, angle: 0,
        duration: MOTION.spread, delay: 120 + Math.abs(index - middle) * MOTION.stagger, ease: "Back.Out",
      });
    });
  }

  /** 후보 하나만 떠오르고 나머지는 가라앉는다. 전체/개인 모두 확정 전 선택 상태에 머문다. */
  private selectOffer(entry: OfferCard): void {
    if (this.sealed) return;
    this.selected = entry;
    this.selectedTargetRelicId = undefined;
    this.paintCards();
    const partyWide = entry.def.target === "party";
    // 다음에 누를 자리는 팝업 안이 아니라 아래 HUD다. 고를 수 있는 칸만 또렷하게 남는다.
    this.options.targets.setEligible(partyWide ? null : entry.offer.eligibleTargetRelicIds, partyWide ? undefined : {
      augmentId: entry.def.id, name: entry.def.name, meta: "", effect: "", glyph: augmentBadgeGlyph(entry.def), rarity: entry.def.rarity,
    });
    // 전체 효과는 대상이 없으므로 후보 선택만으로 확정 가능하지만 실제 저장은 버튼에서만 한다.
    this.confirmButton?.setEnabled(partyWide);
    this.paintStep();
    this.paintNote();
  }

  /** 고른 카드만 빛·배율·높이를 갖고, 나머지는 한 뼘 작고 어둡게 물러난다. */
  private paintCards(): void {
    const C = EXPEDITION_AUGMENT_POPUP.card;
    for (const entry of this.cards) {
      const chosen = entry === this.selected;
      entry.glow.setVisible(chosen);
      if (chosen) this.body?.bringToTop(entry.card);
      if (!chosen) entry.footer.removeAll(true);
      const target = { scale: chosen ? C.chosenScale : C.restScale, y: chosen ? C.y - C.lift : C.y, alpha: chosen ? 1 : 0.5 };
      this.scene.tweens.killTweensOf(entry.card);
      entry.card.setX(entry.restX).setAngle(0);
      if (this.moving) this.scene.tweens.add({ targets: entry.card, ...target, duration: MOTION.choose, ease: "Cubic.Out" });
      else entry.card.setScale(target.scale).setY(target.y).setAlpha(target.alpha);
    }
  }

  /** eligibleTargetRelicIds에 든 카드만 발광시키며 사망 여부는 클라이언트가 다시 배제하지 않는다. */
  private selectTarget(relicId: string): void {
    const entry = this.selected;
    // 전체 효과를 고른 동안의 아군 입력은 대상 선택으로 읽지 않는다.
    if (this.sealed || !entry || entry.def.target === "party" || !entry.offer.eligibleTargetRelicIds.includes(relicId)) return;
    this.selectedTargetRelicId = relicId;
    this.options.targets.setChosen(relicId);
    this.paintFooter(entry, relicId);
    this.confirmButton?.setEnabled(true);
    this.paintStep();
    this.paintNote();
  }

  /** 대상의 얼굴 액자와 이름이 카드 밑동에 붙는다. */
  private paintFooter(entry: OfferCard, relicId: string): void {
    entry.footer.removeAll(true);
    const relic = getRelic(relicId);
    const name = this.scene.add.text(0, 0, relic.name, textStyle({ role: "emphasis", size: 22, color: COLOR.sortieText })).setOrigin(0, 0.5);
    shrinkTextToWidth(name, EXPEDITION_AUGMENT_POPUP.card.width - 110);
    const face = new FaceFrame(this.scene, 0, 0, { portraitAssetId: relic.portraitAssetId, size: 48 });
    const total = 48 + 12 + name.width;
    face.setX(-total / 2 + 24);
    name.setX(-total / 2 + 60);
    entry.footer.add([face, name]);
    if (this.moving) {
      entry.footer.setAlpha(0).setY(EXPEDITION_AUGMENT_POPUP.card.height / 2 - 26);
      this.scene.tweens.add({ targets: entry.footer, alpha: 1, y: EXPEDITION_AUGMENT_POPUP.card.height / 2 - 38, duration: 180, ease: "Cubic.Out" });
    }
  }

  /** 씬 콜백이 반드시 ExpeditionManager.chooseAugment를 통과시키도록 선택 DTO만 반환한다. */
  private confirmSelection(): void {
    const entry = this.selected;
    if (this.sealed || !entry) return;
    if (entry.def.target === "relic" && !this.selectedTargetRelicId) return;
    this.sealed = true;
    this.confirmButton?.setEnabled(false);
    const selection: ExpeditionAugmentSelection = { augmentId: entry.offer.augmentId, ...(this.selectedTargetRelicId ? { targetRelicId: this.selectedTargetRelicId } : {}) };
    const finish = (): void => {
      // 지도 HUD는 빌려 온 것이라 확정과 동시에 원래 깊이와 명도로 돌려준다.
      this.options.targets.detach();
      this.options.onChoose(selection);
    };
    if (!this.moving || !this.body) { finish(); return; }
    this.flyIn(entry, finish);
  }

  /**
   * 확정 — 고른 카드가 작아지며 붙을 자리로 사락 날아 들어가고, 나머지는 아래로 접힌다.
   *
   * 판은 그 자리에 둔다. 카드가 날아간 뒤 씬이 저장을 확인하고 다시 서므로, 판이 먼저 닫히면
   * 지도와 HUD가 카드보다 먼저 드러나 날아갈 곳이 흔들린다.
   */
  private flyIn(entry: OfferCard, done: () => void): void {
    const body = this.body!;
    const land = this.options.targets.landingPoint(this.selectedTargetRelicId);
    for (const other of this.cards) {
      if (other === entry) continue;
      this.scene.tweens.add({ targets: other.card, y: other.card.y + 60, alpha: 0, duration: MOTION.fold, ease: "Cubic.In" });
    }
    this.note?.setAlpha(0);
    this.confirmButton?.setAlpha(0.4);
    this.scene.tweens.add({
      targets: entry.card, x: land.x - body.x, y: land.y - body.y, scale: 0.16, angle: entry.restX >= 0 ? 10 : -10, alpha: 0.2,
      duration: MOTION.fly, ease: "Cubic.In",
      onComplete: () => done(),
    });
  }
}
