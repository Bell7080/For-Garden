import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { ClaimNewbieGrowthResponse, GameApi, NewbieGrowthGoalDto, NewbieGrowthMilestoneDto, NewbieGrowthResponse } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { NEWBIE_GROWTH_DAYS, NEWBIE_GROWTH_GOALS, type NewbieGrowthReward } from "../data/newbieGrowth";
import { findItem } from "../data/items";
import { getRelic } from "../data/relics";
import { formatCurrency } from "../core/formatCurrency";
import { motionPolicy } from "../core/settings";
import { logError, reportError } from "../managers/ErrorReporter";
import { notificationManager } from "../managers/NotificationManager";
import { sdAssetFor, spawnPuppet } from "../puppets/assets";
import { session } from "../state/session";
import { BACKGROUND } from "./backgroundAssets";
import { addPopupBackgroundImage } from "./backgrounds";
import { withBusy } from "./BusyOverlay";
import { Button } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer, drawShapeEdge, drawShapeOutline, HoloBar, HOLO, slantedRect, toPoints } from "./holo";
import { remainingDetail } from "./itemExpiry";
import { NotificationDot } from "./NotificationDot";
import { NEWBIE_GROWTH_LAYOUT as L, newbieGrowthDayX, newbieGrowthInitialDay, newbieGrowthMilestoneX, newbieGrowthRowY } from "./newbieGrowthLayout";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { startPuppetHop } from "./puppetHop";
import { RARITY_TONE } from "./rarityMark";
import { RewardFrame, type RewardFrameState } from "./RewardFrame";
import { SR_SELECT_TONE } from "./RelicSelectPicker";
import { openRewardPopup, type RewardPopupItem } from "./RewardPopup";
import { drawSparkle } from "./rouletteWheel";
import { slideTabPage } from "./screenTransition";
import { addSdFootShadow } from "./SdFootShadow";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 날마다의 빛깔 — 줄의 빗금과 날짜 칩의 윗선이 같은 색이라 지금 어느 날의 목표인지 색이 먼저 말한다. */
const DAY_TONE: readonly number[] = [0x8fd3ff, 0x9fe0a8, 0xffd27a, 0xffa98a, 0xd7a8ff, 0x8fe3d6, 0xffc2e0];
/** 가이드의 대표색 — 아침 햇살 같은 살구빛 금색. */
const GLOW = 0xffcf7a;
const SR_TONE = SR_SELECT_TONE;
const GUIDE_SD = "torika";

function hex(color: number): string { return `#${color.toString(16).padStart(6, "0")}`; }

function objectiveText(goal: Pick<NewbieGrowthGoalDto, "metric" | "target">): string {
  const extra = goal.metric === "favoriteChosen" || goal.metric === "guildJoined" || goal.metric === "relicsBrokenThrough";
  const key = (extra ? `newbieGrowth.objective.${goal.metric}` : `achievement.objective.${goal.metric}`) as TextKey;
  return t(key, { value: formatCurrency(goal.target) });
}

/** 보상 칸의 그림 — 재화는 재화 그림, 아이템(SR 렐릭 선택권)은 가방 칸과 같은 그림이다. */
function rewardIcon(reward: Exclude<NewbieGrowthReward, { kind: "fragment" }>): string {
  if (reward.kind === "currency") return CURRENCY_ICON_BY_WALLET[reward.currency];
  const icon = findItem(reward.itemId)?.icon;
  return icon?.kind === "asset" ? icon.key : CURRENCY_ICON_BY_WALLET.gems;
}

