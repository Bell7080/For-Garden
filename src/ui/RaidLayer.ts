import Phaser from "phaser";
import type { RaidSeasonResponse } from "../api/contracts";
import { getRelic } from "../data/relics";
import { t } from "../i18n";
import { computeFaceBandFrame } from "../puppets/anchors";
import { portraitAssetFor, withPuppetTexture } from "../puppets/assets";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { bakeBandTexture } from "./faceTexture";
import { drawFrameVignette, drawLayer, drawShapeOutline, HoloBar, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { shapeClipMask } from "./popupArt";
import { RAID_HP_BAR_COLOR, RAID_LIST } from "./raidLayout";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 레이드 목록의 **월드 폭주 층** 한 장.
 *
 * 교류 목록의 층과 같은 문법(원화가 판을 채우고 글은 어둠 위에 선다)이되, 원화가 판 전체가
 * 아니라 **오른쪽을 얼굴로 꽉 채운다** — 층이 말해야 하는 것이 "어디인가"가 아니라 "누구인가"라서다.
 * 왼쪽에는 이름·레벨·남은 도전·보상, 맨 밑에는 서버 전체가 함께 깎는 남은 체력이 선다.
 *
 * **한 겹 더 두른다.** 오늘 한 마리뿐인 시스템 보스라 그 아래 쌓일 친구 레이드와 급을 가른다 —
 * 판 안쪽 선은 강조색, 그 바깥 한 뼘에 폭주의 붉은 선이 한 줄 더 돈다. 원화 한 장을 통째로 담는
 * 액자라 사방 외곽선을 두르는 예외(교류 층·적 정보창과 같다)다.
 */
export function addRaidWorldLayer(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  season: RaidSeasonResponse,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const { width, slant, padding, world, worldRing, art, text, reward, hp } = RAID_LIST;
  const height = world.height;
  const layer = scene.add.container(0, world.y);
  parent.add(layer);
  const shape = slantedRect(width, height, slant);
  const top = -height / 2;
  const left = -width / 2 + slant / 2 + padding;

  layer.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.92 }));
  // 원화는 **이미지 자신을 구워** 판 실루엣대로 잘라 둔다 — 목록은 흐르고 기하 마스크는 그 이동을
  // 따라오지 않는다(교류 층과 같은 이유).
  void loadFaceBand(scene, layer, season.bossRelicId, width + slant, height, shape);
  // 글이 서는 왼쪽만 어둠이 올라온다. 얼굴 쪽까지 누르면 누구인지가 흐려진다.
  const scrim = scene.add.graphics();
  scrim.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, 0.86, 0, 0.86, 0);
  scrim.fillRect(-width / 2 + slant / 2, top, width * (art.from + art.fade), height);
  layer.add(scrim);
  // 가장자리는 살짝만 누른다 — 네 변 그라데이션이라 기운 변 밖으로 새지 않게 판 모양으로 가둔다.
  layer.add(drawFrameVignette(scene, 0, 0, width, height, { strength: 0.42 }).setMask(shapeClipMask(scene, layer, shape)));
  layer.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.accent, alpha: 0.72, width: 3 }));
  layer.add(drawShapeOutline(scene, 0, 0, slantedRect(width + worldRing * 2, height + worldRing * 2, slant), { color: RAID_HP_BAR_COLOR, alpha: 0.9, width: 4 }));

  // 판 윗변에 걸터앉는 제목표가 이 층이 무엇인지 말한다 — 다른 판의 제목과 같은 한 모양이다.
  addSectionTitle(scene, -width / 2 + slant / 2, top - 4, t("raid.world.tag"), { parent: layer });
  const name = scene.add
    .text(left, text.nameY, getRelic(season.bossRelicId).name, textStyle({ role: "display", size: 58 }))
    .setOrigin(0, 0.5)
    .setShadow(0, 4, "#05070a", 8, false, true);
  // 이름은 글줄이 서는 왼쪽 몫 안에서 끝난다 — 넘치면 얼굴을 덮는다.
  shrinkTextToWidth(name, width * (art.from + art.fade * 0.5) - padding);
  layer.add(name);
  layer.add(scene.add
    .text(left, text.levelY, t("raid.world.level", { level: season.bossLevel }), textStyle({ role: "emphasis", size: 28, color: COLOR.accentText }))
    .setOrigin(0, 0.5)
    .setShadow(0, 2, "#05070a", 5, false, true));
  const remaining = Math.max(0, season.attemptsLimit - season.attemptsUsed);
  layer.add(scene.add
    .text(left, text.attemptsY, t("raid.attempts", { remaining, limit: season.attemptsLimit }), textStyle({ role: "emphasis", size: 28, color: remaining > 0 ? COLOR.sortieText : COLOR.inkDim }))
    .setOrigin(0, 0.5)
    .setShadow(0, 2, "#05070a", 5, false, true));

  // 보상은 오늘 받을 수 있는 증표 전부다 — 내 두 판의 기여와 서버 전체의 진행을 더한 값.
  // 같은 증표를 두 칸으로 세우면 무엇이 다른지 그림이 말하지 못하므로 한 칸에 모은다.
  const total = [...season.rewardStages, ...season.worldStages].reduce((sum, stage) => sum + stage.reward.amount, 0);
  const currency = season.worldStages[0]?.reward.currency ?? "raidSigil";
  addFramedIcon(scene, layer, left + reward.size / 2, reward.y, reward.size, CURRENCY_ICON_BY_WALLET[currency], { amount: total.toLocaleString() });

  // 맨 밑은 서버 전체가 함께 깎는 남은 체력이다. 잡지 못해도 되는 보스라 게이지가 비지 않은 채
  // 하루가 끝나는 날이 있다 — 그래서 수치는 남은 몫이 아니라 **남은 비율**로 짧게 선다.
  const barWidth = width - slant - padding * 2;
  const barY = height / 2 - hp.up;
  const bar = new HoloBar(scene, 0, barY, barWidth, hp.height, { color: RAID_HP_BAR_COLOR, trackAlpha: 0.82, outline: true, ticks: 7 });
  bar.setValue(season.totalHp > 0 ? season.remainingHp / season.totalHp : 0);
  bar.objects.forEach((object) => layer.add(object));
  const percent = season.totalHp > 0 ? Math.ceil(season.remainingHp / season.totalHp * 100) : 0;
  layer.add(scene.add
    .text(-barWidth / 2, height / 2 - hp.labelUp, season.defeated ? t("raid.boss.defeated") : t("raid.boss.remaining"), textStyle({ role: "emphasis", size: 24, color: season.defeated ? COLOR.accentText : COLOR.inkDim }))
    .setOrigin(0, 0.5)
    .setShadow(0, 2, "#05070a", 5, false, true));
  layer.add(scene.add
    .text(barWidth / 2, height / 2 - hp.labelUp, t("raid.world.percent", { percent }), textStyle({ role: "display", size: 30, color: COLOR.ink }))
    .setOrigin(1, 0.5)
    .setShadow(0, 3, "#05070a", 6, false, true));

  const hit = scene.add.rectangle(0, 0, width - slant, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => layer.setScale(1.02));
  hit.on("pointerout", () => layer.setScale(1));
  hit.on("pointerup", () => { layer.setScale(1); onTap(); });
  layer.add(hit);
  return layer;
}

