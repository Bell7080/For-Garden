import Phaser from "phaser";
import type { RaidDto } from "../api/contracts";
import { RAID_DIFFICULTY } from "../data/raid";
import { getRelic } from "../data/relics";
import { t } from "../i18n";
import { computeFaceBandFrame } from "../puppets/anchors";
import { portraitAssetFor, withPuppetTexture } from "../puppets/assets";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { bakeBandTexture } from "./faceTexture";
import { drawFrameVignette, drawLayer, drawShapeEdge, drawShapeOutline, HoloBar, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { shapeClipMask } from "./popupArt";
import { RAID_BOSS_PICK, RAID_DIFFICULTY_TONE, RAID_HP_BAR_COLOR, RAID_LAYER_OWNER, RAID_LAYER_TONE, RAID_LIST } from "./raidLayout";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface RaidLayerHandlers {
  /** 층을 눌렀을 때. 목록을 끌던 손이면 부른 쪽이 거른다. */
  onTap: () => void;
  /** 끝난 판의 정산. 참여했고 아직 받지 않은 판에만 버튼이 선다. */
  onSettle?: () => void;
}

/** 층 윗변에 걸터앉는 제목표. 월드 폭주는 그 이름, 소환 레이드는 난이도다. */
export function raidTagLabel(raid: RaidDto): string {
  return raid.kind === "world" ? t("raid.world.tag") : t(`raid.difficulty.${raid.difficulty}`);
}

/**
 * 레이드 목록의 **층** 한 장 — 월드 폭주든 소환 레이드든 같은 한 장이다.
 *
 * 교류 목록의 층과 같은 문법(원화가 판을 채우고 글은 어둠 위에 선다)이되, 원화가 판 전체가
 * 아니라 **오른쪽을 얼굴로 꽉 채운다** — 층이 말해야 하는 것이 "어디인가"가 아니라 "누구인가"라서다.
 * 왼쪽에는 이름·레벨·남은 도전·보상, 맨 밑에는 참가자 전원이 함께 깎는 남은 체력이 선다.
 *
 * **월드 폭주만 한 겹 더 두른다.** 하루 한 마리뿐인 시스템 보스라 그 아래 쌓이는 소환 레이드와
 * 급을 가른다 — 판 안쪽 선은 강조색, 그 바깥 한 뼘에 폭주의 붉은 선이 한 줄 더 돈다. 원화 한 장을
 * 통째로 담는 액자라 사방 외곽선을 두르는 예외(교류 층·적 정보창과 같다)다.
 *
 * **보상 칸은 정산의 몫이다.** 참여했으면 지금까지의 몫(끝난 판이면 받을 몫), 아직 치지 않았으면
 * 이 판이 줄 수 있는 최대치가 선다 — 판이 끝나야 받고, 받는 것은 완료 탭의 정산 버튼이다.
 */
export function addRaidLayer(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  raid: RaidDto,
  y: number,
  handlers: RaidLayerHandlers,
): Phaser.GameObjects.Container {
  const { width, slant, padding, worldRing, art, rewardText, settle } = RAID_LIST;
  const spec = RAID_LIST.kinds[raid.kind];
  const { height, text, reward, hp } = spec;
  const layer = scene.add.container(0, y);
  parent.add(layer);
  const shape = slantedRect(width, height, slant);
  const top = -height / 2;
  const left = -width / 2 + slant / 2 + padding;
  const completed = raid.status === "completed";

  layer.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.92 }));
  // 원화는 **이미지 자신을 구워** 판 실루엣대로 잘라 둔다 — 목록은 흐르고 기하 마스크는 그 이동을
  // 따라오지 않는다(교류 층과 같은 이유).
  void loadFaceBand(scene, layer, raid.bossRelicId, width + slant, height, shape, completed);
  // 입력면은 판 바로 위에 깐다 — 그 위에 서는 정산 버튼이 먼저 손을 받는다.
  const hit = scene.add.rectangle(0, 0, width - slant, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => layer.setScale(1.02));
  hit.on("pointerout", () => layer.setScale(1));
  hit.on("pointerup", () => { layer.setScale(1); handlers.onTap(); });
  layer.add(hit);
  // 글이 서는 왼쪽만 어둠이 올라온다. 얼굴 쪽까지 누르면 누구인지가 흐려진다.
  const scrim = scene.add.graphics();
  scrim.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, 0.86, 0, 0.86, 0);
  scrim.fillRect(-width / 2 + slant / 2, top, width * (art.from + art.fade), height);
  layer.add(scrim);
  // 난이도의 색이 뒷배경을 은은하게 물들인다 — 글이 서는 왼쪽에서 가장 짙고 얼굴 쪽으로 풀린다.
  // 어둠 위에 얹어야 보인다. **마스크가 아니라 도형을 잘라** 판 안에 가둔다 — 층마다 기하 마스크를
  // 하나 더 걸면 목록 전체가 스텐실을 그만큼 더 그린다. 기운 변은 왼쪽 하나뿐이라 그 삼각형만 따로 칠한다.
  const tone = RAID_DIFFICULTY_TONE[raid.difficulty];
  const wash = scene.add.graphics();
  const inner = -width / 2 + slant;
  wash.fillStyle(tone, RAID_LAYER_TONE.washAlpha);
  wash.fillTriangle(-width / 2, top + height, inner, top, inner, top + height);
  wash.fillGradientStyle(tone, tone, tone, tone, RAID_LAYER_TONE.washAlpha, 0, RAID_LAYER_TONE.washAlpha, 0);
  wash.fillRect(inner, top, width * RAID_LAYER_TONE.washReach - slant, height);
  layer.add(wash);
  // 가장자리는 살짝만 누른다 — 네 변 그라데이션이라 기운 변 밖으로 새지 않게 판 모양으로 가둔다.
  layer.add(drawFrameVignette(scene, 0, 0, width, height, { strength: 0.42 }).setMask(shapeClipMask(scene, layer, shape)));
  layer.add(drawShapeOutline(scene, 0, 0, shape, { color: raid.kind === "world" ? COLOR.accent : COLOR.panelEdge, alpha: raid.kind === "world" ? 0.72 : 0.5, width: 3 }));
  layer.add(drawShapeEdge(scene, 0, 0, shape, "top", { color: tone, alpha: RAID_LAYER_TONE.edgeAlpha, width: RAID_LAYER_TONE.edgeWidth }));
  if (raid.kind === "world") {
    layer.add(drawShapeOutline(scene, 0, 0, slantedRect(width + worldRing * 2, height + worldRing * 2, slant), { color: RAID_HP_BAR_COLOR, alpha: 0.9, width: 4 }));
  }

  // 판 윗변에 걸터앉는 제목표가 이 층이 무엇인지 말한다 — 다른 판의 제목과 같은 한 모양이다.
  addSectionTitle(scene, -width / 2 + slant / 2, top - 4, raidTagLabel(raid), { parent: layer });
  const textWidth = width * (art.from + art.fade * 0.5) - padding;
  const shadowed = (object: Phaser.GameObjects.Text, blur = 5): Phaser.GameObjects.Text => object.setShadow(0, 2, "#05070a", blur, false, true);
  const name = shadowed(scene.add
    .text(left, text.nameY, getRelic(raid.bossRelicId).name, textStyle({ role: "display", size: spec.nameSize }))
    .setOrigin(0, 0.5), 8);
  // 이름은 글줄이 서는 왼쪽 몫 안에서 끝난다 — 넘치면 얼굴을 덮는다.
  shrinkTextToWidth(name, textWidth);
  layer.add(name);
  layer.add(shadowed(scene.add
    .text(left, text.levelY, t("raid.world.level", { level: raid.bossLevel }), textStyle({ role: "emphasis", size: 28, color: COLOR.accentText }))
    .setOrigin(0, 0.5)));
  // 누가 열었는지는 층 윗변 오른쪽 위에 회색으로 비켜 선다 — 이름·레벨 줄에 붙이면 무엇이
  // 이 판의 정보이고 무엇이 곁들인 말인지가 한 줄에 섞인다. 월드 폭주는 시스템이 여는 판이라 없다.
  const owner = raid.kind === "world" ? undefined
    : raid.summonedByMe ? t("raid.summoner.me") : raid.summonerName ? t("raid.summoner.friend", { name: raid.summonerName }) : undefined;
  if (owner) {
    layer.add(shadowed(scene.add
      .text(width / 2 - slant / 2, top - RAID_LAYER_OWNER.up, owner, textStyle({ role: "body", size: RAID_LAYER_OWNER.size, color: COLOR.inkDim }))
      .setOrigin(1, 0.5)));
  }
  const remaining = Math.max(0, raid.attemptsLimit - raid.attemptsUsed);
  layer.add(shadowed(scene.add
    .text(left, text.attemptsY, completed ? t(raid.defeated ? "raid.boss.defeated" : "raid.layer.ended") : t("raid.attempts", { remaining, limit: raid.attemptsLimit }), textStyle({ role: "emphasis", size: 28, color: !completed && remaining > 0 ? COLOR.sortieText : COLOR.inkDim }))
    .setOrigin(0, 0.5)));

  addRewardRow(scene, layer, raid, left, reward, rewardText, settle, handlers);

  // 맨 밑은 참가자 전원이 함께 깎는 남은 체력이다. 잡지 못해도 되는 판이라 게이지가 비지 않은 채
  // 끝나는 날이 있다 — 그래서 수치는 남은 몫이 아니라 **남은 비율**로 짧게 선다.
  const barWidth = width - slant - padding * 2;
  const bar = new HoloBar(scene, 0, height / 2 - hp.up, barWidth, hp.height, { color: RAID_HP_BAR_COLOR, trackAlpha: 0.82, outline: true, ticks: 7 });
  bar.setValue(raid.totalHp > 0 ? raid.remainingHp / raid.totalHp : 0);
  bar.objects.forEach((object) => layer.add(object));
  const percent = raid.totalHp > 0 ? Math.ceil(raid.remainingHp / raid.totalHp * 100) : 0;
  layer.add(shadowed(scene.add
    .text(-barWidth / 2, height / 2 - hp.labelUp, raid.defeated ? t("raid.boss.defeated") : t("raid.boss.remaining"), textStyle({ role: "emphasis", size: 24, color: raid.defeated ? COLOR.accentText : COLOR.inkDim }))
    .setOrigin(0, 0.5)));
  layer.add(shadowed(scene.add
    .text(barWidth / 2, height / 2 - hp.labelUp, t("raid.world.percent", { percent }), textStyle({ role: "display", size: 30, color: COLOR.ink }))
    .setOrigin(1, 0.5), 6));
  return layer;
}

