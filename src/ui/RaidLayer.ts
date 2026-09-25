import Phaser from "phaser";
import type { RaidDto } from "../api/contracts";
import { RAID_DIFFICULTY, RAID_SUMMON_DIFFICULTIES, type RaidDifficulty } from "../data/raid";
import { formatCurrency } from "../core/formatCurrency";
import { raidKillTicks } from "../core/raid";
import { getRelic } from "../data/relics";
import { t } from "../i18n";
import { computeFaceBandFrame } from "../puppets/anchors";
import { portraitAssetFor, withPuppetTexture } from "../puppets/assets";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { bakeBandTexture } from "./faceTexture";
import { drawFrameVignette, drawLayer, drawShapeEdge, drawShapeOutline, HoloBar, slantedRect } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { shapeClipMask } from "./popupArt";
import { RAID_BOSS_PICK, RAID_DIFFICULTY_PICK, RAID_DIFFICULTY_TONE, RAID_HP_BAR_COLOR, RAID_LAYER_OWNER, RAID_LAYER_TONE, RAID_LIST } from "./raidLayout";
import { addSectionTitle } from "./SectionTitle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { pressIn, pressOut } from "./pressFeedback";

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
 * 층 뒷배경의 세 겹 — 글이 서는 왼쪽의 어둠, 난이도 색, 가장자리 누르기.
 *
 * **셋 다 기운 변을 따른다.** `slantedRect`는 왼쪽 변이 아래 `-w/2 - slant/2`에서 위 `-w/2 + slant/2`로
 * 기운 평행사변형인데, 예전에는 어둠이 곧은 사각형으로 서서 왼쪽 아래 모서리에 밝은 틈이 남았고,
 * 색은 삼각형을 반 칸(`slant/2`) 오른쪽에 그어 변을 따라 색이 빠진 띠가 섰으며, 가장자리 누르기는
 * 판 폭(`w`)만 덮어 기운 두 모서리가 눌리지 않았다. 판이 기울어 있는데 뒷배경만 곧게 서 있었다.
 *
 * 색은 **마스크가 아니라 도형을 잘라** 판 안에 가둔다 — 층마다 기하 마스크를 하나 더 걸면 목록
 * 전체가 스텐실을 그만큼 더 그린다. 가장자리 누르기만 네 변 그라데이션이라 판 모양 마스크를 쓴다.
 */
