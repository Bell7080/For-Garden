import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { AttendanceTrackDto, ClaimAttendanceResponse, MailRewardDto } from "../api/contracts";
import { ATTENDANCE_DAYS } from "../core/attendance";
import { formatDayCountdown } from "../core/formatCountdown";
import { formatCurrency } from "../core/formatCurrency";
import { motionPolicy } from "../core/settings";
import { attendanceManager } from "../managers/AttendanceManager";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { UI_ICON } from "./icons";
import { addFramedIcon, guideForIcon } from "./itemFrame";
import { type PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { openRewardPopup } from "./RewardPopup";
import { rewardDtoTexture } from "./rewardDtoIcon";
import { addAttendanceStamp, playAttendanceStamp } from "./attendanceStamp";
import { ATTENDANCE_CAST, ATTENDANCE_TONE, attendancePanelLayout, type AttendancePanelLayout } from "./attendanceStyle";
import { spawnEventCardSd } from "./eventCardSd";
import { startPuppetHop } from "./puppetHop";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

const TITLE: Readonly<Record<AttendanceTrackDto["id"], TextKey>> = {
  newcomer: "event.attendance.newcomer.title",
  regular: "event.attendance.regular.title",
};

/** 판의 결. 값은 이 표에만 있다. */
const LOOK = {
  bevel: 0.12,
  /** 머리띠 — 큰 제목, 받은 수, 진행 마름모, 오른쪽 위 붉은 시계, 좌우의 SD. */
  banner: {
    titleSize: 54, titleY: -52, titleWidth: 360,
    countSize: 64, totalSize: 34, countY: 20,
    pips: { y: 80, gap: 30, half: 9 },
    clock: { size: 38, inset: 26, y: 36 },
    sd: { inset: 104, scale: 0.8 },
  },
  /** 격자 뒤에 까는 어두운 받침 — 머리띠·액자와 색이 갈리게 한다. */
  tray: { pad: 28, alpha: 0.34 },
  /** 액자 바닥색은 줄의 짙은 색으로 일차마다 조금씩 더 물든다(첫날 → 일곱째). */
  tileTint: { from: 0.22, step: 0.09 },
  /** 액자 왼쪽 위에 걸친 일차 이름표, 오른쪽 위의 「오늘」, 덤 액자의 광고 표식. */
  dayTag: { size: 30, padX: 14, height: 46, stroke: 6 },
  todayTag: { size: 22, padX: 12, height: 34 },
  adTag: { icon: 40, padX: 10, height: 46 },
  /** 받은 액자를 누르는 어둠, 아직 열리지 않은 덤 액자를 잠그는 어둠과 그 위의 광고 표식. */
  claimedDim: 0.55,
  lockDim: 0.66,
  lockIcon: 0.4,
  stampRatio: 0.86,
  /** 오늘 받을 액자가 숨 쉬는 빛과 배율. */
  pulse: { grow: 26, alpha: 0.55, scale: 1.06, duration: 640 },
  /** 인장이 박힌 뒤 영수증이 뜨기까지. 「쾅」을 한 번 보고 나서 받은 것이 선다. */
  receiptDelayMs: 260,
} as const;

export interface AttendancePopupOptions {
  /** 받은 뒤 바뀐 줄을 알린다 — 이벤트 카드의 빨간 점·진행 마름모가 그 자리에서 바뀐다. */
  onClaimed?: (result: ClaimAttendanceResponse) => void;
  onClosed?: () => void;
}

type TileState = "claimed" | "today" | "ahead" | "missed";

/**
 * 출석 판 — 위에 꾸민 머리띠, 아래에 **보상 액자 일곱이 그대로 놓인다**(왼쪽 3×2 + 오른쪽 일곱째).
 *
 * 칸 판을 깔지 않는다. 액자 하나가 하루이고, 일차는 액자 모서리에 걸친 이름표가 말한다. 받은 액자는 눌린 채 인장이
 * 찍혀 있고 **오늘 받을 액자만 숨 쉰다.** 누르면 서버가 확정한 뒤 인장이 쾅 찍히고 공용 영수증이 받은 것을 세운다.
 * 그 밖의 액자는 누르면 그 재화·아이템의 안내창이 열린다 — 이름을 적지 않아도 무엇인지 그 자리에서 읽힌다.
 * 정규는 액자마다 아래에 **같은 크기의 광고 덤 액자**가 쌓이고, 그날 칸을 받기 전에는 광고 표식으로 잠겨 있다.
 *
 * 머리띠는 이벤트 카드와 같은 문법이다 — 큰 제목, 받은 수, 진행 마름모, SD. 기한이 있는 줄(정규)만 오른쪽 위에
 * 상점과 같은 붉은 시계가 선다.
 */
export function openAttendancePopup(scene: Phaser.Scene, popups: PopupLayer, track: AttendanceTrackDto, options: AttendancePopupOptions = {}): void {
  const tone = ATTENDANCE_TONE[track.id];
  const layout = attendancePanelLayout(Boolean(track.adDays?.length));
  let current = track;
  let busy = false;
  popups.open({
    width: layout.width, height: layout.height,
    dim: true, closeOnBackdrop: true, backButton: true,
    onClose: () => options.onClosed?.(),
  }, (body) => {
    const tray = layout.banner.y + layout.banner.height / 2 + LOOK.tray.pad;
    body.add(drawLayer(scene, 0, (tray + layout.height / 2 - LOOK.tray.pad) / 2, chipPoints(layout.banner.width + LOOK.tray.pad * 2, layout.height / 2 - LOOK.tray.pad - tray, {
      bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 },
    }), { fill: 0x000000, alpha: LOOK.tray.alpha, shadow: false }));

    const banner = addBanner(scene, body, layout, current);
    // 받지 못했을 때만 머리띠 바로 아래에 한 줄 선다 — 조용히 넘기면 눌렀는데 아무 일도 없는 액자가 된다.
    const notice = scene.add.text(0, layout.banner.y + layout.banner.height / 2 + 22, "", textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0.5);
    body.add(notice);
    const grid = scene.add.container(0, 0);
    body.add(grid);

    /** 받은 것을 영수증으로 세운다. 판이 이미 닫혔어도 받은 것은 알린다(장면이 살아 있을 때만). */
    const receipt = (result: ClaimAttendanceResponse, onDone?: () => void): void => {
      if (!scene.sys.isActive()) return;
      const items = result.granted.map((reward) => ({ icon: rewardDtoTexture(reward), amount: reward.amount })).filter(({ icon, amount }) => icon && amount > 0);
      openRewardPopup(scene, popups, { title: t("attendance.reward.title"), items, onConfirm: onDone });
    };

    const claim = (tile: TileHandle, run: () => Promise<ClaimAttendanceResponse | undefined>): void => {
      if (busy) return;
      busy = true;
      notice.setText("");
      void run().then((result) => {
        if (!result) {
          busy = false;
          if (notice.active) notice.setText(t("stamina.adCancelled"));
          return;
        }
        current = result.tracks.find(({ id }) => id === current.id) ?? current;
        options.onClaimed?.(result);
        // 판이 이미 닫혔으면 인장 없이 영수증만 세운다 — 받은 것을 알리지 않으면 받았는지 알 수 없다.
        if (!tile.container.active) { busy = false; receipt(result); return; }
        banner.setProgress(current);
        tile.stopPulse();
        playAttendanceStamp(scene, tile.container, 0, 0, tile.size * LOOK.stampRatio, tone.color, {
          onDone: () => scene.time.delayedCall(LOOK.receiptDelayMs, () => receipt(result, () => {
            busy = false;
            if (grid.active) paint();
          })),
        });
      }).catch(() => {
        busy = false;
        if (notice.active) notice.setText(t("attendance.claimFailed"));
      });
    };

    const paint = (): void => {
      grid.removeAll(true);
      for (const rect of layout.tiles) {
        const index = rect.day - 1;
        const reward = current.days[index];
        const mainState: TileState = index < current.claimed ? "claimed" : current.claimableToday && index === current.claimed ? "today" : "ahead";
        if (reward) {
          const main = addTile(scene, grid, { x: rect.x, y: rect.y, size: rect.size, day: rect.day, reward, state: mainState, kind: "main", track: current });
          if (mainState === "today") main.onTap = () => claim(main, () => attendanceManager.claim(current.id));
        }
        const adReward = current.adDays?.[index];
        if (rect.adY === undefined || !adReward) continue;
        const adState: TileState = current.adClaimed.includes(rect.day) ? "claimed"
          : current.adClaimableToday && rect.day === current.claimed ? "today"
            : index < current.claimed ? "missed" : "ahead";
        const ad = addTile(scene, grid, { x: rect.x, y: rect.adY, size: rect.size, day: rect.day, reward: adReward, state: adState, kind: "ad", track: current });
        if (adState === "today") ad.onTap = () => claim(ad, () => attendanceManager.claimAd());
      }
    };
    paint();
  });
}

