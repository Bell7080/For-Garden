import Phaser from "phaser";
import type { RaidDto, RaidRewardDto } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { formatCurrency } from "../core/formatCurrency";
import { getRelic } from "../data/relics";
import { setDebugRewardPopup } from "../debug";
import { t } from "../i18n";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawHairline, HoloBar } from "./holo";
import { addFramedIcon } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { RAID_DIFFICULTY_TONE } from "./raidLayout";
import { RAID_SETTLEMENT_POPUP as L, raidSettlementHeight, raidSettlementSummary, raidSettlementY } from "./raidSettlementLayout";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface RaidSettlementPopupOptions {
  /** 정산을 마친 판 — 서버 응답의 `raid`. 순위·몫·점수를 여기서 읽는다. */
  raid: RaidDto;
  /** 이번 정산으로 지갑에 들어온 것. 이미 받은 판이면 비어 있다. */
  granted: readonly RaidRewardDto[];
  onClose?: () => void;
}

/**
 * **레이드 정산 창** — 공용 영수증 대신 레이드만의 한 장이다.
 *
 * 받는 몫이 내가 민 만큼이라 「무엇을 받았나」만으로는 모자라다. 위에는 **기여도**(몇 위 · 판 전체 중
 * 몇 %), 가운데는 **정산 보상**, 아래는 **내 점수**가 선다. 고를 것이 없는 영수증이라 화면 아무 곳이나
 * 누르면 닫히고, 그 말은 창 바로 아래에서 한다(화면 밑동은 목록의 소환 줄 자리다). 자리는 `RAID_SETTLEMENT_POPUP` 한 표다.
 */
export function openRaidSettlementPopup(scene: Phaser.Scene, popups: PopupLayer, options: RaidSettlementPopupOptions): void {
  const { raid } = options;
  const summary = raidSettlementSummary(raid);
  const height = raidSettlementHeight();
  const y = raidSettlementY;
  const half = L.width / 2;
  let hint: Phaser.GameObjects.Text | undefined;
  setDebugRewardPopup(true, options.granted.length, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 + y(L.score.valueY) });
  popups.open({
    width: L.width, height, title: t("raid.settle.title"),
    dim: true, dimAlpha: 0.66, closeOnBackdrop: true, hideCloseButton: true,
    onClose: () => { hint?.destroy(); setDebugRewardPopup(false); options.onClose?.(); },
  }, (body, close) => {
    body.parentContainer?.setDepth(4000);
    // 닫는 판은 맨 아래 — 위에 덮으면 보상 액자가 제 안내창을 열지 못한다.
    const hit = scene.add.rectangle(0, 0, L.width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => close());
    body.add(hit);

    // 머리: 어느 판의 정산인지 — 보스 이름 · 난이도(난이도 색) · 토벌 여부.
    const name = scene.add.text(0, y(L.head.y), t("raid.detail.name", { name: getRelic(raid.bossRelicId).name, level: raid.bossLevel }), textStyle({ role: "display", size: L.head.nameSize })).setOrigin(0, 0.5);
    const tag = scene.add.text(0, y(L.head.y), `${t(`raid.difficulty.${raid.difficulty}`)} · ${t(raid.defeated ? "raid.boss.defeated" : "raid.layer.ended")}`, textStyle({ role: "emphasis", size: L.head.tagSize, color: `#${RAID_DIFFICULTY_TONE[raid.difficulty].toString(16).padStart(6, "0")}` })).setOrigin(0, 0.5);
    shrinkTextToWidth(name, L.width - 160 - tag.width - L.head.gap);
    const lineWidth = name.displayWidth + L.head.gap + tag.width;
    name.setX(-lineWidth / 2);
    tag.setX(-lineWidth / 2 + name.displayWidth + L.head.gap);
    body.add([name, tag]);

    // 기여도: 왼쪽은 순위와 참가 인원, 오른쪽은 판 전체 중 내 몫.
    const c = L.contribution;
    addSectionTitle(scene, -half + 36, y(c.titleY), t("raid.settle.contribution"), { parent: body });
    body.add(scene.add.text(c.leftX, y(c.rankY), summary.rank ? t("raid.settle.rank", { rank: summary.rank }) : "-", textStyle({ role: "display", size: c.rankSize, color: COLOR.accentText }))
      .setOrigin(0.5).setShadow(0, 4, "#000000", 6, false, true));
    body.add(scene.add.text(c.leftX, y(c.participantsY), t("raid.settle.participants", { count: summary.participants }), textStyle({ role: "emphasis", size: c.participantsSize, color: COLOR.inkDim })).setOrigin(0.5));
    body.add(scene.add.text(c.rightX, y(c.shareY), t("raid.world.percent", { percent: summary.sharePercent }), textStyle({ role: "display", size: c.shareSize, color: COLOR.ink })).setOrigin(0.5));
    const bar = new HoloBar(scene, c.rightX, y(c.barY), c.barWidth, c.barHeight, { color: COLOR.accent, trackAlpha: 0.82, outline: true, ticks: 4 });
    bar.setValue(summary.sharePercent / 100);
    bar.objects.forEach((object) => body.add(object));

    // 정산 보상 — 액자는 어디서나 같은 한 장이다. 이미 받은 판이면 줄을 비운다.
    addSectionTitle(scene, -half + 36, y(L.reward.titleY), t("raid.reward.title"), { parent: body });
    const items = options.granted.filter((reward) => reward.amount > 0);
    const startX = -((items.length - 1) * L.reward.gap) / 2;
    items.forEach((reward, index) => {
      addFramedIcon(scene, body, startX + index * L.reward.gap, y(L.reward.frameY), L.reward.frame, CURRENCY_ICON_BY_WALLET[reward.currency as keyof typeof CURRENCY_ICON_BY_WALLET] ?? "", { amount: formatCurrency(reward.amount) });
    });
    if (items.length === 0) {
      body.add(scene.add.text(0, y(L.reward.frameY), t("raid.settle.done"), textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    }

    // 내 점수 — 판 밑동에 크게. 이 판에서 내가 민 피해의 합이다.
    body.add(drawHairline(scene, 0, y(L.score.hairlineY), L.width - 160, { color: COLOR.accent, alpha: 0.3 }));
    body.add(scene.add.text(0, y(L.score.labelY), t("raid.settle.score"), textStyle({ role: "emphasis", size: L.score.labelSize, color: COLOR.inkDim })).setOrigin(0.5));
    body.add(scene.add.text(0, y(L.score.valueY), summary.score.toLocaleString(), textStyle({ role: "display", size: L.score.valueSize, color: COLOR.accentText }))
      .setOrigin(0.5).setShadow(0, 4, "#000000", 6, false, true));

    hint = scene.add
      .text(BASE_WIDTH / 2, BASE_HEIGHT / 2 + height / 2 + L.hintBelow, t("reward.tapHint"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5).setAlpha(0.62).setDepth(4000);
    hint.setShadow(0, 3, "#000000", 4, false, true);
  });
}