function paintSlantedBacking(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  shape: readonly number[],
  options: { width: number; height: number; slant: number; tone: number; washAlpha: number },
): void {
  const { width, height, slant, tone, washAlpha } = options;
  const { art } = RAID_LIST;
  const top = -height / 2;
  const bottom = top + height;
  // 기운 왼쪽 변: 아래 끝이 바깥, 위 끝이 안쪽이다. 그 사이 삼각형을 먼저 칠하고 사각형을 잇는다.
  const outer = -width / 2 - slant / 2;
  const inner = -width / 2 + slant / 2;
  const fillLeft = (graphics: Phaser.GameObjects.Graphics, color: number, alpha: number, reach: number): void => {
    graphics.fillStyle(color, alpha);
    graphics.fillTriangle(outer, bottom, inner, top, inner, bottom);
    graphics.fillGradientStyle(color, color, color, color, alpha, 0, alpha, 0);
    graphics.fillRect(inner, top, reach, height);
  };
  // 글이 서는 왼쪽만 어둠이 올라온다. 얼굴 쪽까지 누르면 누구인지가 흐려진다.
  const scrim = scene.add.graphics();
  fillLeft(scrim, COLOR.void, 0.86, width * (art.from + art.fade));
  layer.add(scrim);
  // 난이도의 색이 뒷배경을 은은하게 물들인다 — 글이 서는 왼쪽에서 가장 짙고 얼굴 쪽으로 풀린다.
  const wash = scene.add.graphics();
  fillLeft(wash, tone, washAlpha, width * RAID_LAYER_TONE.washReach - slant / 2);
  layer.add(wash);
  // 가장자리는 살짝만 누른다. 판의 가로 폭은 `w + slant`라 그만큼 덮어야 기운 두 모서리도 눌린다.
  layer.add(drawFrameVignette(scene, 0, 0, width + slant, height, { strength: 0.42 }).setMask(shapeClipMask(scene, layer, shape)));
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
  hit.on("pointerdown", () => pressIn(layer));
  hit.on("pointerout", () => pressOut(layer, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(layer); handlers.onTap(); });
  layer.add(hit);
  // 글이 서는 왼쪽의 어둠과 난이도 색, 가장자리 누르기 — 기운 변을 그대로 따른다.
  const tone = RAID_DIFFICULTY_TONE[raid.difficulty];
  paintSlantedBacking(scene, layer, shape, { width, height, slant, tone, washAlpha: RAID_LAYER_TONE.washAlpha });
  layer.add(drawShapeOutline(scene, 0, 0, shape, { color: raid.kind === "world" ? COLOR.accent : COLOR.panelEdge, alpha: raid.kind === "world" ? 0.72 : 0.5, width: 3 }));
  layer.add(drawShapeEdge(scene, 0, 0, shape, "top", { color: tone, alpha: RAID_LAYER_TONE.edgeAlpha, width: RAID_LAYER_TONE.edgeWidth }));
  if (raid.kind === "world") {
    // 바깥 테두리는 층의 기운 변과 **평행**해야 한다. 같은 `slant`로 높이만 키우면 변의 기울기가
    // 달라져, 두 선의 틈이 위에서는 넓고 아래에서는 좁게 벌어졌다 — 기울기(slant / height)를 지킨다.
    const ringHeight = height + worldRing * 2;
    layer.add(drawShapeOutline(scene, 0, 0, slantedRect(width + worldRing * 2, ringHeight, slant * ringHeight / height), { color: RAID_HP_BAR_COLOR, alpha: 0.9, width: 4 }));
  }

  // 판 윗변에 걸터앉는 제목표가 이 층이 무엇인지 말한다 — 다른 판의 제목과 같은 한 모양이다.
  addSectionTitle(scene, -width / 2 + slant / 2, top - 4, raidTagLabel(raid), { parent: layer });
  const textWidth = width * (art.from + art.fade * 0.5) - padding;
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
  const bar = new HoloBar(scene, 0, height / 2 - hp.up, barWidth, hp.height, { color: RAID_HP_BAR_COLOR, trackAlpha: 0.82, outline: true, ticks: raidKillTicks(raid.kills, 7) });
  bar.setValue(raid.totalHp > 0 ? raid.remainingHp / raid.totalHp : 0);
  bar.objects.forEach((object) => layer.add(object));
  const percent = raid.totalHp > 0 ? Math.ceil(raid.remainingHp / raid.totalHp * 100) : 0;
  const hpLabel = shadowed(scene.add
    .text(-barWidth / 2, height / 2 - hp.labelUp, raid.defeated ? t("raid.boss.defeated") : t("raid.boss.remaining"), textStyle({ role: "emphasis", size: 24, color: raid.defeated ? COLOR.accentText : COLOR.inkDim }))
    .setOrigin(0, 0.5));
  layer.add(hpLabel);
  // 한 칸이 보스 한 번 처치다. 남은 비율만으로는 몇 번 더 잡으면 끝나는지 읽히지 않는다.
  layer.add(shadowed(scene.add
    .text(hpLabel.x + hpLabel.width + 16, height / 2 - hp.labelUp, t("raid.boss.kills", { done: raid.killsDone, kills: raid.kills }), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText }))
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
 * 고르는 창의 층 뼈대 — 목록 층과 **같은 문법**이다. 판 → 얼굴 띠 → 입력면 → 왼쪽 어둠 → 색
 * 물들임 → 가장자리 누르기 → 외곽선 → 윗변의 색 선 → 제목표 순으로 쌓는다.
 *
 * 목록 층과 달리 누르면 **판 전체가 한 뼘 커진다** — 여기서는 층 자체가 고르는 버튼이다.
 */
function addPickLayerBase(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  options: { relicId: string; y: number; width: number; height: number; tone: number; washAlpha: number; tag: string; onTap: () => void },
): Phaser.GameObjects.Container {
  const { width, height, tone, washAlpha } = options;
  const slant = RAID_LIST.slant;
  const layer = scene.add.container(0, options.y);
  parent.add(layer);
  const shape = slantedRect(width, height, slant);
  const top = -height / 2;
  layer.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.92 }));
  void loadFaceBand(scene, layer, options.relicId, width + slant, height, shape, false);
  const hit = scene.add.rectangle(0, 0, width - slant, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(layer));
  hit.on("pointerout", () => pressOut(layer, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(layer); options.onTap(); });
  layer.add(hit);
  // 목록 층과 같은 한 벌이다 — 어둠·색·가장자리 누르기가 기운 변을 그대로 따른다.
  paintSlantedBacking(scene, layer, shape, { width, height, slant, tone, washAlpha });
  layer.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.panelEdge, alpha: 0.5, width: 3 }));
  layer.add(drawShapeEdge(scene, 0, 0, shape, "top", { color: tone, alpha: RAID_LAYER_TONE.edgeAlpha, width: RAID_LAYER_TONE.edgeWidth }));
  addSectionTitle(scene, -width / 2 + slant / 2, top - 4, options.tag, { parent: layer });
  return layer;
}