/* ── 머리띠 ─────────────────────────────────────────────────────────────── */

interface BannerHandle {
  setProgress: (track: AttendanceTrackDto) => void;
}

/** 꾸민 머리띠 — 줄의 색으로 물든 판 위에 큰 제목 · 받은 수 · 진행 마름모 · (정규) 붉은 시계, 좌우에 뛰는 SD. */
function addBanner(scene: Phaser.Scene, body: Phaser.GameObjects.Container, layout: AttendancePanelLayout, track: AttendanceTrackDto): BannerHandle {
  const tone = ATTENDANCE_TONE[track.id];
  const spec = LOOK.banner;
  const { width, height } = layout.banner;
  const banner = scene.add.container(0, layout.banner.y);
  body.add(banner);
  const bevel = Math.min(width, height) * 0.16;
  const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  banner.add(drawLayer(scene, 0, 0, shape, {
    fill: tone.fill, alpha: 0.96, sheen: 0.05,
    glow: { color: tone.color, strength: 0.32, height: 0.7 },
    edge: tone.color, edgeAlpha: 0.95, edgeWidth: 3,
  }));
  const wash = scene.add.graphics();
  wash.fillGradientStyle(tone.deep, tone.deep, tone.deep, tone.deep, 0, 0, 0.6, 0.6);
  wash.fillPoints(shape.reduce<Phaser.Geom.Point[]>((points, value, index) => (index % 2 === 0 ? [...points, new Phaser.Geom.Point(value, shape[index + 1])] : points), []), true);
  banner.add(wash);

  const title = scene.add.text(0, spec.titleY, t(TITLE[track.id]), textStyle({ role: "display", size: spec.titleSize, color: tone.text }))
    .setOrigin(0.5)
    .setStroke(tone.stroke, 10)
    .setShadow(3, 6, "#04060a", 0, true, true);
  shrinkTextToWidth(title, spec.titleWidth);
  banner.add(title);

  // 받은 수는 큰 숫자 + 작은 분모로 선다 — 「1/7」을 한 크기로 적으면 진행보다 분수가 먼저 읽힌다.
  const count = scene.add.text(0, spec.countY, "", textStyle({ role: "display", size: spec.countSize, color: tone.text })).setOrigin(1, 0.5).setStroke(tone.stroke, 10).setShadow(3, 5, "#04060a", 0, true, true);
  const total = scene.add.text(0, spec.countY + spec.countSize * 0.16, `/${ATTENDANCE_DAYS}`, textStyle({ role: "display", size: spec.totalSize, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#04060a", 7);
  banner.add([count, total]);
  const pips = scene.add.container(0, spec.pips.y);
  banner.add(pips);

  let endsAt: number | undefined;
  let tick = (): void => undefined;
  const setProgress = (next: AttendanceTrackDto): void => {
    endsAt = next.endsAt ? Date.parse(next.endsAt) : undefined;
    tick();
    count.setText(String(next.claimed));
    const span = count.width + total.width;
    count.setX(-span / 2 + count.width);
    total.setX(count.x);
    pips.removeAll(true);
    const { gap, half } = spec.pips;
    for (let index = 0; index < ATTENDANCE_DAYS; index += 1) {
      const filled = index < next.claimed;
      const today = next.claimableToday && index === next.claimed;
      const pip = scene.add.graphics({ x: (index - (ATTENDANCE_DAYS - 1) / 2) * gap, y: 0 });
      const points = [new Phaser.Geom.Point(0, -half * 1.3), new Phaser.Geom.Point(half, 0), new Phaser.Geom.Point(0, half * 1.3), new Phaser.Geom.Point(-half, 0)];
      pip.fillStyle(0x000000, 0.5).fillPoints(points.map((point) => new Phaser.Geom.Point(point.x + 2, point.y + 3)), true);
      pip.fillStyle(filled ? tone.color : 0x05070a, filled ? 1 : 0.7).fillPoints(points, true);
      pip.lineStyle(2, tone.color, today ? 1 : filled ? 0 : 0.45).strokePoints(points, true);
      pips.add(pip);
    }
  };

  // 기한이 있는 줄(정규)만 오른쪽 위에 상점과 같은 굵은 붉은 시계가 선다. 첫 칸을 받아 바퀴가 시작되면 그 자리에서
  // 켜지므로 시계는 늘 세워 두고 기한이 없으면 비운다. 초마다 갈아 끼운다.
  const clock = scene.add.text(width / 2 - spec.clock.inset, -height / 2 + spec.clock.y, "", textStyle({ role: "display", size: spec.clock.size, color: COLOR.dangerText }))
    .setOrigin(1, 0.5)
    .setStroke("#04060a", 8)
    .setShadow(2, 4, "#000000", 0, true, true);
  banner.add(clock);
  tick = (): void => { clock.setText(endsAt === undefined ? "" : formatDayCountdown(endsAt - Date.now())); };
  const timer = scene.time.addEvent({ delay: 1000, loop: true, callback: tick });
  banner.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
  setProgress(track);

  // SD는 이벤트 카드처럼 몸은 띠 안에, 머리만 윗변 밖으로 내민다. 신규는 둘이 좌우에서, 정규는 토리카 혼자 뛴다.
  const hops: Phaser.Tweens.Tween[] = [];
  ATTENDANCE_CAST[track.id].forEach((cast, index) => {
    void spawnEventCardSd(scene, banner, cast.relicId, cast.side, { width, height, shape, bevel, scale: spec.sd.scale, inset: spec.sd.inset })
      .then((puppet) => {
        if (!banner.active) { puppet.destroy(); return; }
        banner.add(puppet);
        hops.push(startPuppetHop(scene, puppet, index));
      })
      .catch(() => undefined);
  });
  banner.once(Phaser.GameObjects.Events.DESTROY, () => hops.forEach((tween) => tween.remove()));
  return { setProgress };
}

/* ── 보상 액자 ──────────────────────────────────────────────────────────── */

interface TileHandle {
  container: Phaser.GameObjects.Container;
  size: number;
  onTap?: () => void;
  stopPulse: () => void;
}

interface TileSpec {
  x: number;
  y: number;
  size: number;
  day: number;
  reward: MailRewardDto;
  state: TileState;
  kind: "main" | "ad";
  track: AttendanceTrackDto;
}

/**
 * 보상 액자 한 장 — 공용 액자(`addFramedIcon`)를 그대로 놓고 모서리에 이름표만 건다. 바닥색은 일차마다 조금씩 더
 * 물들어 판 받침과 갈리고 날마다 결이 다르다. 오늘 받을 액자는 누르면 받고, 나머지는 누르면 안내창이 열린다.
 */
function addTile(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, spec: TileSpec): TileHandle {
  const tone = ATTENDANCE_TONE[spec.track.id];
  const { size, state, kind } = spec;
  const container = scene.add.container(spec.x, spec.y);
  parent.add(container);
  const handle: TileHandle = { container, size, stopPulse: () => undefined };
  const today = state === "today";
  const bevel = size * LOOK.bevel;
  const cut = (grow: number) => ({ topLeft: bevel + grow * 0.35, topRight: 0, bottomRight: bevel + grow * 0.35, bottomLeft: 0 });

  // 오늘 받을 액자만 바깥으로 빛이 번지며 숨 쉰다.
  if (today) {
    const glow = drawLayer(scene, 0, 0, chipPoints(size + LOOK.pulse.grow, size + LOOK.pulse.grow, { bevel: cut(LOOK.pulse.grow) }), { fill: tone.color, alpha: LOOK.pulse.alpha, shadow: false });
    container.add(glow);
    const tween = motionPolicy(session.settings).nonEssentialRepeatFactor > 0
      ? scene.tweens.add({ targets: glow, alpha: 0.12, scaleX: LOOK.pulse.scale, scaleY: LOOK.pulse.scale, duration: LOOK.pulse.duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut" })
      : undefined;
    handle.stopPulse = () => { tween?.remove(); glow.destroy(); };
  }

  const tint = Math.min(1, LOOK.tileTint.from + LOOK.tileTint.step * (spec.day - 1));
  const fill = Phaser.Display.Color.ObjectToColor(Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(tone.fill), Phaser.Display.Color.ValueToColor(tone.deep), 100, Math.round(tint * 100),
  )).color;
  const texture = rewardDtoTexture(spec.reward);
  addFramedIcon(scene, container, 0, 0, size, texture, {
    amount: formatCurrency(spec.reward.amount), color: tone.color, plain: true, fill, fillAlpha: 0.97,
    outlineWidth: today ? 4 : undefined, outlineAlpha: today ? 1 : undefined,
  });

  const shape = chipPoints(size, size, { bevel: cut(0) });
  // 받은·지나간 액자는 눌러 둔다. 아직 열리지 않은 덤 액자는 광고 표식으로 잠근다.
  if (state === "claimed" || state === "missed") container.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: LOOK.claimedDim, shadow: false }));
  if (kind === "ad" && (state === "ahead" || state === "missed")) {
    if (state === "ahead") container.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: LOOK.lockDim, shadow: false }));
    const lock = size * LOOK.lockIcon;
    container.add(scene.add.image(3, 4, UI_ICON.ad).setDisplaySize(lock, lock).setTint(0x000000).setAlpha(0.6));
    container.add(scene.add.image(0, 0, UI_ICON.ad).setDisplaySize(lock, lock).setTint(state === "ahead" ? 0xe8ecf2 : 0x8a8f99).setAlpha(0.92));
  }
  if (state === "claimed") container.add(addAttendanceStamp(scene, 0, 0, size * LOOK.stampRatio, tone.color));

  // 모서리 이름표 — 본 액자는 일차, 덤 액자는 광고 표식. 액자 윗변에 걸쳐 액자가 「그날」로 읽히게 한다.
  const lit = today || spec.day === ATTENDANCE_DAYS;
  if (kind === "main") {
    container.add(addTag(scene, -size / 2 - 8, -size / 2, t("attendance.day", { day: spec.day }), LOOK.dayTag, lit ? tone.color : 0x05070a, lit ? "#05070a" : COLOR.ink, "left"));
  } else {
    container.add(addAdTag(scene, -size / 2 - 8, -size / 2, today ? tone.color : 0x05070a, today ? 0x05070a : 0xe8ecf2));
  }
  if (today) container.add(addTag(scene, size / 2 + 8, -size / 2, t("attendance.today"), LOOK.todayTag, tone.color, "#05070a", "right"));

  const openGuide = guideForIcon(scene, texture);
  const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(container));
  hit.on("pointerout", () => pressOut(container, "normal", { pop: false }));
  hit.on("pointerup", () => {
    pressOut(container);
    if (handle.onTap) handle.onTap();
    else openGuide?.();
  });
  // 받은 뒤에는 그 액자도 안내창을 연다 — 인장이 찍히는 동안만 손을 받지 않는다.
  handle.stopPulse = ((stop) => () => { stop(); handle.onTap = undefined; })(handle.stopPulse);
  container.add(hit);
  return handle;
}