/**
 * 보상 줄 — 증표 액자 하나와 그 오른쪽 두 줄, 끝난 판이면 정산 버튼.
 *
 * 증표를 두 칸으로 가르지 않는다(내 기여 몫·전체 진행 몫·토벌 몫이 모두 같은 증표다). 세 몫의
 * 내역은 판 안의 보상 창이 말하고, 층에서 읽어야 하는 것은 "얼마를 받나" 하나다.
 */
function addRewardRow(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  raid: RaidDto,
  left: number,
  reward: { y: number; size: number },
  rewardText: typeof RAID_LIST.rewardText,
  settle: typeof RAID_LIST.settle,
  handlers: RaidLayerHandlers,
): void {
  const participated = raid.settlement.length > 0;
  const max = RAID_DIFFICULTY[raid.difficulty].settlement;
  const amount = participated ? raid.settlement.reduce((sum, entry) => sum + entry.amount, 0) : max.mine + max.total + max.kill;
  const currency = raid.settlement[0]?.currency ?? "raidSigil";
  addFramedIcon(scene, layer, left + reward.size / 2, reward.y, reward.size, CURRENCY_ICON_BY_WALLET[currency], {
    amount: amount.toLocaleString(), iconAlpha: raid.settled ? 0.4 : 1,
  });
  const textX = left + reward.size + rewardText.gap;
  const label = raid.settled ? t("raid.settle.done")
    : !participated ? t("raid.settle.max")
      : raid.status === "completed" ? t("raid.settle.ready") : t("raid.settle.expected");
  layer.add(scene.add
    .text(textX, reward.y - rewardText.labelUp, label, textStyle({ role: "emphasis", size: 24, color: raid.status === "completed" && participated && !raid.settled ? COLOR.accentText : COLOR.inkDim }))
    .setOrigin(0, 0.5)
    .setShadow(0, 2, "#05070a", 5, false, true));
  layer.add(scene.add
    .text(textX, reward.y + rewardText.valueDown, t("raid.contribution.value", { damage: raid.myDamage.toLocaleString() }), textStyle({ role: "body", size: 23, color: COLOR.ink }))
    .setOrigin(0, 0.5)
    .setShadow(0, 2, "#05070a", 5, false, true));
  if (raid.status !== "completed" || !participated || raid.settled || !handlers.onSettle) return;
  layer.add(new Button(scene, left + settle.fromFrame + settle.width / 2, reward.y, {
    width: settle.width, height: settle.height, label: t("raid.settle.button"), fontSize: 28, variant: "primary",
    onClick: handlers.onSettle,
  }));
}

