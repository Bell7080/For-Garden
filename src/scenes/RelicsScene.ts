import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { sortRelicsByRarity, sortRelicsBySpecimenNumber } from "../data/relics";
import { combatPower } from "../core/combatPower";
import type { RelicDef } from "../core/types";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import { BottomNav } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { CharacterInfoManager } from "../managers/CharacterInfoManager";
import { TopBar } from "../ui/TopBar";
import { PortraitCard, relicCardTint } from "../ui/PortraitCard";
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
/** 도감 정렬 기준. 버튼 하나가 이 순서대로 돌아간다. */
type SortMode = "number" | "rarity" | "power";
const SORT_ORDER: readonly SortMode[] = ["number", "rarity", "power"];
const SORT_LABELS: Record<SortMode, string> = { number: "개체번호순", rarity: "희귀도순", power: "전투력순" };

export class RelicsScene extends Phaser.Scene {
  private info!: CharacterInfoManager;
  /** 상단 줄은 재화 칸 없이 프로필·설정만 세운다. 지갑이 바뀌면 디버그 표시만 다시 읽는다. */
  private topBar!: TopBar;
  private cards = new Map<string, PortraitCard>();
  /** 스토리 배열 순서와 분리된 도감 표시 정렬 기준이다. */
  private sortMode: SortMode = "number";
  /** 정렬 버튼 하나가 세 기준을 돌아가며 맡는다. 라벨을 바꿔 지금 기준을 알린다. */
  private sortButton!: Button;
  /** 그리드와 함께 지웠다 다시 그리는 구분 제목들. */
  private sectionLabels: Phaser.GameObjects.Text[] = [];

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
    // 도감에서 재화를 쓰는 곳은 정보창뿐이고, 거기서 급여 버튼이 치즈케이크 수를 직접 말한다.
    // 목록을 훑는 화면이라 상단 줄에는 설정만 남긴다. 프로필도 재화도 여기서는 볼 일이 없다.
    this.topBar = new TopBar(this, 40, {
      currencies: "none", profile: false,
      // 설정을 닫으면 목록의 현재 정렬 상태를 가진 이 씬 인스턴스로 돌아온다.
      onSettings: () => this.scene.start("settings", { returnScene: "relics" }),
    });

    const ownedCount = relicCollection.owned.length;
    this.add
      .text(40, 152, "보유 렐릭", textStyle({ role: "display", size: 56 }))
      .setOrigin(0, 0);
    this.add
      .text(
        BASE_WIDTH - 40,
        176,
        `${ownedCount} / ${relicCollection.catalog.length}`,
        textStyle({ role: "emphasis", size: 32, color: COLOR.accentText }),
      )
      .setOrigin(1, 0);

    // 정렬은 버튼 **하나**다. 기준마다 버튼을 세우면 지금 어느 기준인지 버튼 색으로 읽어야
    // 하고, 기준이 늘 때마다 줄이 좁아진다. 누를 때마다 다음 기준으로 돌아간다.
    this.sortButton = new Button(this, BASE_WIDTH / 2, 262, {
      width: 460, height: 82, label: SORT_LABELS[this.sortMode], fontSize: 26,
      onClick: () => this.setSortMode(SORT_ORDER[(SORT_ORDER.indexOf(this.sortMode) + 1) % SORT_ORDER.length]),
    });

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

    // 보유와 미보유를 섞지 않는다. 가진 것을 먼저 다 보여 준 뒤, 아직 없는 것을 아래로
    // 몰아 따로 세운다 — 정렬 기준이 무엇이든 "내 것"이 위에 모여 있어야 훑기 쉽다.
    const sorted = this.sortRelics(relicCollection.catalog);
    const owned = sorted.filter((relic) => relicCollection.owns(relic.id));
    const locked = sorted.filter((relic) => !relicCollection.owns(relic.id));
    const ownedRows = Math.max(1, Math.ceil(owned.length / cols));
    // 보유 그리드의 마지막 줄 아래에서 제목 한 줄을 두고 다시 시작한다. 붙여 놓으면 제목이
    // 위 카드의 이름줄과 같은 덩어리로 읽혀 어디부터가 미보유인지 흐려진다.
    const ownedBottom = startY + (ownedRows - 1) * (cardH + gapY) + cardH / 2;
    const place = (list: RelicDef[], baseY: number): void => list.forEach((relic, i) => {
      const x = startX + (i % cols) * (cardW + gapX);
      const y = baseY + Math.floor(i / cols) * (cardH + gapY);
      this.placeCard(relic, x, y, cardW, cardH);
    });
    place(owned, startY);
    if (locked.length > 0) {
      const labelY = ownedBottom + 108;
      this.sectionLabels.push(this.add.text(40, labelY, "미보유 렐릭", textStyle({ role: "display", size: 40, color: COLOR.inkDim })).setOrigin(0, 1));
      this.sectionLabels.push(this.add.text(BASE_WIDTH - 40, labelY - 4, String(locked.length), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(1, 1));
      place(locked, labelY + 44 + cardH / 2);
    }
  }

  /** 지금 기준으로 목록을 정렬한다. 기준이 무엇이든 같은 카드 조립을 쓴다. */
  private sortRelics(catalog: readonly RelicDef[]): RelicDef[] {
    if (this.sortMode === "rarity") return sortRelicsByRarity(catalog);
    if (this.sortMode === "power") {
      // 미보유는 성장이 없으므로 기본 능력치의 전투력으로 줄을 세운다.
      const powerOf = (relic: RelicDef): number => combatPower(relicCollection.owns(relic.id) ? relicProgression.getFinalStats(relic.id) : relic.stats);
      return [...catalog].sort((a, b) => powerOf(b) - powerOf(a) || a.specimenNumber.localeCompare(b.specimenNumber));
    }
    return sortRelicsBySpecimenNumber(catalog);
  }

  /** 카드 한 장. 자리는 부르는 쪽이 정하고 여기서는 생김새와 입력만 맞춘다. */
  private placeCard(relic: RelicDef, x: number, y: number, cardW: number, cardH: number): void {
    {
      const owned = relicCollection.owns(relic.id);

      const card = new PortraitCard(this, x, y, {
        width: cardW,
        height: cardH,
        portraitAssetId: relic.portraitAssetId,
        tint: relicCardTint(relic),
        label: relic.name,
        level: owned ? relicProgression.getProgress(relic.id).level : undefined,
        rarity: relic.rarity,
        stars: owned ? relicProgression.getStars(relic.id) : undefined,
        affinity: { element: relic.element, role: relic.role },
        locked: !owned,
      });
      // 카드를 누르면 바로 정보창이 열린다. 애착 설정도 그 안의 뱃지가 맡는다.
      card.hit.on("pointerup", () => this.info.showRelic(relic, relicCollection.owns(relic.id)));
      this.cards.set(relic.id, card);
    }
  }

  /** 정렬을 바꾸면 카드만 재조립하고 선택·보유 상태는 그대로 보존한다. */
  private setSortMode(mode: SortMode): void {
    if (this.sortMode === mode) return;
    this.sortMode = mode;
    this.sortButton.setLabel(SORT_LABELS[mode]);
    for (const card of this.cards.values()) card.destroy();
    this.cards.clear();
    for (const label of this.sectionLabels) label.destroy();
    this.sectionLabels = [];
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