/** 액자 모서리에 걸치는 이름표. 기울인 판 위에 굵은 글자 하나. 판의 아래 변 가운데가 `y`에 온다. */
function addTag(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  spec: { size: number; padX: number; height: number; stroke?: number },
  fill: number,
  color: string,
  anchor: "left" | "right",
): Phaser.GameObjects.Container {
  const tag = scene.add.container(x, y);
  const text = scene.add.text(0, 0, label, textStyle({ role: "display", size: spec.size, color })).setOrigin(0.5);
  // 어두운 판 위의 밝은 글자만 검은 획을 둘러 두껍게 세운다.
  if (spec.stroke && color !== "#05070a") text.setStroke("#04060a", spec.stroke);
  const width = text.width + spec.padX * 2;
  const offset = anchor === "left" ? width / 2 : -width / 2;
  tag.add(drawLayer(scene, offset, 0, chipPoints(width, spec.height, { bevel: { topLeft: 9, topRight: 0, bottomRight: 9, bottomLeft: 0 } }), { fill, alpha: 0.96, shadow: { x: 0, y: 4 } }));
  text.setPosition(offset, 0);
  tag.add(text);
  return tag;
}

/** 덤 액자의 광고 표식 — 일차 이름표와 같은 자리·같은 판에 광고 그림 하나. */
function addAdTag(scene: Phaser.Scene, x: number, y: number, fill: number, tint: number): Phaser.GameObjects.Container {
  const spec = LOOK.adTag;
  const tag = scene.add.container(x, y);
  const width = spec.icon + spec.padX * 2;
  tag.add(drawLayer(scene, width / 2, 0, chipPoints(width, spec.height, { bevel: { topLeft: 9, topRight: 0, bottomRight: 9, bottomLeft: 0 } }), { fill, alpha: 0.96, shadow: { x: 0, y: 4 } }));
  tag.add(scene.add.image(width / 2, 0, UI_ICON.ad).setDisplaySize(spec.icon, spec.icon).setTint(tint));
  return tag;
}