const shadowed = (object: Phaser.GameObjects.Text, blur = 5): Phaser.GameObjects.Text => object.setShadow(0, 2, "#05070a", blur, false, true);

/**
 * 선택 소환의 첫 창 — **보스 한 마리가 층 하나**다.
 *
 * 얼굴이 오른쪽을 채우고, 왼쪽에 이름·속성·직군과 **소환할 수 있는 레벨 폭**이 선다. 제목표는
 * 그 개체의 종이다 — 이름은 판 안에서 크게 말하므로 같은 말을 두 번 적지 않는다. 난이도는
 * 여기서 고르지 않는다(다음 창의 몫이다). 층 색은 강조색 하나다 — 난이도 색을 여기서 쓰면
 * 아직 고르지 않은 난이도를 말하게 된다.
 */
export function addRaidBossPickLayer(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  relicId: string,
  y: number,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const spec = RAID_BOSS_PICK;
  const def = getRelic(relicId);
  const layer = addPickLayerBase(scene, parent, {
    relicId, y, width: spec.width, height: spec.height, tone: COLOR.accent, washAlpha: RAID_LAYER_TONE.washAlpha, tag: def.origin, onTap,
  });
  const left = -spec.width / 2 + RAID_LIST.slant / 2 + spec.padding;
  const textWidth = spec.width * (RAID_LIST.art.from + RAID_LIST.art.fade * 0.5) - spec.padding;
  const name = shadowed(scene.add.text(left, spec.nameY, def.name, textStyle({ role: "display", size: spec.nameSize })).setOrigin(0, 0.5), 8);
  shrinkTextToWidth(name, textWidth);
  layer.add(name);
  // 속성·직군 — 정보창·적 정보창과 같은 뱃지다. 무엇으로 상대할지가 이름 다음으로 읽혀야 한다.
  const elementX = left + spec.badge.element / 2;
  layer.add(new AffinityBadge(scene, elementX, spec.badgeY, ELEMENT_ICON[def.element], spec.badge.element));
  layer.add(new AffinityBadge(scene, elementX + spec.badge.element / 2 + spec.badge.gap + spec.badge.role / 2, spec.badgeY + 4, ROLE_ICON[def.role], spec.badge.role));
  const levels = RAID_SUMMON_DIFFICULTIES.map((difficulty) => RAID_DIFFICULTY[difficulty].level);
  layer.add(shadowed(scene.add
    .text(left, spec.levelsY, t("raid.pick.levels", { min: Math.min(...levels), max: Math.max(...levels) }), textStyle({ role: "emphasis", size: 28, color: COLOR.accentText }))
    .setOrigin(0, 0.5)));
  return layer;
}

