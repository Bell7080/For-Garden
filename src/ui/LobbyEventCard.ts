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
import { NotificationDot } from "./NotificationDot";
import { ATTENDANCE_CARD_ART, ATTENDANCE_CAST, ATTENDANCE_TONE } from "./attendanceStyle";
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
  /** 제목과 그 아래 한 줄(부제·진행 마름모)의 높이 — 카드 윗변에서 잰다. */
  titleY: 62,
  lineY: 112,
  /**
   * 남은 기간 시계 — 상점 리필 시계와 같은 굵은 붉은 `D00:HH:MM:SS`. **모든 카드에서 같은 자리**(글 줄 맨 아래
   * 왼쪽)에 선다 — SD는 글의 반대쪽에 서므로 시계와 겹치지 않는다. 초마다 갈아 끼운다.
   */
  clock: { size: 32, inset: 30 },
  /** 기한이 없는 출석 줄의 「기한 없음!」 — 기울기(도)·튀는 높이·반짝이 크기. */
  noDeadline: { angle: -4, bob: 4, sparkle: 11 },
  /** 원화 위 글 쪽 어둠 — 왼쪽 끝 진하기·덮는 폭(카드 폭 비율)·겹 수. */
  veil: { alpha: 0.8, span: 0.62, bands: 10 },
  /** SD는 출격판 칸과 같은 자리 규칙을 쓰되 한 뼘 작게 세운다(출격 스토리 칸과 같은 배율). */
  sdScale: 0.9,
  /** 출석 카드의 진행 마름모 줄(부제 자리). */
  pips: { gap: 30, half: 9, labelSize: 22 },
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
 * **카드 자체가 버튼이다** — 무역처럼 줄 끝에 「들어가기」를 세우지 않는다. **모든 카드가 한 양식이다**
 * (`paintStandard` — 원화 뒷배경 · 왼쪽 빗금 · 제목 · 한 줄 · 붉은 기간 시계 · 오른쪽 SD). SD는 출격판과 같이 몸은
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

    // 그림자는 카드를 바깥으로 민 같은 실루엣이다 — 깎임을 그대로 두고 상자만 키우면 깎인 두 모서리에서 그림자가
    // 카드의 빗변 밖으로 뿔처럼 삐져나온다. 45° 빗변을 d만큼 밀면 깎임은 (2 − √2)·d 늘어난다(키운 폭은 2d).
    for (const { grow, offsetY, alpha } of CARD.shadow) {
      const grown = bevel + grow * (1 - Math.SQRT1_2);
      this.add(drawLayer(scene, 0, offsetY, chipPoints(width + grow, height + grow, { bevel: { topLeft: grown, topRight: 0, bottomRight: grown, bottomLeft: 0 } }), { fill: 0x000000, alpha, shadow: false }));
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

  setActionRequired(visible: boolean): void { this.setDot(visible); }

  private setDot(visible: boolean): void {
    if (visible && !this.dot) this.dot = new NotificationDot(this.scene, this, { x: this.options.width / 2 - 18, y: -this.options.height / 2 + 18 });
    if (!visible && this.dot) { this.dot.destroy(true); this.dot = undefined; }
  }

  /* ── 공용 양식 ───────────────────────────────────────────────────────── */

  /**
   * 모든 이벤트 카드의 한 양식 — 디안 픽업 카드가 기준이다.
   *
   * 뒷배경에 그 이벤트에 어울리는 원화를 깔고(글 쪽은 어둠으로 눌러 읽히게 한다), 왼쪽에 빗금 하나, 위에 큰 제목,
   * 그 아래 한 줄(부제 또는 출석의 진행 마름모), 맨 아래 붉은 기간 시계, 오른쪽에 SD. 카드마다 자리를 다시
   * 정하지 않는다 — 카드가 저마다 다르게 서면 목록이 아니라 광고판 모음으로 읽힌다. 받을 보상 아이콘은 카드에
   * 늘어놓지 않는다(판을 열면 보인다).
   */
  private paintStandard(spec: {
    shape: number[];
    bevel: number;
    accent: number;
    title: string;
    titleColor: string;
    titleStroke: string;
    backdrop?: { key: string; frame?: { zoom: number; offsetX: number; offsetY: number } };
    sd?: { relicId: string; side: "left" | "right"; hop: boolean };
    endsAt?: string | null;
  }): { left: number; lineY: number; textWidth: number } {
    const { scene } = this;
    const { width, height, now } = this.options;
    const { shape, bevel } = spec;
    if (spec.backdrop) {
      const frame = spec.backdrop.frame ?? { zoom: 1, offsetX: 0, offsetY: 0 };
      addPopupBackgroundImage(scene, this, spec.backdrop.key, {
        x: frame.offsetX, y: 0, width: width * frame.zoom, height, imageOffsetY: frame.offsetY,
        maskShape: shape.map((value, index) => (index % 2 === 0 ? value - frame.offsetX : value)),
        imageAlpha: 0.9, overlayStrength: 0.6,
      });
      // 글 쪽 어둠도 카드 실루엣 안에서만 진다 — 네모로 깔면 깎인 왼쪽 위 모서리 밖에 검은 삼각형이 남는다.
      // 다각형에는 그라데이션이 없으므로, 왼쪽부터 점점 좁게 잘라 낸 조각을 같은 알파로 겹쳐 오른쪽으로 옅어지게 한다.
      const veil = scene.add.graphics();
      const bands = CARD.veil.bands;
      veil.fillStyle(0x000000, CARD.veil.alpha / bands);
      for (let index = 1; index <= bands; index += 1) {
        veil.fillPoints(clipLeftOf(shape, -width / 2 + (width * CARD.veil.span * index) / bands), true);
      }
      this.add(veil);
    }
    const left = -width / 2 + CARD.padX;
    this.add(drawLayer(scene, left - CARD.rail.inset, 0, slantedRect(CARD.rail.width, height * 0.6), { fill: spec.accent, alpha: CARD.rail.alpha, shadow: false }));
    // 글은 SD가 서지 않는 쪽 절반 남짓을 쓴다.
    const textWidth = spec.sd ? width * 0.56 : width - CARD.padX * 2;
    const title = scene.add.text(left, -height / 2 + CARD.titleY, spec.title, textStyle({ role: "display", size: CARD.titleSize, color: spec.titleColor }))
      .setOrigin(0, 0.5)
      .setStroke(spec.titleStroke, 8)
      .setShadow(3, 5, "#04060a", 0, true, true);
    shrinkTextToWidth(title, textWidth);
    this.add(title);
    if (spec.endsAt) this.addClock(left, spec.endsAt, now);
    if (spec.sd) this.addSd(spec.sd.relicId, spec.sd.side, shape, bevel, spec.sd.hop);
    return { left, lineY: -height / 2 + CARD.lineY, textWidth };
  }

  /* ── 기간 이벤트 ───────────────────────────────────────────────────────── */

  private paintEvent(shape: number[], bevel: number): void {
    if (this.options.entry.kind !== "event") return;
    const event = this.options.entry.event;
    const { left, lineY, textWidth } = this.paintStandard({
      shape, bevel, accent: COLOR.event, title: t(event.titleKey), titleColor: COLOR.eventText, titleStroke: "#1a1206",
      backdrop: event.backdropKey ? { key: event.backdropKey, frame: event.backdropFrame } : undefined,
      sd: event.sd ? { ...event.sd, hop: false } : undefined,
      endsAt: event.endsAt,
    });
    const subtitle = this.scene.add.text(left, lineY, t(event.subtitleKey), textStyle({ role: "body", size: CARD.subtitleSize, color: COLOR.ink }))
      .setOrigin(0, 0.5)
      .setShadow(2, 3, "#04060a", 0, true, true);
    shrinkTextToWidth(subtitle, textWidth);
    this.add(subtitle);
  }

  /* ── 출석 ───────────────────────────────────────────────────────────────── */

  /** 출석도 같은 양식이다 — 부제 자리에 진행 마름모가 서고, 기한이 있는 줄(정규)만 시계가 선다. */
  private paintAttendance(track: AttendanceTrackDto, shape: number[], bevel: number): void {
    const tone = ATTENDANCE_TONE[track.id];
    const [cast] = ATTENDANCE_CAST[track.id];
    const { left, lineY } = this.paintStandard({
      shape, bevel, accent: tone.color, title: t(ATTENDANCE_TITLE[track.id]), titleColor: tone.text, titleStroke: tone.stroke,
      backdrop: ATTENDANCE_CARD_ART[track.id],
      sd: cast ? { relicId: cast.relicId, side: cast.cardSide ?? cast.side, hop: true } : undefined,
      endsAt: track.endsAt,
    });
    // 기한이 없는 신규 줄은 시계 자리에 「기한 없음!」이 통통 튄다 — 비워 두면 언제 끝나는지 몰라 서두르게 된다.
    if (track.id === "newcomer") this.addNoDeadline(left, tone);
    this.pipRow = this.scene.add.container(left, lineY);
    // 진행 줄은 SD·입력면보다 아래, 원화·어둠보다 위에 선다.
    this.add(this.pipRow);
    this.paintPips(track);
    this.setDot(track.claimableToday);
  }

  /** 진행 마름모 일곱 + 받은 수. 받은 칸은 제 색으로 차고 오늘 받을 칸은 테두리만 밝게 숨 쉰다. */
  private paintPips(track: AttendanceTrackDto): void {
    const row = this.pipRow;
    if (!row) return;
    row.removeAll(true);
    const tone = ATTENDANCE_TONE[track.id];
    const { half, gap } = CARD.pips;
    const label = this.scene.add.text(0, 0, `${track.claimed}/${ATTENDANCE_DAYS}`, textStyle({ role: "emphasis", size: CARD.pips.labelSize, color: COLOR.ink }))
      .setOrigin(0, 0.5)
      .setShadow(2, 3, "#04060a", 0, true, true);
    const pipsWidth = gap * (ATTENDANCE_DAYS - 1);
    for (let index = 0; index < ATTENDANCE_DAYS; index += 1) {
      const filled = index < track.claimed;
      const today = track.claimableToday && index === track.claimed;
      const pip = this.scene.add.graphics({ x: half + index * gap, y: 0 });
      const points = [new Phaser.Geom.Point(0, -half * 1.3), new Phaser.Geom.Point(half, 0), new Phaser.Geom.Point(0, half * 1.3), new Phaser.Geom.Point(-half, 0)];
      pip.fillStyle(0x000000, 0.5).fillPoints(points.map((point) => new Phaser.Geom.Point(point.x + 2, point.y + 3)), true);
      pip.fillStyle(filled ? tone.color : 0x05070a, filled ? 1 : 0.7).fillPoints(points, true);
      pip.lineStyle(2, tone.color, today ? 1 : filled ? 0 : 0.45).strokePoints(points, true);
      row.add(pip);
      if (today && motionPolicy(session.settings).nonEssentialRepeatFactor > 0) {
        this.scene.tweens.add({ targets: pip, scale: 1.35, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
    }
    label.setX(half * 2 + pipsWidth + 22);
    row.add(label);
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

  /** 시계 자리의 「기한 없음!」 — 줄 색 글자를 살짝 기울여 세우고 천천히 통통 튀게 한다. */
  private addNoDeadline(x: number, tone: { color: number; text: string; stroke: string }): void {
    const { scene } = this;
    const y = this.options.height / 2 - CARD.clock.inset;
    const label = scene.add.text(x, y, t("event.attendance.noDeadline"), textStyle({ role: "display", size: CARD.clock.size, color: tone.text }))
      .setOrigin(0, 0.5)
      .setAngle(CARD.noDeadline.angle)
      .setStroke(tone.stroke, 7)
      .setShadow(2, 4, "#000000", 0, true, true);
    this.add(label);
    // 글 끝에 같은 색 마름모 둘이 반짝인다.
    const sparkles = [0, 1].map((index) => {
      const size = CARD.noDeadline.sparkle * (index === 0 ? 1 : 0.62);
      const spark = scene.add.graphics({ x: x + label.displayWidth + 14 + index * 22, y: y - 12 + index * 18 });
      spark.fillStyle(tone.color, 1).fillPoints([
        new Phaser.Geom.Point(0, -size), new Phaser.Geom.Point(size * 0.42, 0), new Phaser.Geom.Point(0, size), new Phaser.Geom.Point(-size * 0.42, 0),
      ], true);
      this.add(spark);
      return spark;
    });
    if (motionPolicy(session.settings).nonEssentialRepeatFactor <= 0) return;
    scene.tweens.add({ targets: label, y: y - CARD.noDeadline.bob, duration: 640, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    sparkles.forEach((spark, index) => {
      scene.tweens.add({ targets: spark, scale: 0.4, alpha: 0.5, duration: 520, delay: index * 260, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
  }

  /** SD 한 기를 칸에 세운다(자리·마스크는 `spawnEventCardSd`). 카드의 자식이라 판과 함께 떠오르고 함께 사라진다. */
  private addSd(relicId: string, side: "left" | "right", shape: number[], bevel: number, hop: boolean): void {
    const { scene } = this;
    const { width, height } = this.options;
    void spawnEventCardSd(scene, this, relicId, side, { width, height, shape, bevel, scale: CARD.sdScale })
      .then((puppet) => {
        if (!this.active) { puppet.destroy(); return; }
        // 입력면과 빨간 점보다 아래, 원화·글보다 위에 선다.
        const hitIndex = this.list.findIndex((child) => child instanceof Phaser.GameObjects.Rectangle && child.input);
        this.addAt(puppet, hitIndex >= 0 ? hitIndex : this.list.length);
        if (hop) this.hops.push(startPuppetHop(scene, puppet, 1));
      })
      .catch(() => undefined);
  }
}

/** 다각형(평평한 [x, y, …])에서 `x` 왼쪽 부분만 남긴다 — 볼록한 카드 실루엣을 세로선 하나로 자르는 반평면 자르기. */
function clipLeftOf(shape: readonly number[], limit: number): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let index = 0; index < shape.length; index += 2) points.push(new Phaser.Geom.Point(shape[index], shape[index + 1]));
  const out: Phaser.Geom.Point[] = [];
  points.forEach((current, index) => {
    const next = points[(index + 1) % points.length];
    const inside = current.x <= limit;
    if (inside) out.push(current);
    if (inside !== (next.x <= limit)) {
      const ratio = (limit - current.x) / (next.x - current.x);
      out.push(new Phaser.Geom.Point(limit, current.y + (next.y - current.y) * ratio));
    }
  });
  return out;
}