/**
 * 선택 소환에서 보스를 고르는 층 — 목록 층과 **같은 문법**(오른쪽을 채운 얼굴 띠, 왼쪽의 이름)을
 * 줄여 쓴다. 고르기 전에 누구인지가 얼굴로 읽혀야 한다 — 이름만 늘어놓은 버튼은 보스를 한 번도
 * 본 적 없는 사람에게 아무것도 말하지 않는다.
 */
export function addRaidBossPickLayer(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  relicId: string,
  y: number,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const { width, height, padding } = RAID_BOSS_PICK;
  const slant = RAID_LIST.slant;
  const { art } = RAID_LIST;
  const layer = scene.add.container(0, y);
  parent.add(layer);
  const shape = slantedRect(width, height, slant);
  layer.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.92 }));
  void loadFaceBand(scene, layer, relicId, width + slant, height, shape, false);
  const hit = scene.add.rectangle(0, 0, width - slant, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => layer.setScale(1.03));
  hit.on("pointerout", () => layer.setScale(1));
  hit.on("pointerup", () => { layer.setScale(1); onTap(); });
  layer.add(hit);
  const scrim = scene.add.graphics();
  scrim.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, 0.86, 0, 0.86, 0);
  scrim.fillRect(-width / 2 + slant / 2, -height / 2, width * (art.from + art.fade), height);
  layer.add(scrim);
  layer.add(drawFrameVignette(scene, 0, 0, width, height, { strength: 0.42 }).setMask(shapeClipMask(scene, layer, shape)));
  layer.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.accent, alpha: 0.6, width: 3 }));
  const def = getRelic(relicId);
  const name = scene.add
    .text(-width / 2 + slant / 2 + padding, 0, def.name, textStyle({ role: "display", size: 50 }))
    .setOrigin(0, 0.5)
    .setShadow(0, 4, "#05070a", 8, false, true);
  shrinkTextToWidth(name, width * (art.from + art.fade * 0.5) - padding);
  layer.add(name);
  return layer;
}

/**
 * 오른쪽을 채우는 얼굴 띠를 구워 판 바로 위에 얹는다. 끝난 판은 얼굴을 눌러 둔다.
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
  dimmed: boolean,
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
  if (dimmed) image.setTint(0x6a6f78);
  // 판 면 바로 위(1번)에 선다 — 입력면·어둠·테두리·글은 그 위에 남는다.
  layer.addAt(image, 1);
  scene.tweens.add({ targets: image, alpha: 1, duration: 200 });
}
