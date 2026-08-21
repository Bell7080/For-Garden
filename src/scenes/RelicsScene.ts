import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import type { RelicDef } from "../core/types";
import { getRelic, sortRelicsByRarity, sortRelicsBySpecimenNumber } from "../data/relics";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { CharacterInfoManager, ROLE_LABEL } from "../managers/CharacterInfoManager";
import { TopBar } from "../ui/TopBar";
import { PortraitCard, relicCardTint, starsForRarity } from "../ui/PortraitCard";
import { relicProgression } from "../managers/RelicProgressionManager";
import { drawLayer, HOLO, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";

/**
 * 렐릭 — 보유 중인 렐릭을 훑어보는 화면.
 *
 * 가지지 않은 렐릭도 자리는 남겨 둔다. 무엇이 더 있는지 보여야 뽑을 마음이 든다.
 * 하나를 고르면 아래에 요약이 뜨고, 거기서 정보창을 열거나 애착 렐릭으로 세울 수 있다.
 */
export class RelicsScene extends Phaser.Scene {
  private info!: CharacterInfoManager;
  private selected: string | null = null;
  private cards = new Map<string, PortraitCard>();
  private summaryName!: Phaser.GameObjects.Text;
  private summaryBody!: Phaser.GameObjects.Text;
  private detailButton!: Button;
  private favoriteButton!: Button;
  /** 스토리 배열 순서와 분리된 도감 표시 정렬 기준이다. */
  private sortMode: "number" | "rarity" = "number";

  constructor() {
    super("relics");
  }

  create(): void {
    setDebugScene("relics");
    this.cards.clear();
    this.selected = session.favorite;

    const cx = BASE_WIDTH / 2;
    // background_002를 렐릭 탭의 야외 유적 전경으로 사용한다.
    addSceneBackground(this, BACKGROUND.relics);
    // 밝은 원화 위에서도 카드와 본문을 읽을 수 있도록 기존 void 색을 얇게 덮는다.
    this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void, 0.48).setDepth(-29);
    new TopBar(this);

    const ownedCount = relicCollection.owned.length;
    this.add
      .text(40, 170, "보유 렐릭", textStyle({ role: "display", size: 40 }))
      .setOrigin(0, 0);
    this.add
      .text(
        BASE_WIDTH - 40,
        182,
        `${ownedCount} / ${relicCollection.catalog.length}`,
        textStyle({ role: "emphasis", size: 30, color: COLOR.accentText }),
      )
      .setOrigin(1, 0);

    // 기존 황동 테두리 버튼을 그대로 사용해 도감 정렬도 다른 화면의 조작 체계와 맞춘다.
    new Button(this, 290, 248, { width: 430, height: 78, label: "개체번호순", fontSize: 24, onClick: () => this.setSortMode("number") });
    new Button(this, 790, 248, { width: 430, height: 78, label: "희귀도순", fontSize: 24, onClick: () => this.setSortMode("rarity") });

    this.buildGrid();
    this.buildSummary();

    new BottomNav(this, "relics");
    this.info = new CharacterInfoManager(this);
    this.refresh();
  }

  /**
   * 카드 그리드.
   *
   * 카드마다 전신 원화의 얼굴 부분을 꽉 채워 넣는다. 이름·역할 같은 글자는 아래 띠에만 두고
   * 세부 수치는 요약 칸으로 미뤄, 한눈에 "누가 있는지"부터 보이게 한다.
   */
  private buildGrid(): void {
    const cols = 4;
    const cardW = 216;
    const cardH = 300;
    const gapX = 34;
    const gapY = 30;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (BASE_WIDTH - gridW) / 2 + cardW / 2;
    const startY = 500;

    const catalog = this.sortMode === "number"
      ? sortRelicsBySpecimenNumber(relicCollection.catalog)
      : sortRelicsByRarity(relicCollection.catalog);
    catalog.forEach((relic, i) => {
      const x = startX + (i % cols) * (cardW + gapX);
      const y = startY + Math.floor(i / cols) * (cardH + gapY);
      const owned = relicCollection.owns(relic.id);

      const card = new PortraitCard(this, x, y, {
        width: cardW,
        height: cardH,
        portraitAssetId: relic.portraitAssetId,
        tint: relicCardTint(relic),
        label: relic.name,
        level: owned ? relicProgression.getProgress(relic.id).level : undefined,
        stars: starsForRarity(relic.rarity),
        badge: relic.specimenNumber,
        locked: !owned,
      });
      card.hit.on("pointerup", () => {
        this.selected = relic.id;
        this.refresh();
      });
      this.cards.set(relic.id, card);
    });
  }

  /** 정렬을 바꾸면 카드만 재조립하고 선택·보유 상태는 그대로 보존한다. */
  private setSortMode(mode: "number" | "rarity"): void {
    if (this.sortMode === mode) return;
    this.sortMode = mode;
    for (const card of this.cards.values()) card.destroy();
    this.cards.clear();
    this.buildGrid();
    this.refresh();
  }

  /** 아래쪽 요약 칸. 고른 렐릭이 무엇인지와, 거기서 할 수 있는 것을 모아 둔다. */
  private buildSummary(): void {
    const top = NAV_TOP - 400;
    // 테두리 없는 유리 레이어. 그림자로만 배경에서 떠 보이게 한다.
    drawLayer(this, BASE_WIDTH / 2, top + 190, slantedRect(BASE_WIDTH - 60, 380), {
      fill: 0x141920,
      alpha: HOLO.glass,
      edge: COLOR.accent,
      edgeAlpha: 0.25,
    });

    this.summaryName = this.add.text(60, top + 30, "", textStyle({ role: "display", size: 38 })).setOrigin(0, 0);
    this.summaryBody = this.add
      .text(60, top + 88, "", textStyle({ role: "body", size: 26, color: COLOR.inkDim, lineSpacing: 8 }))
      .setOrigin(0, 0);

    this.detailButton = new Button(this, 300, top + 300, {
      width: 400,
      height: 110,
      label: "상세 정보",
      fontSize: 32,
      onClick: () => {
        if (this.selected) this.info.showRelic(getRelic(this.selected), relicCollection.owns(this.selected));
      },
    });

    this.favoriteButton = new Button(this, 760, top + 300, {
      width: 400,
      height: 110,
      label: "애착 렐릭",
      fontSize: 32,
      onClick: () => {
        if (!this.selected) return;
        relicCollection.setFavorite(this.selected);
        this.refresh();
      },
    });
  }

  private refresh(): void {
    for (const [id, card] of this.cards) {
      const owned = relicCollection.owns(id);
      card.setSelected(owned && id === this.selected);
    }

    const def: RelicDef | null = this.selected ? getRelic(this.selected) : null;
    const isFavorite = def !== null && session.favorite === def.id;
    const owned = def !== null && relicCollection.owns(def.id);

    this.summaryName.setText(def ? `NO.${def.specimenNumber}  ${owned ? def.name : "미발굴 개체"}` : "렐릭을 고르세요");
    this.summaryBody.setText(
      def
        ? owned ? [
            `${def.origin} · ${ROLE_LABEL[def.role]}`,
            `패시브 · ${def.passive.name}`,
            `궁극기 · ${def.ultimate.name}`,
            isFavorite ? "로비에 서 있는 애착 렐릭이다." : "",
          ]
            .filter(Boolean)
            .join("\n")
          : [def.catalogSummary, "기록은 개체 획득 후 해제된다."].join("\n")
        : "",
    );

    this.detailButton.setEnabled(def !== null);
    this.favoriteButton.setSub("").setEnabled(owned && !isFavorite);
  }
}
