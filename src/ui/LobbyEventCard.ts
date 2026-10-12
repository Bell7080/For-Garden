import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { AttendanceTrackDto } from "../api/contracts";
import { ATTENDANCE_DAYS } from "../core/attendance";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import type { LobbyEventEntry } from "./lobbyEventModel";
import { formatDayCountdown } from "../core/formatCountdown";
import { addPopupBackgroundImage } from "./backgrounds";
import { spawnEventCardSd } from "./eventCardSd";
import { pressIn, pressOut } from "./pressFeedback";
import { startPuppetHop } from "./puppetHop";
import { addFramedIcon } from "./itemFrame";
import { rewardDtoTexture } from "./rewardDtoIcon";
import { sortRewardItems } from "./rewardOrder";
import { NotificationDot } from "./NotificationDot";
import { ATTENDANCE_CAST, ATTENDANCE_PILE, ATTENDANCE_SPARKLES, ATTENDANCE_TONE } from "./attendanceStyle";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/** 카드 한 장의 겹과 자리. 무역 전시장 카드와 같은 문법(뒤로 번지는 어둠 · 윗변 강조선 · 왼쪽 빗금)이다. */
const CARD = {
  bevel: 0.16,
  fill: 0x16140d,
  fillAlpha: 0.94,
  shadow: [{ grow: 14, offsetY: 10, alpha: 0.34 }, { grow: 30, offsetY: 20, alpha: 0.18 }],
  glow: { strength: 0.26, height: 0.6 },
  padX: 40,
  rail: { width: 10, inset: 16, alpha: 0.9 },
  titleSize: 40,
  subtitleSize: 26,
  /**
   * 남은 기간 시계 — 상점 리필 시계와 같은 굵은 붉은 `D00:HH:MM:SS`. **모든 카드에서 같은 자리**(글 줄 맨 아래
   * 왼쪽)에 선다 — SD는 글의 반대쪽에 서므로 시계와 겹치지 않는다. 초마다 갈아 끼운다.
   */
  clock: { size: 32, inset: 30 },
  /** SD는 출격판 칸과 같은 자리 규칙을 쓰되 한 뼘 작게 세운다(출격 스토리 칸과 같은 배율). */
  sdScale: 0.9,
  /** 출석 카드의 진행 마름모 줄. 신규 카드는 둘 사이 좁은 가운데에 서므로 한 뼘 촘촘하다. */
  pips: { gap: 30, half: 9, lavishGap: 24, labelSize: 22, lavishLabelSize: 20 },
  /**
   * 신규 출석 카드 — 둘이 좌우 끝에 붙어 서고(한 뼘 작게) 제목·진행 줄·보상 더미가 그 사이에 선다. 둘을 출격판 자리
   * (`inset` 168)에 세우면 몸이 가운데 제목과 진행 줄을 덮는다.
   */
  lavish: { sdInset: 104, sdScale: 0.8, textWidth: 330, pileY: 50 },
  /** 정규 출석 카드의 보상 한 줄 높이 — 진행 줄과 맨 아래 시계 사이. */
  regularRewardY: 22,
} as const;

const ATTENDANCE_TITLE: Readonly<Record<AttendanceTrackDto["id"], TextKey>> = {
  newcomer: "event.attendance.newcomer.title",
  regular: "event.attendance.regular.title",
};

export interface LobbyEventCardOptions {
  width: number;
  height: number;
  entry: LobbyEventEntry;
  now: number;
  onClick: () => void;
}

/**
 * 로비 이벤트 판의 한 장.
 *
 * **카드 자체가 버튼이다** — 무역처럼 줄 끝에 「들어가기」를 세우지 않는다. 카드마다 그 이벤트에서 얻는 것으로
 * 꾸민다: 픽업은 그 개체의 모집 원화와 SD가, 출석은 뛰노는 SD와 받을 보상이 선다. SD는 출격판과 같이 몸은
 * 칸 안에 갇히고 머리만 윗변 밖으로 빠져나온다.
 */