/**
 * 신규 연구원 7일 성장 가이드 — 계정이 선 날부터 하루 다섯 목표가 열리고(목표 보상은 치즈케이크 위주, 1일차 첫 칸은 토리카 파편),
 * 받은 목표 수가 마디를 넘으면 화석·호박석, 서른다섯을 다 받으면 SR 렐릭 선택권이 가방에 들어간다(`data/newbieGrowth.ts`).
 *
 * 판의 머리에는 빈 복원실 원화 위에 토리카가 통통 뛰며 서고, 그 아래 마디 길이 얼마나 왔는지를, 날짜 칩이 어느 날을
 * 보는지를 말한다. 목표 줄의 오른쪽 액자를 누르면 그 목표를, 아래 「모두 받기」는 닿은 모든 목표를 받는다 — 업적 창과 같은 손짓이다.
 */
export class NewbieGrowthPopup {
  private data?: NewbieGrowthResponse;
  private body?: Phaser.GameObjects.Container;
  private dynamic?: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private bars: HoloBar[] = [];
  private day = 1;
  private claiming = false;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi = gameApi, private readonly onChanged?: () => void) {}

  async open(): Promise<void> {
    if (this.body) return;
    this.data = await withBusy(this.scene, this.api.getNewbieGrowth());
    if (!this.data.active) return;
    this.day = newbieGrowthInitialDay(this.data.goals, this.data.day);
    this.popups.open({
      width: BASE_WIDTH - L.popup.widthInset, height: BASE_HEIGHT - L.popup.heightInset, title: t("newbieGrowth.title"), titleSize: POPUP_TITLE_SIZE.workboard,
      dim: true, dimAlpha: 0.72, closeOnBackdrop: true, backButton: true,
      onClose: () => { this.destroyDynamic(); this.body = undefined; this.onChanged?.(); },
    }, (body) => {
      this.body = body;
      this.paintHero(body);
      this.render();
    });
  }

  private destroyDynamic(): void {
    this.bars.forEach((bar) => bar.destroy()); this.bars = [];
    this.dynamic?.destroy(); this.dynamic = undefined; this.list = undefined;
  }

  // ── 머리: 원화 · 제목 · 한 줄 · 남은 기간 · 토리카 · 반짝이 ─────────────────────────────

  private paintHero(body: Phaser.GameObjects.Container): void {
    const { hero } = L;
    const shape = chipPoints(hero.width, hero.height, { bevel: { topLeft: 46, topRight: 0, bottomRight: 46, bottomLeft: 0 } });
    const art = addPopupBackgroundImage(this.scene, body, BACKGROUND.recruitWelcome, { x: 0, y: hero.y, width: hero.width, height: hero.height, maskShape: shape, imageOffsetY: 80, overlayStrength: 0 });
    body.once(Phaser.GameObjects.Events.DESTROY, art.destroy);
    // 글이 서는 왼쪽을 어둠으로 누르고 오른쪽(토리카)은 원화가 비치게 둔다.
    const shade = this.scene.add.graphics({ x: 0, y: hero.y });
    const left = -hero.width / 2;
    // 마스크 대신 띠마다 깎인 왼쪽 위 모서리를 따라 윗변을 내린다(닫힌 판이라 입력면과 마스크를 섞지 않는다).
    const bevel = 46;
    const top = -hero.height / 2 + 2;
    const topAt = (x: number): number => top + Math.max(0, bevel - (x - left));
    const strip = (hero.width * 0.72) / 24;
    for (let step = 0; step < 24; step += 1) {
      const x0 = left + strip * step;
      const x1 = x0 + strip + 1;
      shade.fillStyle(0x05070c, 0.78 * (1 - step / 24));
      shade.fillPoints([new Phaser.Geom.Point(x0, topAt(x0)), new Phaser.Geom.Point(x1, topAt(x1)), new Phaser.Geom.Point(x1, hero.height / 2 - 2), new Phaser.Geom.Point(x0, hero.height / 2 - 2)], true);
    }
    body.add(shade);
    body.add(drawShapeOutline(this.scene, 0, hero.y, shape, { color: GLOW, alpha: 0.85, width: 3 }));
    body.add(drawShapeEdge(this.scene, 0, hero.y, shape, "top", { color: 0xffffff, alpha: 0.5, width: 2 }));

    const eyebrow = this.scene.add.text(hero.titleX, hero.titleY - 54, t("newbieGrowth.eyebrow"), textStyle({ role: "emphasis", size: 24, color: hex(GLOW) })).setOrigin(0, 0.5);
    const title = this.scene.add.text(hero.titleX, hero.titleY, t("newbieGrowth.title"), textStyle({ role: "display", size: 54, color: "#fff4dc" })).setOrigin(0, 0.5);
    title.setStroke("#1a0f05", 8).setShadow(0, 5, "#000000", 6, true, true);
    squeezeTextToWidth(title, 560);
    const tagline = this.scene.add.text(hero.titleX, hero.taglineY, t("newbieGrowth.tagline"), textStyle({ role: "body", size: 25, color: COLOR.ink, wrap: 520, lineSpacing: 6 })).setOrigin(0, 0);
    tagline.setShadow(0, 2, "#000000", 4, false, true);
    body.add([eyebrow, title, tagline]);
    this.paintClock(body, hero.titleX, hero.clockY);
    this.paintSparkles(body);
    this.spawnGuide(body);
  }

  /** 남은 기간 — 붉은 빗긴 판에 「종료까지 6일 3시간」. 초마다 다시 적는다. */
  private paintClock(body: Phaser.GameObjects.Container, x: number, y: number): void {
    const endsAt = this.data!.endsAt;
    const chip = this.scene.add.container(x, y);
    const plate = this.scene.add.graphics();
    const label = this.scene.add.text(22, 0, "", textStyle({ role: "emphasis", size: 24, color: "#fff0f0" })).setOrigin(0, 0.5);
    chip.add([plate, label]);
    body.add(chip);
    const write = (): void => {
      if (!label.active) return;
      label.setText(t("newbieGrowth.endsIn", { time: remainingDetail(endsAt) }));
      plate.clear();
      plate.fillStyle(0x7a1f26, 0.94).fillPoints(toPoints(slantedRect(label.width + 44, 44, 10)).map((point) => new Phaser.Geom.Point(point.x + (label.width + 44) / 2, point.y)), true);
    };
    write();
    const timer = this.scene.time.addEvent({ delay: 1000, loop: true, callback: write });
    chip.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
  }

  /** 머리 원화 위로 네 갈래 별이 톡톡 켜졌다 꺼진다 — 자리·박자는 번호에서 정해 난수를 쓰지 않는다. */
  private paintSparkles(body: Phaser.GameObjects.Container): void {
    const spots: readonly [number, number, number][] = [[140, -770, 16], [420, -720, 12], [200, -560, 10], [-60, -760, 9], [370, -560, 14], [460, -780, 9]];
    const motion = motionPolicy(session.settings).nonEssentialDistanceFactor;
    spots.forEach(([x, y, size], index) => {
      const sparkle = this.scene.add.graphics({ x, y });
      drawSparkle(sparkle, 0, 0, size, index % 2 === 0 ? 0xfff2c4 : 0xffffff, 1);
      body.add(sparkle);
      if (motion <= 0) { sparkle.setAlpha(0.7); return; }
      sparkle.setAlpha(0).setScale(0.4);
      this.scene.tweens.add({ targets: sparkle, alpha: 1, scale: 1, duration: 520, delay: 340 * index, hold: 260, yoyo: true, repeat: -1, repeatDelay: 900 + 170 * index, ease: "Sine.InOut" });
    });
  }

  private spawnGuide(body: Phaser.GameObjects.Container): void {
    const { sd } = L.hero;
    body.add(addSdFootShadow(this.scene, sd.x, sd.groundY, sd.height * 0.62));
    void spawnPuppet(this.scene, sdAssetFor(GUIDE_SD), { x: sd.x, groundY: sd.groundY, height: sd.height, depth: 0, flipX: true })
      .then((puppet) => {
        if (!body.active) { puppet.destroy(); return; }
        puppet.disableInteractive();
        body.add(puppet);
        startPuppetHop(this.scene, puppet, 0);
      })
      .catch((error) => logError("puppet.display", "성장 가이드 SD 표시 실패", error));
  }

  // ── 바뀌는 부분: 마디 길 · 날짜 칩 · 목표 줄 · 모두 받기 ─────────────────────────────────

  private render(): void {
    this.destroyDynamic();
    if (!this.body || !this.data) return;
    const dynamic = this.scene.add.container(0, 0);
    this.body.add(dynamic); this.dynamic = dynamic;
    this.paintTrack(dynamic, this.data);
    this.paintDays(dynamic, this.data);
    this.list = this.scene.add.container(0, 0);
    dynamic.add(this.list);
    this.paintGoals(this.list, this.data);
    const claimable = this.data.goals.some(({ state }) => state === "claimable") || this.data.milestones.some(({ state }) => state === "claimable");
    const button = new Button(this.scene, 0, L.claim.y, { width: L.claim.width, height: L.claim.height, label: t("newbieGrowth.claimAll"), variant: "primary", onClick: () => void this.claim() });
    button.setEnabled(claimable);
    dynamic.add(button);
  }

  private paintTrack(parent: Phaser.GameObjects.Container, data: NewbieGrowthResponse): void {
    const { track } = L;
    const total = NEWBIE_GROWTH_GOALS.length;
    const caption = this.scene.add.text(track.barLeft, track.labelY, t("newbieGrowth.progress"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5);
    const value = this.scene.add.text(caption.x + caption.width + 14, track.labelY, `${data.claimedGoals}`, textStyle({ role: "display", size: 36, color: hex(GLOW) })).setOrigin(0, 0.5).setShadow(0, 3, "#000000", 4, false, true);
    const of = this.scene.add.text(value.x + value.width + 8, track.labelY + 3, `/ ${total}`, textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5);
    parent.add([caption, value, of]);
    const width = track.barRight - track.barLeft;
    const bar = new HoloBar(this.scene, track.barLeft + width / 2, track.barY, width, track.barHeight, { color: GLOW, trackAlpha: 0.88, outline: true, ticks: 6, shadow: { offsetX: 3, offsetY: 6, alpha: 0.6 }, glow: { spread: 8, alpha: 0.22 } }).addTo(parent);
    bar.setValue(Math.min(1, data.claimedGoals / total)); this.bars.push(bar);
    // 게이지 끝에서 마지막 큰 액자까지 얇은 길이 잇는다.
    const link = this.scene.add.graphics();
    link.lineStyle(3, data.claimedGoals >= total ? GLOW : 0xffffff, data.claimedGoals >= total ? 0.9 : 0.35);
    link.lineBetween(track.barRight + 6, track.barY, track.finalX - track.finalSize / 2 - 6, track.barY);
    parent.add(link);
    for (const milestone of data.milestones) this.paintMilestone(parent, milestone, total);
  }

  private paintMilestone(parent: Phaser.GameObjects.Container, milestone: NewbieGrowthMilestoneDto, total: number): void {
    const { track } = L;
    const final = milestone.goals >= total;
    const x = newbieGrowthMilestoneX(milestone.goals, total);
    const size = final ? track.finalSize : track.frameSize;
    const y = final ? track.barY + 18 : track.frameY;
    const holder = this.scene.add.container(x, y);
    parent.add(holder);
    if (!final) {
      // 게이지 위의 마디 표식 — 지나온 마디는 채운 마름모, 아직은 빈 마름모.
      const pip = this.scene.add.graphics({ x, y: track.barY });
      const reached = milestone.state !== "progress";
      pip.fillStyle(0x05070a, 0.95).fillPoints(toPoints([0, -15, 15, 0, 0, 15, -15, 0]), true);
      if (reached) pip.fillStyle(GLOW, 1).fillPoints(toPoints([0, -10, 10, 0, 0, 10, -10, 0]), true);
      else pip.lineStyle(2, 0xffffff, 0.7).strokePoints(toPoints([0, -9, 9, 0, 0, 9, -9, 0]), true);
      parent.add(pip);
      parent.add(this.scene.add.text(x, track.barY - 34, `${milestone.goals}`, textStyle({ role: "emphasis", size: 20, color: reached ? hex(GLOW) : COLOR.inkDim })).setOrigin(0.5));
    }
    const claimable = milestone.state === "claimable";
    if (claimable) this.addHalo(holder, size);
    const onClick = claimable ? () => void this.claim([]) : undefined;
    const state: RewardFrameState = milestone.state === "claimed" ? "claimed" : claimable ? "claimable" : "normal";
    // 마지막 큰 액자(SR 렐릭 선택권)는 선택권의 보랏빛 테로 다른 마디와 갈린다.
    if (final) this.addSrGlow(holder, size, state);
    holder.add(this.rewardFrame(milestone.reward, size, state, onClick, final ? SR_TONE : undefined));
    if (milestone.state === "claimed") holder.add(this.checkMark(size * 0.32));
    if (claimable) {
      new NotificationDot(this.scene, holder, { x: size / 2 - 8, y: -size / 2 + 8 });
      if (motionPolicy(session.settings).nonEssentialDistanceFactor > 0) this.scene.tweens.add({ targets: holder, scale: { from: 1, to: 1.08 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  /** 보상 칸 하나 — 재화·아이템은 공용 보상 액자, 파편은 그 렐릭의 얼굴 유리 조각(`FaceFrame`의 `gem`)이다. */
  private rewardFrame(reward: NewbieGrowthReward, size: number, state: RewardFrameState, onClick?: () => void, accent?: number): Phaser.GameObjects.Container {
    if (reward.kind !== "fragment") {
      return new RewardFrame(this.scene, 0, 0, { icon: rewardIcon(reward), amount: reward.amount, size, state, ...(accent !== undefined && state === "normal" ? { color: accent } : {}), onClick });
    }
    const def = getRelic(reward.relicId);
    const tone = RARITY_TONE[def.rarity].chip;
    const holder = this.scene.add.container(0, 0);
    const face = new FaceFrame(this.scene, 0, 0, { portraitAssetId: def.portraitAssetId, size, color: state === "claimable" ? COLOR.missionClaim : state === "claimed" ? 0x68717d : tone, gem: tone, amount: formatCurrency(reward.amount) });
    if (state === "claimed") face.setAlpha(0.45);
    holder.add(face);
    const hit = this.scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: !!onClick });
    hit.on("pointerdown", () => pressIn(holder));
    hit.on("pointerout", () => pressOut(holder, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(holder); onClick?.(); });
    holder.add(hit);
    return holder;
  }

  /** SR 렐릭 선택권 마디 뒤에 번지는 보랏빛 — 가이드의 끝이라 다른 액자보다 한 겹 화려하다. */
  private addSrGlow(holder: Phaser.GameObjects.Container, size: number, state: RewardFrameState): void {
    const glow = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const strength = state === "claimed" ? 0.03 : 0.08;
    for (let ring = 4; ring >= 1; ring -= 1) {
      const extent = size + ring * 10;
      glow.fillStyle(SR_TONE, strength).fillPoints(toPoints(chipPoints(extent, extent, { bevel: { topLeft: extent * 0.22, topRight: 0, bottomRight: extent * 0.22, bottomLeft: 0 } })), true);
    }
    holder.add(glow);
    if (state === "claimed") return;
    const stars = this.scene.add.graphics();
    drawSparkle(stars, -size * 0.52, -size * 0.46, size * 0.09, 0xfff2c4, 1);
    drawSparkle(stars, size * 0.54, -size * 0.3, size * 0.07, 0xffffff, 1);
    holder.add(stars);
  }

  private checkMark(size: number): Phaser.GameObjects.Graphics {
    const mark = this.scene.add.graphics();
    mark.lineStyle(Math.max(4, size * 0.16), 0x05070a, 0.9).strokePoints(toPoints([-size * 0.5, 0, -size * 0.12, size * 0.38, size * 0.55, -size * 0.38]), false);
    mark.lineStyle(Math.max(3, size * 0.1), GLOW, 1).strokePoints(toPoints([-size * 0.5, 0, -size * 0.12, size * 0.38, size * 0.55, -size * 0.38]), false);
    return mark;
  }

  private addHalo(holder: Phaser.GameObjects.Container, size: number): void {
    const halo = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    halo.fillStyle(COLOR.missionClaim, 0.4).fillPoints(toPoints(chipPoints(size + 24, size + 24, { bevel: { topLeft: size * 0.28, topRight: 0, bottomRight: size * 0.28, bottomLeft: 0 } })), true);
    holder.add(halo);
    this.scene.tweens.add({ targets: halo, alpha: { from: 0.3, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  /** 날짜 칩 일곱 — 고른 날은 위로 솟고 금빛 윗선, 다 받은 날은 체크, 아직 안 열린 날은 자물쇠와 열리는 시각. */
  private paintDays(parent: Phaser.GameObjects.Container, data: NewbieGrowthResponse): void {
    const { days } = L;
    for (let day = 1; day <= NEWBIE_GROWTH_DAYS; day += 1) {
      const goals = data.goals.filter((goal) => goal.day === day);
      const selected = day === this.day;
      const locked = day > data.day;
      const done = goals.every(({ state }) => state === "claimed");
      const pending = goals.some(({ state }) => state === "claimable");
      const tone = DAY_TONE[day - 1];
      const chip = this.scene.add.container(newbieGrowthDayX(day), days.y + (selected ? -8 : 0));
      parent.add(chip);
      const height = days.height + (selected ? 16 : 0);
      const shape = chipPoints(days.width, height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
      chip.add(drawLayer(this.scene, 0, 0, shape, { fill: selected ? 0x2a2112 : locked ? 0x0d1015 : 0x161d27, alpha: selected ? 0.96 : 0.86 }));
      chip.add(drawShapeEdge(this.scene, 0, 0, shape, "top", { color: selected ? GLOW : tone, alpha: locked ? 0.3 : selected ? 1 : 0.75, width: selected ? 4 : 2 }));
      const label = this.scene.add.text(0, -14, t("newbieGrowth.day", { day }), textStyle({ role: "display", size: selected ? 28 : 25, color: selected ? "#fff4dc" : locked ? COLOR.inkDim : COLOR.ink })).setOrigin(0.5);
      squeezeTextToWidth(label, days.width - 16);
      chip.add(label);
      const sub = this.scene.add.graphics({ x: 0, y: 22 });
      if (locked) {
        sub.fillStyle(0x8a919b, 0.9).fillRect(-9, -2, 18, 14);
        sub.lineStyle(3, 0x8a919b, 0.9).strokePoints(toPoints([-6, -2, -6, -9, 6, -9, 6, -2]), false);
      } else if (done) {
        sub.lineStyle(5, GLOW, 1).strokePoints(toPoints([-11, 0, -3, 8, 12, -8]), false);
      } else {
        // 그날 받은 목표 수를 작은 마름모 다섯으로.
        goals.forEach((goal, index) => {
          const px = (index - 2) * 17;
          if (goal.state === "claimed") sub.fillStyle(tone, 1).fillPoints(toPoints([px, -6, px + 6, 0, px, 6, px - 6, 0]), true);
          else if (goal.state === "claimable") sub.fillStyle(GLOW, 1).fillPoints(toPoints([px, -6, px + 6, 0, px, 6, px - 6, 0]), true);
          else sub.lineStyle(2, 0xffffff, 0.5).strokePoints(toPoints([px, -5, px + 5, 0, px, 5, px - 5, 0]), true);
        });
      }
      chip.add(sub);
      if (pending && !selected) new NotificationDot(this.scene, chip, { x: days.width / 2 - 12, y: -height / 2 + 10 });
      chip.setSize(days.width, height).setInteractive({ useHandCursor: true });
      chip.on("pointerdown", () => pressIn(chip));
      chip.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
      chip.on("pointerup", () => { pressOut(chip); this.select(day); });
    }
  }

  private select(day: number): void {
    if (day === this.day) return;
    const from = this.day;
    this.day = day;
    this.render();
    if (this.list) slideTabPage(this.scene, [this.list], from - 1, day - 1);
  }

  private paintGoals(parent: Phaser.GameObjects.Container, data: NewbieGrowthResponse): void {
    const goals = data.goals.filter((goal) => goal.day === this.day);
    const locked = this.day > data.day;
    goals.forEach((goal, index) => this.paintGoal(parent, goal, index, locked));
    if (locked && data.nextDayAt) {
      // 아직 안 열린 날 — 목표는 미리 보이되 가라앉고, 가운데에 열리는 때를 단다.
      const opensAt = new Date(Date.parse(data.nextDayAt) + (this.day - data.day - 1) * 86_400_000).toISOString();
      const y = (newbieGrowthRowY(0) + newbieGrowthRowY(goals.length - 1)) / 2;
      const banner = this.scene.add.container(0, y);
      const text = this.scene.add.text(0, 0, t("newbieGrowth.dayOpensIn", { time: remainingDetail(opensAt) }), textStyle({ role: "display", size: 34, color: "#fff4dc" })).setOrigin(0.5).setStroke("#05070a", 8);
      const plateShape = chipPoints(text.width + 120, 92, { bevel: { topLeft: 24, topRight: 0, bottomRight: 24, bottomLeft: 0 } });
      banner.add(drawLayer(this.scene, 0, 0, plateShape, { fill: 0x0b0e14, alpha: 0.94 }));
      banner.add(drawShapeEdge(this.scene, 0, 0, plateShape, "top", { color: DAY_TONE[this.day - 1], alpha: 0.9, width: 3 }));
      banner.add(text);
      parent.add(banner);
    }
  }

  /** 목표 한 줄 — 왼쪽 빗금(그날 색) · 번호 · 목표 · 게이지 · 오른쪽 젬 액자. 받은 줄은 가라앉고 체크가 선다. */
  private paintGoal(parent: Phaser.GameObjects.Container, goal: NewbieGrowthGoalDto, index: number, locked: boolean): void {
    const { list } = L;
    const row = this.scene.add.container(0, newbieGrowthRowY(index));
    parent.add(row);
    const claimed = goal.state === "claimed";
    const claimable = goal.state === "claimable";
    const tone = DAY_TONE[goal.day - 1];
    const halfW = list.cardWidth / 2;
    const shape = chipPoints(list.cardWidth, list.cardHeight, { bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 } });
    row.add(drawLayer(this.scene, 0, 0, shape, { fill: claimed ? 0x12161b : claimable ? 0x2e2412 : 0x18202a, alpha: claimed ? 0.6 : HOLO.glass }));
    if (!claimed) row.add(drawShapeEdge(this.scene, 0, 0, shape, "top", { color: claimable ? COLOR.missionClaim : tone, alpha: claimable ? 0.95 : 0.5, width: claimable ? 3 : 2 }));
    const stripe = this.scene.add.graphics({ x: -halfW + 30, y: 0 });
    stripe.fillStyle(tone, claimed || locked ? 0.35 : 0.95).fillPoints(toPoints(slantedRect(10, list.cardHeight - 46, 8)), true);
    row.add(stripe);

    const count = goal.rewards.length;
    const groupWidth = count * list.rewardSize + (count - 1) * list.rewardGap;
    const rewardX = halfW - 24 - groupWidth / 2;
    const textRight = rewardX - groupWidth / 2 - 26;
    const left = -halfW + 60;
    const ink = claimed || locked ? COLOR.inkDim : COLOR.ink;
    const objective = this.scene.add.text(left, -24, objectiveText(goal), textStyle({ role: "display", size: 30, color: ink })).setOrigin(0, 0.5);
    squeezeTextToWidth(objective, textRight - left);
    row.add(objective);
    const shown = Math.min(goal.value, goal.target);
    const progress = this.scene.add.text(textRight, 30, `${formatCurrency(shown)} / ${formatCurrency(goal.target)}`, textStyle({ role: "emphasis", size: 22, color: claimable ? hex(GLOW) : ink })).setOrigin(1, 0.5);
    const barWidth = Math.max(200, progress.x - progress.width - 20 - left);
    const bar = new HoloBar(this.scene, left + barWidth / 2, 30, barWidth, 18, { color: claimable || claimed ? COLOR.missionClaim : tone, trackAlpha: 0.86, outline: true }).addTo(row);
    bar.setValue(locked ? 0 : Math.min(1, goal.value / Math.max(1, goal.target))); this.bars.push(bar);
    row.add(progress);

    const holder = this.scene.add.container(rewardX, 0);
    row.add(holder);
    goal.rewards.forEach((item, index) => {
      const slot = this.scene.add.container(-groupWidth / 2 + list.rewardSize / 2 + index * (list.rewardSize + list.rewardGap), 0);
      holder.add(slot);
      if (claimable) this.addHalo(slot, list.rewardSize);
      const reward = this.rewardFrame(item, list.rewardSize, claimed ? "claimed" : claimable ? "claimable" : "normal", claimable ? () => void this.claim([goal.id]) : undefined);
      if (!claimable && !claimed) reward.setAlpha(locked ? 0.35 : 0.6);
      slot.add(reward);
      if (claimed) slot.add(this.checkMark(list.rewardSize * 0.34));
    });
    if (claimable) {
      new NotificationDot(this.scene, holder, { x: groupWidth / 2 - 8, y: -list.rewardSize / 2 + 8 });
      if (motionPolicy(session.settings).nonEssentialDistanceFactor > 0) this.scene.tweens.add({ targets: holder, scale: { from: 1, to: 1.08 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  // ── 받기 ─────────────────────────────────────────────────────────────────────

  /** `goalIds`를 비우면(`[]`) 목표 없이 열린 마디만, 생략하면 닿은 목표 전부와 그로 열린 마디를 받는다. */
  private async claim(goalIds?: string[]): Promise<void> {
    if (this.claiming) return;
    this.claiming = true;
    try {
      let result: ClaimNewbieGrowthResponse;
      try { result = await withBusy(this.scene, this.api.claimNewbieGrowth(goalIds ? { goalIds } : {})); }
      catch (error) { reportError("newbieGrowth.claim", error); this.data = await this.api.getNewbieGrowth().catch(() => this.data); this.render(); return; }
      this.data = result.growth;
      this.render();
      this.onChanged?.();
      await notificationManager.refresh().catch(() => undefined);
      const items: RewardPopupItem[] = [
        ...result.granted.map(({ currency, amount }) => ({ icon: CURRENCY_ICON_BY_WALLET[currency], amount })),
        ...result.grantedItems.map(({ itemId, amount }) => ({ icon: rewardIcon({ kind: "item", itemId, amount }), amount })),
        ...result.grantedFragments.map(({ relicId, amount }) => ({ icon: "", amount, relicId })),
      ].filter(({ amount }) => amount > 0);
      if (items.length) openRewardPopup(this.scene, this.popups, { title: t("newbieGrowth.rewardTitle"), items });
    } finally {
      this.claiming = false;
    }
  }
}

/** 로비 이벤트 판의 카드가 부르는 입구. 닫힐 때 `onChanged`로 카드의 점을 다시 맞춘다. */
export async function openNewbieGrowthPopup(scene: Phaser.Scene, popups: PopupLayer, onChanged?: () => void): Promise<void> {
  await new NewbieGrowthPopup(scene, popups, gameApi, onChanged).open();
}