/**
 * 오른쪽을 채우는 얼굴 띠를 구워 판 바로 위에 얹는다.
 *
 * 구운 뒤에는 원본을 놓는다(`withPuppetTexture`) — 층이 그리는 것은 구운 제 텍스처뿐이다.
 */
async function loadFaceBand(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  relicId: string,
  width: number,
  height: number,
  shape: readonly number[],
): Promise<void> {
  const { art } = RAID_LIST;
  const asset = portraitAssetFor(getRelic(relicId).portraitAssetId);
  const artWidth = Math.round(width * (1 - art.from));
  const key = await withPuppetTexture(scene, asset, ({ key: source, anchors }) => {
    if (!layer.active) return undefined;
    const crop = computeFaceBandFrame(asset, anchors.head, {
      width: artWidth, height,
      crop: art.crop / ((asset.cardZoom ?? 1) * (asset.portraitZoom ?? 1)),
      headX: art.headX, anchorY: art.anchorY,
    });
    return bakeBandTexture(scene, source, { width, height }, crop, { shape, from: art.from, fade: art.fade });
  });
  if (!key || !layer.active) return;
  const image = scene.add.image(0, 0, key).setAlpha(0);
  // 판 면 바로 위(1번)에 선다 — 어둠·테두리·글은 그 위에 남는다.
  layer.addAt(image, 1);
  scene.tweens.add({ targets: image, alpha: 1, duration: 200 });
}
