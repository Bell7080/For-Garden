import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { findItem } from "../data/items";
import { Button } from "./Button";
import type { CurrencyIconKey } from "./currencyIcons";
import { addItemPriceTag } from "./priceTag";
import { RESEARCH_ACTION, RESEARCH_BENCH } from "./researchBenchLayout";
import { COLOR, textStyle } from "./theme";

/**
 * 특성 연구대의 조작 한 줄.
 *
 * **이 화면의 조작은 아이템을 태워 굴리는 일이다.** 라벨만 적힌 판이던 때는 무엇을 쓰는지·
 * 몇 개 남았는지·몇 개를 태우는지가 눌러 보기 전에는 없는 정보였고, 모자란 줄이 흐려지기만
 * 해서 **왜 못 누르는지**를 화면이 말하지 않았다. 지금은 그 셋이 줄 위에 함께 선다:
 * 왼쪽에 아이템 액자(우하단에 보유량), 가운데에 무엇을 하는 조작인지와 그 아이템 이름,
 * 오른쪽에 드는 수.
 *
 * **액자는 재화가 서는 그 한 장을 그대로 쓴다**(`addItemPriceTag`) — 가방·영수증·상점과 같은
 * 규격·같은 수량 자리라, 같은 고대 핵이 화면마다 다른 크기로 보이지 않는다. 버튼 판 안에
 * 액자를 넣지 않는다는 규칙(한계 돌파 버튼)은 **값을 치르는 버튼**의 것이다 — 거기서는 판이
 * 두 겹으로 보이지만, 여기서는 그 아이템 자체가 조작의 주어라 액자가 줄의 머리에 선다.
 *
 * 재화(원석)를 치르는 줄만 액자 없이 그림과 수를 바짝 붙인다. 그 양식은 이미 버튼 비용
 * 표기의 공용 규칙이고, 재화는 가방 칸이 아니라 상단 줄에서 세는 것이라 보유량을 다시 적지
 * 않는다.
 */
export interface ResearchActionRowSpec {
  labelKey: TextKey;
  enabled: boolean;
  /** 아이템을 태우는 조작. 액자에 그 그림과 **보유량**이 서고, 모자라면 그 수가 붉어진다. */
  item?: { itemId: string; owned: number; cost: number };
  /** 재화를 치르는 조작. 액자 없이 그림과 수를 바짝 붙인다. */
  cost?: { icon: CurrencyIconKey; amount: number };
  onPress: () => void;
}

/** 줄 하나를 세운다. 누르는 일·눌린 크기·비활성 흐리기는 공용 버튼이 그대로 맡는다. */
export function addResearchActionRow(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  spec: ResearchActionRowSpec,
): Button {
  const width = RESEARCH_BENCH.actionWidth;
  const height = RESEARCH_BENCH.actionHeight;
  const row = new Button(scene, x, y, {
    width,
    height,
    // 글자는 이 줄이 직접 세운다. 버튼이 가운데에 세우는 라벨과 겹치지 않도록 비워 둔다.
    label: "",
    onClick: () => { if (spec.enabled) spec.onPress(); },
  });

  const left = -width / 2 + RESEARCH_ACTION.padX;
  const right = width / 2 - RESEARCH_ACTION.padX;
  // 글이 시작하는 x는 **액자가 있든 없든 같다.** 줄마다 달라지면 넷이 한 줄씩 어긋나 보인다.
  const textLeft = left + RESEARCH_ACTION.frame + RESEARCH_ACTION.gap;

  if (spec.item !== undefined) {
    const { itemId, owned, cost } = spec.item;
    addItemPriceTag(scene, row, left + RESEARCH_ACTION.frame / 2, 0, itemId, owned, {
      size: RESEARCH_ACTION.frame,
      // 값이 아니라 **가진 수**다. 모자란 줄만 그 수가 붉어져 왜 못 누르는지를 수가 직접 말한다.
      short: owned < cost,
    });
    row.add(scene.add.text(textLeft, -14, t(spec.labelKey),
      textStyle({ role: "display", size: RESEARCH_ACTION.labelSize })).setOrigin(0, 0.5));
    row.add(scene.add.text(textLeft, 22, findItem(itemId)?.name ?? itemId,
      textStyle({ role: "body", size: RESEARCH_ACTION.itemNameSize, color: COLOR.inkDim })).setOrigin(0, 0.5));
    // 드는 수는 오른쪽 끝이다. 액자 안의 보유량과 마주 보아 "가진 것 / 드는 것"이 한 줄에 선다.
    row.add(scene.add.text(right, 0, `×${cost}`,
      textStyle({ role: "display", size: RESEARCH_ACTION.costSize, color: COLOR.accentText })).setOrigin(1, 0.5));
  } else {
    row.add(scene.add.text(textLeft, 0, t(spec.labelKey),
      textStyle({ role: "display", size: RESEARCH_ACTION.labelSize })).setOrigin(0, 0.5));
  }

  if (spec.cost !== undefined) {
    // **재화는 지금까지의 양식 그대로다** — 액자 없이 그림과 수를 바짝 붙이고, 그림자 한 겹을
    // 깔아 상단 재화 줄·버튼 비용과 같은 방식으로 앉는다. 모자란 수만 붉어진다.
    const coin = RESEARCH_ACTION.costSize * 1.16;
    const amount = scene.add.text(right, 0, spec.cost.amount.toLocaleString(),
      textStyle({ role: "display", size: RESEARCH_ACTION.costSize, color: spec.enabled ? COLOR.ink : COLOR.dangerText }))
      .setOrigin(1, 0.5).setScale(1, 1.14);
    row.add(amount);
    const coinX = right - amount.width - 8 - coin / 2;
    row.add(scene.add.image(coinX + 3, 4, spec.cost.icon).setDisplaySize(coin, coin).setTint(0x05070a).setAlpha(0.55));
    row.add(scene.add.image(coinX, 0, spec.cost.icon).setDisplaySize(coin, coin));
  }

  row.setEnabled(spec.enabled);
  parent.add(row);
  return row;
}