/**
 * 선택 소환의 둘째 창 — **난이도 하나가 층 하나**다. 고른 보스의 얼굴 위를 그 난이도의 색이
 * 짙게 물들인다(쉬움 초록 · 보통 파랑 · 어려움 보라). 목록의 층과 같은 색이라, 연 판이 목록에
 * 섰을 때 여기서 고른 것과 같은 색으로 읽힌다.
 *
 * 왼쪽에는 그 판의 무게가 선다 — 레벨, 함께 깎을 체력, 참여하면 받을 수 있는 최대 정산. 모두
 * 고르는 순간에 비교해야 하는 값이다.
 */
export function addRaidDifficultyPickLayer(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  relicId: string,
  difficulty: RaidDifficulty,
  y: number,
  onTap: () => void,
): Phaser.GameObjects.Container {
  const spec = RAID_DIFFICULTY_PICK;
  const def = getRelic(relicId);
  const table = RAID_DIFFICULTY[difficulty];
  const layer = addPickLayerBase(scene, parent, {
    relicId, y, width: spec.width, height: spec.height, tone: RAID_DIFFICULTY_TONE[difficulty], washAlpha: spec.washAlpha,
    tag: t(`raid.difficulty.${difficulty}`), onTap,
  });
  const left = -spec.width / 2 + RAID_LIST.slant / 2 + spec.padding;
  const textWidth = spec.width * (RAID_LIST.art.from + RAID_LIST.art.fade * 0.5) - spec.padding;
  const name = shadowed(scene.add.text(left, spec.nameY, def.name, textStyle({ role: "display", size: spec.nameSize })).setOrigin(0, 0.5), 8);
  shrinkTextToWidth(name, textWidth);
  layer.add(name);
  layer.add(shadowed(scene.add
    .text(left, spec.levelY, t("raid.world.level", { level: table.level }), textStyle({ role: "emphasis", size: 30, color: COLOR.accentText }))
    .setOrigin(0, 0.5)));
  const { settlement } = table;
  addFramedIcon(scene, layer, left + spec.reward.size / 2, spec.reward.y, spec.reward.size, CURRENCY_ICON_BY_WALLET.raidSigil, {
    amount: (settlement.mine + settlement.total + settlement.kill).toLocaleString(),
  });
  const textX = left + spec.reward.size + spec.rewardText.gap;
  layer.add(shadowed(scene.add
    .text(textX, spec.reward.y - spec.rewardText.labelUp, t("raid.settle.max"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim }))
    .setOrigin(0, 0.5)));
  layer.add(shadowed(scene.add
    .text(textX, spec.reward.y + spec.rewardText.valueDown, t("raid.pick.hp", { hp: formatCurrency(table.bodyHp), kills: table.kills }), textStyle({ role: "body", size: 23, color: COLOR.ink }))
    .setOrigin(0, 0.5)));
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
  // 이미 구운 띠면 기다리지도, 녹여 들이지도 않는다 — 탭을 바꾸거나 목록을 다시 그릴 때마다
  // 얼굴이 빈 층에서 스며 나오면 화면이 새로고침된 것처럼 읽힌다.
  const cacheKey = `${relicId}:${Math.round(width)}:${Math.round(height)}`;
  const cached = BAKED_BAND_KEYS.get(cacheKey);
  if (cached && scene.textures.exists(cached)) {
    const image = scene.add.image(0, 0, cached);
    if (dimmed) image.setTint(0x6a6f78);
    layer.addAt(image, 1);
    return;
  }
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
  if (!key) return;
  BAKED_BAND_KEYS.set(cacheKey, key);
  if (!layer.active) return;
  const image = scene.add.image(0, 0, key).setAlpha(0);
  if (dimmed) image.setTint(0x6a6f78);
  // 판 면 바로 위(1번)에 선다 — 입력면·어둠·테두리·글은 그 위에 남는다.
  layer.addAt(image, 1);
  scene.tweens.add({ targets: image, alpha: 1, duration: 200 });
}

/** 개체·판 크기 → 구운 얼굴 띠 텍스처 키. 구운 캔버스는 전역에 남으므로 씬을 넘어 쓴다. */
const BAKED_BAND_KEYS = new Map<string, string>();
