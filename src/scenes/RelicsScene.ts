import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { sortRelicsByRarity, sortRelicsBySpecimenNumber } from "../data/relics";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import { BottomNav } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { TopBar } from "../ui/TopBar";
import { PortraitCard, relicCardTint, starsForRarity } from "../ui/PortraitCard";
import { relicProgression } from "../managers/RelicProgressionManager";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";

/**
 * 렐릭 — 보유 중인 렐릭을 훑어보는 화면.
 *
 * 가지지 않은 렐릭도 자리는 남겨 둔다. 무엇이 더 있는지 보여야 뽑을 마음이 든다.
 * 카드를 누르면 곧바로 정보창이 열린다. 요약 칸을 따로 두지 않는 이유는, 같은 정보를 두 곳에
 * 두면 어느 쪽을 봐야 하는지 흐려지고 그리드에 쓸 자리도 줄기 때문이다.
 */
export class RelicsScene extends Phaser.Scene {
  private info!: CharacterInfoManager;
  /** 정보창의 급여·돌파가 지갑을 바꾸면 같은 씬이 소유한 상단 표시도 즉시 다시 그린다. */
  private topBar!: TopBar;
  private cards = new Map<string, PortraitCard>();
  /** 스토리 배열 순서와 분리된 도감 표시 정렬 기준이다. */
  private sortMode: "number" | "rarity" = "number";

  constructor() {
    super("relics");
  }

  create(): void {
    setDebugScene("relics");
    this.cards.clear();

    const cx = BASE_WIDTH / 2;
    // background_002를 렐릭 탭의 야외 유적 전경으로 사용한다.
    addSceneBackground(this, BACKGROUND.relics);
    // 밝은 원화 위에서도 카드와 본문을 읽을 수 있도록 기존 void 색을 얇게 덮는다.
    this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void, 0.48).setDepth(-29);
    this.topBar = new TopBar(this, 40, { currencies: "relic" });

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

    new BottomNav(this, "relics");
    this.info = new CharacterInfoManager(this);
    // 정보창 안에서 애착 렐릭이 바뀔 수 있으므로 닫힐 때 카드 표시를 다시 맞춘다.
    this.info.onClose = () => this.refresh();
    // 서버가 재화 차감을 확정한 직후 정보창과 상단 줄이 같은 세션 지갑을 다시 읽는다.
    this.info.onWalletChange = () => this.topBar.refresh();
    this.refresh();
  }

  /**
   * 카드 그리드.
   *
   * 카드마다 전신 원화의 얼굴 부분을 꽉 채워 넣는다. 이름·역할 같은 글자는 아래 띠에만 두고
   * 세부 수치는 요약 칸으로 미뤄, 한눈에 "누가 있는지"부터 보이게 한다.
   */
  private buildGrid(): void {
    const cols = 3;
    const cardW = 300;
    const cardH = 400;
    const gapX = 40;
    const gapY = 74;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (BASE_WIDTH - gridW) / 2 + cardW / 2;
    const startY = 580;

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
        affinity: { element: relic.element, role: relic.role },
        badge: relic.specimenNumber,
        locked: !owned,
      });
      // 카드를 누르면 바로 정보창이 열린다. 애착 설정도 그 안의 뱃지가 맡는다.
      card.hit.on("pointerup", () => this.info.showRelic(relic, relicCollection.owns(relic.id)));
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

  /** 애착 렐릭만 카드에 표시를 남긴다. 정보창에서 바꾸고 나오면 다시 부른다. */
  private refresh(): void {
    for (const [id, card] of this.cards) {
      card.setSelected(relicCollection.owns(id) && id === session.favorite);
    }

  }
}
