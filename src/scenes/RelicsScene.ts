import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import type { RelicDef } from "../core/types";
import { getRelic } from "../data/relics";
import { relicCollection } from "../managers/RelicCollectionManager";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { CharacterInfoManager, ROLE_LABEL } from "../managers/CharacterInfoManager";
import { TopBar } from "../ui/TopBar";
import { COLOR, textStyle } from "../ui/theme";

/**
 * 렐릭 — 보유 중인 렐릭을 훑어보는 화면.
 *
 * 가지지 않은 렐릭도 자리는 남겨 둔다. 무엇이 더 있는지 보여야 뽑을 마음이 든다.
 * 하나를 고르면 아래에 요약이 뜨고, 거기서 정보창을 열거나 애착 렐릭으로 세울 수 있다.
 */
export class RelicsScene extends Phaser.Scene {
  private info!: CharacterInfoManager;
  private selected: string | null = null;
  private cards = new Map<string, Phaser.GameObjects.Rectangle>();
  private summaryName!: Phaser.GameObjects.Text;
  private summaryBody!: Phaser.GameObjects.Text;
  private detailButton!: Button;
  private favoriteButton!: Button;

  constructor() {
    super("relics");
  }

  create(): void {
    setDebugScene("relics");
    this.cards.clear();
    this.selected = session.favorite;

    const cx = BASE_WIDTH / 2;
    this.add.rectangle(cx, 960, BASE_WIDTH, 1920, COLOR.void).setDepth(-30);
    new TopBar(this);

    const ownedCount = relicCollection.owned.length;
    this.add
      .text(40, 170, "보유 렐릭", textStyle({ size: 40 }))
      .setOrigin(0, 0);
    this.add
      .text(
        BASE_WIDTH - 40,
        182,
        `${ownedCount} / ${relicCollection.catalog.length}`,
        textStyle({ size: 30, color: COLOR.accentText }),
      )
      .setOrigin(1, 0);

    this.buildGrid();
    this.buildSummary();

    new BottomNav(this, "relics");
    this.info = new CharacterInfoManager(this);
    this.refresh();
  }

  private buildGrid(): void {
    const cols = 4;
    const cardW = 240;
    const cardH = 250;
    const gapX = 16;
    const gapY = 20;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (BASE_WIDTH - gridW) / 2 + cardW / 2;
    const startY = 380;

    relicCollection.catalog.forEach((relic, i) => {
      const x = startX + (i % cols) * (cardW + gapX);
      const y = startY + Math.floor(i / cols) * (cardH + gapY);
      const owned = relicCollection.owns(relic.id);

      const box = this.add
        .rectangle(x, y, cardW, cardH, COLOR.panel)
        .setStrokeStyle(3, COLOR.panelEdge)
        .setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => {
        if (!owned) return;
        this.selected = relic.id;
        this.refresh();
      });
      this.cards.set(relic.id, box);

      this.add
        .text(x, y - cardH / 2 + 18, owned ? relic.name : "???", textStyle({ size: 32 }))
        .setOrigin(0.5, 0)
        .setAlpha(owned ? 1 : 0.45);
      this.add
        .text(
          x,
          y - cardH / 2 + 64,
          owned ? ROLE_LABEL[relic.role] : "미발굴",
          textStyle({ size: 24, color: owned ? COLOR.accentText : COLOR.inkDim }),
        )
        .setOrigin(0.5, 0);

      if (owned) {
        this.add
          .text(
            x,
            y - cardH / 2 + 112,
            `HP ${relic.stats.hp}\n공 ${relic.stats.atk}  방 ${relic.stats.def}`,
            textStyle({ size: 22, color: COLOR.inkDim, align: "center", lineSpacing: 6 }),
          )
          .setOrigin(0.5, 0);
      } else {
        box.setAlpha(0.4);
      }
    });
  }

  /** 아래쪽 요약 칸. 고른 렐릭이 무엇인지와, 거기서 할 수 있는 것을 모아 둔다. */
  private buildSummary(): void {
    const top = NAV_TOP - 400;
    this.add
      .rectangle(BASE_WIDTH / 2, top + 190, BASE_WIDTH - 60, 380, COLOR.panel)
      .setStrokeStyle(3, COLOR.panelEdge);

    this.summaryName = this.add.text(60, top + 30, "", textStyle({ size: 38 })).setOrigin(0, 0);
    this.summaryBody = this.add
      .text(60, top + 88, "", textStyle({ size: 26, color: COLOR.inkDim, lineSpacing: 8 }))
      .setOrigin(0, 0);

    this.detailButton = new Button(this, 300, top + 300, {
      width: 400,
      height: 110,
      label: "상세 정보",
      fontSize: 32,
      onClick: () => {
        if (this.selected) this.info.showRelic(getRelic(this.selected));
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
    for (const [id, box] of this.cards) {
      const owned = relicCollection.owns(id);
      const chosen = owned && id === this.selected;
      box.setStrokeStyle(chosen ? 5 : 3, chosen ? COLOR.accent : COLOR.panelEdge);
      box.setFillStyle(chosen ? COLOR.panelEdge : COLOR.panel);
    }

    const def: RelicDef | null = this.selected ? getRelic(this.selected) : null;
    const isFavorite = def !== null && session.favorite === def.id;

    this.summaryName.setText(def ? def.name : "렐릭을 고르세요");
    this.summaryBody.setText(
      def
        ? [
            `${def.origin} · ${ROLE_LABEL[def.role]}`,
            `패시브 · ${def.passive.name}`,
            `궁극기 · ${def.ultimate.name}`,
            isFavorite ? "로비에 서 있는 애착 렐릭이다." : "",
          ]
            .filter(Boolean)
            .join("\n")
        : "",
    );

    this.detailButton.setEnabled(def !== null);
    this.favoriteButton.setSub("").setEnabled(def !== null && !isFavorite);
  }
}