export class LobbyEventCard extends Phaser.GameObjects.Container {
  private dot?: NotificationDot;
  private pipRow?: Phaser.GameObjects.Container;
  private readonly hops: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: LobbyEventCardOptions) {
    super(scene, x, y);
    const { width, height, entry } = options;
    const bevel = Math.min(width, height) * CARD.bevel;
    const cut = { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 };
    const shape = chipPoints(width, height, { bevel: cut });
    const tone = entry.kind === "attendance" ? ATTENDANCE_TONE[entry.track.id] : undefined;
    const accent = tone?.color ?? COLOR.event;

    for (const { grow, offsetY, alpha } of CARD.shadow) {
      this.add(drawLayer(scene, 0, offsetY, chipPoints(width + grow, height + grow, { bevel: cut }), { fill: 0x000000, alpha, shadow: false }));
    }
    this.add(drawLayer(scene, 0, 0, shape, {
      fill: tone?.fill ?? CARD.fill, alpha: CARD.fillAlpha, sheen: 0.05,
      glow: { color: accent, strength: CARD.glow.strength, height: CARD.glow.height },
      edge: accent, edgeAlpha: 0.9, edgeWidth: 3,
    }));

    if (entry.kind === "event") this.paintEvent(shape, bevel);
    else this.paintAttendance(entry.track, shape, bevel);

    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(this));
    hit.on("pointerout", () => pressOut(this, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(this); options.onClick(); });
    this.add(hit);
    this.setSize(width, height);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.hops.forEach((tween) => tween.remove()));
  }

  /** 출석을 받은 뒤 판을 다시 세우지 않고 빨간 점과 진행 마름모만 갈아 끼운다. */
  setAttendance(track: AttendanceTrackDto): void {
    if (this.options.entry.kind !== "attendance") return;
    this.setDot(track.claimableToday);
    this.paintPips(track);
  }

  private setDot(visible: boolean): void {
    if (visible && !this.dot) this.dot = new NotificationDot(this.scene, this, { x: this.options.width / 2 - 18, y: -this.options.height / 2 + 18 });
    if (!visible && this.dot) { this.dot.destroy(true); this.dot = undefined; }
  }

  /* ── 기간 이벤트 ───────────────────────────────────────────────────────── */

  private paintEvent(shape: number[], bevel: number): void {
    if (this.options.entry.kind !== "event") return;
    const { scene } = this;
    const { width, height, entry, now } = this.options;
    const event = entry.event;
    const sdSide = event.sd?.side;
    // 이벤트에 어울리는 원화가 있으면 카드 뒷배경으로 깐다. 글이 서는 쪽은 어둡게 눌러 읽히게 하고 원화는
    // 반대쪽에서 드러난다. 판 실루엣과 같은 도형으로 잘라 깎인 모서리 밖으로 새지 않는다.
    if (event.backdropKey) {
      const frame = event.backdropFrame ?? { zoom: 1, offsetX: 0, offsetY: 0 };
      addPopupBackgroundImage(scene, this, event.backdropKey, {
        x: frame.offsetX, y: 0, width: width * frame.zoom, height, imageOffsetY: frame.offsetY,
        maskShape: shape.map((value, index) => (index % 2 === 0 ? value - frame.offsetX : value)),
        imageAlpha: 0.9, overlayStrength: 0.6,
      });
      const veil = scene.add.graphics();
      veil.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.8, 0, 0.8, 0);
      veil.fillRect(-width / 2, -height / 2, width * 0.62, height);
      this.add(veil);
    }
    const left = -width / 2 + CARD.padX;
    this.add(drawLayer(scene, left - CARD.rail.inset, 0, slantedRect(CARD.rail.width, height * 0.6), { fill: COLOR.event, alpha: CARD.rail.alpha, shadow: false }));
    // 글은 SD가 서지 않는 쪽 절반 남짓을 쓴다.
    const textWidth = sdSide ? width * 0.56 : width - CARD.padX * 2;
    const title = scene.add.text(left, -height / 2 + 62, t(event.titleKey), textStyle({ role: "display", size: CARD.titleSize, color: COLOR.eventText }))
      .setOrigin(0, 0.5)
      .setStroke("#1a1206", 8)
      .setShadow(3, 5, "#04060a", 0, true, true);
    shrinkTextToWidth(title, textWidth);
    this.add(title);
    const subtitle = scene.add.text(left, -height / 2 + 112, t(event.subtitleKey), textStyle({ role: "body", size: CARD.subtitleSize, color: COLOR.ink }))
      .setOrigin(0, 0.5)
      .setShadow(2, 3, "#04060a", 0, true, true);
    shrinkTextToWidth(subtitle, textWidth);
    this.add(subtitle);

    this.addClock(left, event.endsAt, now);

    if (event.sd) this.addSd(event.sd.relicId, event.sd.side, shape, bevel, { hop: false });
  }

  /* ── 출석 ───────────────────────────────────────────────────────────────── */

  private paintAttendance(track: AttendanceTrackDto, shape: number[], bevel: number): void {
    const { scene } = this;
    const { width, height } = this.options;
    const tone = ATTENDANCE_TONE[track.id];
    const lavish = track.id === "newcomer";
    // 출석 카드의 바닥은 제 색으로 아래에서 은은하게 물든다 — 신규는 더 짙게.
    const wash = scene.add.graphics();
    wash.fillGradientStyle(tone.deep, tone.deep, tone.deep, tone.deep, 0, 0, lavish ? 0.55 : 0.36, lavish ? 0.55 : 0.36);
    wash.fillPoints(shape.reduce<Phaser.Geom.Point[]>((points, value, index) => (index % 2 === 0 ? [...points, new Phaser.Geom.Point(value, shape[index + 1])] : points), []), true);
    this.add(wash);

    // 신규: 가운데 제목 + 수북한 보상 더미, 좌우로 둘이 뛴다(기한이 없어 시계가 없다).
    // 정규: 기간 이벤트와 같이 글이 왼쪽, 토리카가 오른쪽에 혼자 서고 글 줄 맨 아래에 붉은 시계가 선다.
    const centerX = lavish ? 0 : -width / 2 + CARD.padX;
    const textOriginX = lavish ? 0.5 : 0;
    const textWidth = lavish ? CARD.lavish.textWidth : width * 0.56;
    const title = scene.add.text(centerX, -height / 2 + (lavish ? 50 : 46), t(ATTENDANCE_TITLE[track.id]), textStyle({ role: "display", size: lavish ? 42 : 38, color: tone.text }))
      .setOrigin(textOriginX, 0.5)
      .setStroke(tone.stroke, 9)
      .setShadow(3, 5, "#04060a", 0, true, true);
    shrinkTextToWidth(title, textWidth);
    this.add(title);

    this.pipRow = scene.add.container(centerX, -height / 2 + (lavish ? 94 : 88));
    this.add(this.pipRow);
    this.paintPips(track);

    const textures = [...new Set(track.days.map(rewardDtoTexture).filter(Boolean))];
    const ordered = sortRewardItems(textures.map((icon) => ({ icon }))).map(({ icon }) => icon as string);
    if (lavish) this.addRewardPile(ordered, tone.color, 0, CARD.lavish.pileY);
    else this.addRewardRow(ordered, centerX, CARD.regularRewardY, textWidth);
    if (track.endsAt) this.addClock(centerX, track.endsAt, this.options.now);

    ATTENDANCE_CAST[track.id].forEach((cast, index) => this.addSd(cast.relicId, cast.cardSide ?? cast.side, shape, bevel, { hop: true, index: lavish ? index : 1, lavish }));
    this.setDot(track.claimableToday);
  }

  /** 진행 마름모 일곱 + 남은 기간. 받은 칸은 제 색으로 차고 오늘 받을 칸은 테두리만 밝게 선다. */
  private paintPips(track: AttendanceTrackDto): void {
    const row = this.pipRow;
    if (!row) return;
    row.removeAll(true);
    const tone = ATTENDANCE_TONE[track.id];
    const lavish = track.id === "newcomer";
    const { half } = CARD.pips;
    const gap = lavish ? CARD.pips.lavishGap : CARD.pips.gap;
    // 남은 기간은 붉은 시계가 따로 말한다 — 여기는 받은 수만.
    const label = this.scene.add.text(0, 0, `${track.claimed}/${ATTENDANCE_DAYS}`, textStyle({ role: "emphasis", size: lavish ? CARD.pips.lavishLabelSize : CARD.pips.labelSize, color: COLOR.ink }))
      .setOrigin(0, 0.5)
      .setShadow(2, 3, "#04060a", 0, true, true);
    const pipsWidth = gap * (ATTENDANCE_DAYS - 1);
    const total = pipsWidth + half + 22 + label.width;
    const start = lavish ? -total / 2 + half : half;
    for (let index = 0; index < ATTENDANCE_DAYS; index += 1) {
      const filled = index < track.claimed;
      const today = track.claimableToday && index === track.claimed;
      const pip = this.scene.add.graphics({ x: start + index * gap, y: 0 });
      const points = [new Phaser.Geom.Point(0, -half * 1.3), new Phaser.Geom.Point(half, 0), new Phaser.Geom.Point(0, half * 1.3), new Phaser.Geom.Point(-half, 0)];
      pip.fillStyle(0x000000, 0.5).fillPoints(points.map((point) => new Phaser.Geom.Point(point.x + 2, point.y + 3)), true);
      pip.fillStyle(filled ? tone.color : 0x05070a, filled ? 1 : 0.7).fillPoints(points, true);
      pip.lineStyle(2, tone.color, today ? 1 : filled ? 0 : 0.45).strokePoints(points, true);
      row.add(pip);
      if (today && motionPolicy(session.settings).nonEssentialRepeatFactor > 0) {
        this.scene.tweens.add({ targets: pip, scale: 1.35, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    label.setX(start + pipsWidth + half + 22);
    row.add(label);
  }

  /** 신규 카드 가운데의 수북한 보상 더미 — 액자 없이 그림과 검은 복제 그림자, 뒤에 깔리는 마름모 빛, 반짝임. */
  private addRewardPile(textures: readonly string[], color: number, x: number, y: number): void {
    const { scene } = this;
    const pile = scene.add.container(x, y);
    // 뒤로 깔리는 빛은 납작한 마름모 세 겹이다(동그라미·밝아지는 합성을 쓰지 않는다).
    const glow = scene.add.graphics();
    [{ w: 170, h: 40, a: 0.16 }, { w: 124, h: 30, a: 0.2 }, { w: 80, h: 20, a: 0.26 }].forEach(({ w, h, a }) => {
      glow.fillStyle(color, a).fillPoints([new Phaser.Geom.Point(0, 14 - h), new Phaser.Geom.Point(w, 14), new Phaser.Geom.Point(0, 14 + h), new Phaser.Geom.Point(-w, 14)], true);
    });
    pile.add(glow);
    ATTENDANCE_PILE.forEach((spot, index) => {
      const key = textures[index];
      if (!key || !scene.textures.exists(key)) return;
      const shadow = scene.add.image(spot.x + 5, spot.y + 7, key).setTint(0x05070a).setAlpha(0.55).setRotation(spot.rotation);
      const image = scene.add.image(spot.x, spot.y, key).setRotation(spot.rotation);
      const fit = (target: Phaser.GameObjects.Image) => target.setScale(spot.size / Math.max(target.width, target.height));
      fit(shadow); fit(image);
      pile.add([shadow, image]);
    });
    const motion = motionPolicy(session.settings);
    ATTENDANCE_SPARKLES.forEach((spark, index) => {
      const star = scene.add.graphics({ x: spark.x, y: spark.y });
      const r = spark.size;
      star.fillStyle(0xfff4c2, 1).fillPoints([
        new Phaser.Geom.Point(0, -r), new Phaser.Geom.Point(r * 0.22, -r * 0.22), new Phaser.Geom.Point(r, 0), new Phaser.Geom.Point(r * 0.22, r * 0.22),
        new Phaser.Geom.Point(0, r), new Phaser.Geom.Point(-r * 0.22, r * 0.22), new Phaser.Geom.Point(-r, 0), new Phaser.Geom.Point(-r * 0.22, -r * 0.22),
      ], true);
      pile.add(star);
      if (motion.nonEssentialRepeatFactor > 0) {
        star.setAlpha(0).setScale(0.4);
        scene.tweens.add({ targets: star, alpha: 1, scale: 1, duration: 360, yoyo: true, delay: index * 310, repeat: -1, repeatDelay: 900 + index * 170, ease: "Sine.easeOut" });
      } else star.setAlpha(0.7);
    });
    this.add(pile);
  }

  /** 정규 카드의 가지런한 보상 한 줄 — 공용 액자에 수 없이 그림만. */
  private addRewardRow(textures: readonly string[], left: number, y: number, width: number): void {
    const size = 60;
    const gap = 12;
    const count = Math.min(textures.length, Math.floor((width + gap) / (size + gap)));
    textures.slice(0, count).forEach((key, index) => {
      addFramedIcon(this.scene, this, left + size / 2 + index * (size + gap), y, size, key, { plain: true });
    });
  }

  /** 남은 기간 시계 — 글 줄 맨 아래 왼쪽(`x`가 글의 왼쪽 끝). 초마다 갈아 끼우고 카드와 함께 멈춘다. */
  private addClock(x: number, endsAt: string, now: number): void {
    const { scene } = this;
    const end = Date.parse(endsAt);
    // 판이 열린 시각(`now`)과 기기 시계의 차이를 그대로 따라간다 — 카드가 받은 기준 시각에서 흐른 만큼만 줄인다.
    const offset = now - Date.now();
    const clock = scene.add.text(x, this.options.height / 2 - CARD.clock.inset, "", textStyle({ role: "display", size: CARD.clock.size, color: COLOR.dangerText }))
      .setOrigin(0, 0.5)
      .setStroke("#04060a", 7)
      .setShadow(2, 4, "#000000", 0, true, true);
    this.add(clock);
    const tick = (): void => { clock.setText(formatDayCountdown(end - (Date.now() + offset))); };
    tick();
    const timer = scene.time.addEvent({ delay: 1000, loop: true, callback: tick });
    this.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
  }

  /** SD 한 기를 칸에 세운다(자리·마스크는 `spawnEventCardSd`). 카드의 자식이라 판과 함께 떠오르고 함께 사라진다. */
  private addSd(relicId: string, side: "left" | "right", shape: number[], bevel: number, motion: { hop: boolean; index?: number; lavish?: boolean }): void {
    const { scene } = this;
    const { width, height } = this.options;
    const lavish = motion.lavish === true;
    void spawnEventCardSd(scene, this, relicId, side, {
      width, height, shape, bevel,
      scale: lavish ? CARD.lavish.sdScale : CARD.sdScale,
      ...(lavish ? { inset: CARD.lavish.sdInset } : {}),
    })
      .then((puppet) => {
        if (!this.active) { puppet.destroy(); return; }
        // 입력면과 빨간 점보다 아래, 원화·글보다 위에 선다.
        const hitIndex = this.list.findIndex((child) => child instanceof Phaser.GameObjects.Rectangle && child.input);
        this.addAt(puppet, hitIndex >= 0 ? hitIndex : this.list.length);
        if (motion.hop) this.hops.push(startPuppetHop(scene, puppet, motion.index ?? 0));
      })
      .catch(() => undefined);
  }
}
