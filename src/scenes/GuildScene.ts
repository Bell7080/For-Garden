import Phaser from "phaser";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { guildApi } from "../api/guildApi";
import {
  GuildApiError, isGuildErrorCode, type GuildAttendanceState, type GuildMemberView, type GuildMembersResponse,
  type GuildStateResponse, type GuildSummary,
} from "../api/guildContracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import {
  GUILD_ATTENDANCE_CYCLE, GUILD_BADGE_CHANGE_GEMS, GUILD_CREATE_GEMS, GUILD_NAME_MAX, GUILD_NOTICE_MAX,
  guildAttendanceDay, guildCan, guildCanKick, guildLevelProgress, guildPerks, validateGuildName, type GuildJoinMode, type GuildRole,
} from "../core/guild";
import {
  DEFAULT_GUILD_BADGE, GUILD_BADGE_COLOR_IDS, GUILD_BADGE_ICONS, GUILD_BADGE_SHAPES, isGuildBadge, type GuildBadge,
} from "../core/guildBadge";
import { guildGuardElement, guildGuardEndsAt, guildPageEventKey, guildPageHasNews, guildWarNow, type GuildPage } from "../core/guildPages";
import { GUILD_WAR_MIN_MEMBERS, guildWarTotalSlots } from "../core/guildWar";
import { guildAttendanceRace } from "../core/guildRace";
import { isOnline, lastActiveAge } from "../core/social";
import { RELICS } from "../data/relics";
import { setDebugScene } from "../debug";
import { settingsManager } from "../managers/SettingsManager";
import { guildMemberProfileDisplay } from "../state/playerProfile";
import { session } from "../state/session";
import { AffinityBadge } from "../ui/AffinityBadge";
import { ELEMENT_ICON } from "../ui/affinityIcons";
import { addAttendanceStamp, playAttendanceStamp } from "../ui/attendanceStamp";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { withBusy } from "../ui/BusyOverlay";
import { addCategoryTab } from "../ui/CategoryTab";
import { addClippedHit } from "../ui/clippedHit";
import type { ClipRect } from "../ui/clipRect";
import { showContentToast } from "../ui/ContentToast";
import { openCurrencyGuide } from "../ui/currencyGuideEntry";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { addFriendChip, addRowButton, type RowButtonTone } from "../ui/friendsWidgets";
import { addGuildBadge } from "../ui/GuildBadge";
import { openGuildBadgePicker } from "../ui/GuildBadgePicker";
import {
  GUILD_ATTENDANCE as A, GUILD_EDITOR as E, GUILD_EVENT_PAGE as P, GUILD_INFO as I, GUILD_ROW as R, GUILD_SCREEN as S, guildMinScroll,
  guildPageX, guildRowButtonX, guildRowY, guildStampSlot, guildTabX,
} from "../ui/guildLayout";
import { chipPoints, drawLayer, HoloBar, HOLO } from "../ui/holo";
import { addBackButton } from "../ui/IconButton";
import { addFramedIcon } from "../ui/itemFrame";
import { PlayerProfilePopup, type ProfileAction } from "../ui/PlayerProfilePopup";
import { PopupLayer } from "../ui/PopupLayer";
import { pressIn, pressOut } from "../ui/pressFeedback";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { RailButton } from "../ui/RailButton";
import { openRewardPopup, type RewardPopupItem } from "../ui/RewardPopup";
import { playSceneEntrance, slideTabPage, startScene } from "../ui/screenTransition";
import { addSideShopButton } from "../ui/sideShop";
import { squeezeTextToWidth } from "../ui/textFit";
import { TextInputField } from "../ui/TextInputField";
import { TopBar } from "../ui/TopBar";
import { COLOR, textStyle } from "../ui/theme";

type GuildTab = "info" | "members";
const PAGES = [
  { key: "info", labelKey: "guild.page.info" },
  { key: "war", labelKey: "guild.page.war" },
  { key: "guard", labelKey: "guild.page.guard" },
] as const;
const TABS = [
  { key: "info", labelKey: "guild.tab.info" },
  { key: "members", labelKey: "guild.tab.members" },
] as const;

const TAP_SLOP = TAP_DRAG_SLOP;
const FULL_CLIP: ClipRect = { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 };
const BADGE_CHOICES = [
  { labelKey: "guild.badge.shape", field: "shape", values: GUILD_BADGE_SHAPES },
  { labelKey: "guild.badge.shapeColor", field: "shapeColor", values: GUILD_BADGE_COLOR_IDS },
  { labelKey: "guild.badge.icon", field: "icon", values: GUILD_BADGE_ICONS },
  { labelKey: "guild.badge.iconColor", field: "iconColor", values: GUILD_BADGE_COLOR_IDS },
] as const;
const ASSIGNABLE_ROLES = ["vice", "officer", "member"] as const;
const RED_DOT = 0xe5484d;
const ONLINE_COLOR = COLOR.hpFill;
const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
/** 길드 코인의 결 — 상단 줄 칸과 같은 초록빛. */
const COIN_TEXT = "#a8f0c0";

const hmText = (ms: number): string => {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes >= 60 ? t("guild.time.hm", { h: Math.floor(minutes / 60), m: minutes % 60 }) : t("guild.time.m", { m: minutes });
};

/** 출석 한 날의 보상 그림과 수 — 판과 영수증이 같은 표(`GUILD_ATTENDANCE_CYCLE`)를 읽는다. */
function attendanceRewardIcon(day: number): { texture: string; amount: number } {
  const { reward } = guildAttendanceDay(day);
  if (reward.gems) return { texture: CURRENCY_ICON_BY_WALLET.gems, amount: reward.gems };
  if (reward.cheesecake) return { texture: CURRENCY_ICON_BY_WALLET.cheesecake, amount: reward.cheesecake };
  return { texture: CURRENCY_ICON_BY_WALLET.gold, amount: reward.gold ?? 0 };
}

/**
 * 로비의 길드 버튼에서 진입하는 길드 화면. 규칙은 `src/core/guild*.ts`가, 가입·직위·출석 기록은 길드 백엔드(`guildApi`)가,
 * 지갑이 얽힌 네 조작(만들기·뱃지 변경·출석 보상·상점 구매)은 `gameApi`가 맡고 이 화면은 결과를 그리기만 한다.
 *
 * - 길드가 없으면 추천 길드를 훑고 검색·가입·신청, 또는 직접 만든다.
 * - 길드가 있으면 맨 아래 **큰 탭 셋**(정보 · 길드전 · 수호전)이 화면을 가르고, 정보 안에서 **정보 · 멤버** 작은 탭이 갈린다.
 *   길드전·수호전은 판이 바뀌면(시작·끝) 큰 탭에 붉은 점이 선다(`guildPageHasNews`).
 * - 출석은 탭이 아니다. 그날 처음 들어오면 도장판이 떠 오늘 칸에 **쾅** 찍히고 영수증이 뒤따른다(일곱 날을 도는 순환).
 * - 상점·길드 순위는 정보 탭 왼쪽 옆줄의 칩, 다른 길드 찾기·탈퇴는 오른쪽 위 작은 칩이 여는 창에 있다.
 */
export class GuildScene extends Phaser.Scene {
  private state?: GuildStateResponse;
  private members?: GuildMembersResponse;
  private browse: GuildSummary[] = [];
  private query = "";
  private page: GuildPage = "info";
  private tab: GuildTab = "info";
  /** 길드에 있으면서 다른 길드를 둘러보는 중. 큰 탭을 감추고 목록만 세운다. */
  private browsing = false;
  /** 이번 진입에서 출석판을 이미 띄웠는가 — 같은 날 다시 그려도 두 번 뜨지 않는다. */
  private stampChecked = false;
  /** 서버 시각 − 기기 시각. 남은 시간을 매초 다시 적을 때 쓴다. */
  private clockOffset = 0;

  private popups!: PopupLayer;
  private topBar!: TopBar;
  private view!: Phaser.GameObjects.Container;
  private controls!: Phaser.GameObjects.Container;
  private tabRow!: Phaser.GameObjects.Container;
  private ticker?: Phaser.Time.TimerEvent;
  private list?: Phaser.GameObjects.Container;
  private listBottom: number = S.body.bottom;
  private scrollOffset = 0;
  private minScroll = 0;
  private dragging = false;
  private dragLastY = 0;
  private dragMoved = 0;
  private busy = false;

  constructor() { super("guild"); }

  create(): void {
    setDebugScene("guild");
    this.state = undefined; this.members = undefined; this.browse = []; this.query = ""; this.page = "info"; this.tab = "info";
    this.browsing = false; this.stampChecked = false; this.list = undefined; this.scrollOffset = 0; this.minScroll = 0; this.busy = false;
    this.ticker = undefined;
    addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.74).setDepth(-29);
    this.popups = new PopupLayer(this);
    this.topBar = new TopBar(this, 40, {
      profile: false, currencies: "guild", guildCoin: () => this.state?.me?.coin ?? 0,
      onCurrency: (currency) => openCurrencyGuide({ scene: this, popups: this.popups }, currency),
    });
    this.add.text(S.title.x, S.title.y, t("guild.title"), textStyle({ role: "display", size: 52 })).setOrigin(0, 0.5).setShadow(0, 4, "#05070a", 6, false, true);
    addBackButton(this, () => startScene(this, "lobby"));
    this.view = this.add.container(0, 0);
    this.controls = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    this.bindScroll();
    void this.reload();
    playSceneEntrance(this);
  }

  /* ── 데이터·오류 ──────────────────────────────────────────────────────── */

  private get myRole(): GuildRole | undefined { return this.state?.me?.role; }
  private get now(): number { return Date.now() + this.clockOffset; }
  private get inGuild(): boolean { return Boolean(this.state?.guild); }

  private toast(message: string, tone: "locked" | "unlocked" = "locked"): void { showContentToast(this, message, tone); }

  private fail(error: unknown): void {
    const raw = error instanceof GuildApiError ? error.code : error instanceof Error ? error.message : "";
    this.toast(isGuildErrorCode(raw) ? t(`guild.error.${raw}`) : t("guild.error.generic"));
  }

  /** 조작 하나를 돌린다. 도는 동안 다른 조작을 받지 않고, 실패하면 오류 한 줄을 띄운다. */
  private async act(task: () => Promise<unknown>, after?: () => void): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      await withBusy(this, task());
    } catch (error) {
      this.busy = false;
      if (this.scene.isActive()) this.fail(error);
      return false;
    }
    this.busy = false;
    if (!this.scene.isActive()) return true;
    after?.();
    await this.reload(true);
    return true;
  }

  /** 길드 상태를 다시 받고 지금 쪽의 자료도 새로 받아 그린다. 그날 처음 들어왔으면 출석판을 띄운다. */
  private async reload(keep = false): Promise<void> {
    let attendance: GuildAttendanceState | undefined;
    try {
      this.state = await guildApi.getGuild();
      this.clockOffset = this.state.serverTime - Date.now();
      if (!this.scene.isActive()) return;
      if (!this.state.guild) this.browsing = false;
      if (!this.state.guild || this.browsing) this.browse = (await guildApi.searchGuilds(this.query)).guilds;
      else if (this.page === "info" && this.tab === "members") this.members = await guildApi.getMembers();
      if (this.state.guild && !this.stampChecked) {
        this.stampChecked = true;
        attendance = await guildApi.getAttendance();
        // 도장판 위 기여도 경쟁 줄이 길드원 이번 주 기여를 읽는다 — 아직 받지 않았으면 함께 받는다.
        if (!attendance.stampedToday && !this.members) this.members = await guildApi.getMembers();
      }
    } catch (error) {
      if (this.scene.isActive()) this.fail(error);
      return;
    }
    if (!this.scene.isActive()) return;
    this.topBar.refresh();
    this.paint(keep);
    if (attendance && !attendance.stampedToday) this.openStampBoard(attendance);
  }

  /* ── 그리기 ───────────────────────────────────────────────────────────── */

  private paint(keep = false): void {
    const debug = !this.state?.guild || this.browsing ? "browse" : this.page === "info" ? this.tab : this.page;
    setDebugScene("guild", debug);
    this.ticker?.remove(); this.ticker = undefined;
    this.controls.removeAll(true);
    this.tabRow.removeAll(true);
    this.view.removeAll(true);
    this.list = undefined;
    if (!this.state?.guild || this.browsing) { this.paintBrowse(keep); return; }
    this.paintMenuChip();
    this.paintPages();
    if (this.page === "info") {
      this.paintTabs();
      if (this.tab === "info") this.paintInfo();
      else this.paintMembers(keep);
    } else if (this.page === "war") this.paintWar();
    else this.paintGuard();
  }

  /** 맨 아래 큰 탭 셋. 길드전·수호전은 판이 바뀐 뒤 아직 보지 않았으면 붉은 점이 선다. */
  private paintPages(): void {
    const seen = settingsManager.get().game.guildSeen;
    PAGES.forEach(({ key, labelKey }, index) => {
      const x = guildPageX(index);
      addCategoryTab(this, this.tabRow, {
        x, y: S.pages.y, width: S.pages.width, height: S.pages.height, label: t(labelKey), selected: this.page === key, labelSize: S.pages.labelSize,
        onSelect: () => {
          if (this.page === key || this.busy) return;
          const from = PAGES.findIndex((candidate) => candidate.key === this.page);
          this.page = key;
          this.markSeen();
          void this.reload().then(() => { if (this.scene.isActive()) slideTabPage(this, [this.view, this.controls], from, index); });
        },
      });
      if (key !== "info" && this.page !== key && guildPageHasNews(key, seen[key], this.now)) {
        this.tabRow.add(this.add.circle(x + S.pages.width / 2 - 24, S.pages.y - S.pages.height / 2 - 4, 11, RED_DOT));
      }
    });
  }

  /** 지금 연 길드전·수호전 판을 봤다고 적는다. */
  private markSeen(): void {
    if (this.page === "info") return;
    settingsManager.rememberGuildSeen(this.page, guildPageEventKey(this.page, this.now));
  }

  /** 정보 안의 작은 탭(정보 · 멤버). 가입 신청이 있으면 멤버에 붉은 점. */
  private paintTabs(): void {
    TABS.forEach(({ key, labelKey }, index) => {
      addCategoryTab(this, this.tabRow, {
        x: guildTabX(index), y: S.tabs.y, width: S.tabs.width, height: S.tabs.height, label: t(labelKey), selected: this.tab === key,
        onSelect: () => {
          if (this.tab === key || this.busy) return;
          const from = TABS.findIndex((candidate) => candidate.key === this.tab);
          this.tab = key;
          void this.reload().then(() => { if (this.scene.isActive()) slideTabPage(this, [this.view, this.controls], from, index); });
        },
      });
    });
    const pending = this.state?.pendingRequests ?? 0;
    if (pending > 0) this.tabRow.add(this.add.circle(guildTabX(1) + S.tabs.width / 2 - 22, S.tabs.y - S.tabs.height / 2 + 2, 9, RED_DOT));
  }

  /** 오른쪽 위 작은 칩 — 길드 안이면 다른 길드 찾기·탈퇴를 여는 창, 둘러보는 중이면 돌아가기다. */
  private paintMenuChip(): void {
    const { right, y, width, height } = S.menuChip;
    const back = this.browsing;
    const chip = addFriendChip(this, this.controls, right - width / 2, y, width, height, t(back ? "guild.menu.back" : "guild.menu.chip"), false, () => {
      if (this.busy) return;
      if (back) { this.browsing = false; void this.reload(); return; }
      this.openGuildMenu();
    });
    chip.setDepth(1);
  }

  private label(parent: Phaser.GameObjects.Container, x: number, y: number, text: string, options: Parameters<typeof textStyle>[0], origin: [number, number] = [0, 0.5]): Phaser.GameObjects.Text {
    const label = this.add.text(x, y, text, textStyle(options)).setOrigin(origin[0], origin[1]);
    parent.add(label);
    return label;
  }

  private plate(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, edge?: number): void {
    const unit = Math.min(42, height / 3);
    parent.add(drawLayer(this, x, y, chipPoints(width, height, { bevel: { topLeft: unit, topRight: 0, bottomRight: unit, bottomLeft: 0 } }), { fill: 0x1a1f27, alpha: HOLO.glass, edge }));
  }

  private ageText(lastActiveAt: number): string {
    const age = lastActiveAge(lastActiveAt, this.now);
    return age.unit === "online" ? t("friends.age.online") : t(`friends.age.${age.unit}`, { value: age.value });
  }

  /** 남은 시간 줄 하나를 매초 다시 적는다. 쪽이 바뀌면 `paint`가 멈춘다. */
  private tick(text: Phaser.GameObjects.Text, write: () => string): void {
    text.setText(write());
    this.ticker = this.time.addEvent({ delay: 1_000, loop: true, callback: () => { if (text.active) text.setText(write()); } });
  }

  /* ── 길드가 없을 때 · 다른 길드 찾기 ─────────────────────────────────── */

  private paintBrowse(keep: boolean): void {
    this.listBottom = S.body.browseBottom;
    const looking = this.browsing && this.inGuild;
    if (looking) this.paintMenuChip();
    const cooldown = (this.state?.leaveCooldownUntil ?? 0) - this.now;
    const summary = !looking && cooldown > 0 ? t("guild.browse.cooldown", { time: hmText(cooldown) }) : this.query ? t("guild.browse.results", { count: this.browse.length }) : t("guild.browse.summary");
    this.label(this.controls, S.side, S.summary.y, summary, { role: "body", size: 28, color: !looking && cooldown > 0 ? COLOR.dangerText : COLOR.inkDim });
    const y = S.controls.y;
    const buttonWidth = 200;
    const inputWidth = S.width - buttonWidth * (looking ? 1 : 2) - (looking ? 12 : 24);
    const field = new TextInputField(this, S.side + inputWidth / 2, y, {
      width: inputWidth, height: S.controls.height - 4, value: this.query, maxGlyphs: GUILD_NAME_MAX, ariaLabel: t("guild.browse.searchAria"), fontSize: 28,
    });
    this.controls.add(field);
    const search = (): void => { this.query = field.value; void this.reload(); };
    addRowButton(this, this.controls, S.side + inputWidth + 12 + buttonWidth / 2, y, buttonWidth, S.controls.height - 4, t("guild.browse.search"), "neutral", () => FULL_CLIP, () => true, search);
    if (!looking) addRowButton(this, this.controls, S.side + S.width - buttonWidth / 2, y, buttonWidth, S.controls.height - 4, t("guild.browse.create"), "accent", () => FULL_CLIP, () => true, () => this.openEditor("create"));
    if (this.browse.length === 0) {
      this.label(this.view, BASE_WIDTH / 2, 760, t("guild.browse.empty"), { role: "body", size: 32, color: COLOR.inkDim }, [0.5, 0.5]);
      return;
    }
    const pending = new Set(this.state?.requestedGuildIds ?? []);
    const mine = this.state?.guild?.id;
    this.mountList(this.browse.length, keep, (row, index) => {
      const guild = this.browse[index];
      this.plate(row, 0, 0, S.width, S.row.height - 4, guild.id === mine ? COLOR.accent : undefined);
      addGuildBadge(this, row, R.badge.x, 0, guild.badge, R.badge.size);
      // 이미 길드에 있으면 둘러보기만 한다 — 가입 버튼을 세우면 누를 때마다 거절된다.
      this.guildRowText(row, guild, looking ? 24 : R.button.width + R.button.padRight + 24);
      if (looking) return;
      const requested = pending.has(guild.id);
      const full = guild.memberCount >= guild.capacity;
      const label = requested ? t("guild.browse.cancel") : full ? t("guild.browse.full") : guild.joinMode === "open" ? t("guild.browse.join") : t("guild.browse.apply");
      const tone: RowButtonTone = requested ? "neutral" : full || cooldown > 0 ? "disabled" : "accent";
      addRowButton(this, row, guildRowButtonX(0), 0, R.button.width, R.button.height, label, tone, this.clip, this.canTap, () => {
        if (requested) void this.act(() => guildApi.cancelJoinRequest(guild.id));
        else void this.act(() => guildApi.joinGuild(guild.id), () => this.toast(guild.joinMode === "open" ? t("guild.browse.joined") : t("guild.browse.applied"), "unlocked"));
      });
    });
  }

  private guildRowText(row: Phaser.GameObjects.Container, guild: GuildSummary, rightRoom: number): void {
    const room = S.width / 2 - rightRoom - R.textX;
    row.add(squeezeTextToWidth(this.add.text(R.textX, R.nameY, guild.name, textStyle({ role: "display", size: 36 })).setOrigin(0, 0.5), room));
    const detail = this.label(row, R.textX, R.subY, `${t("guild.levelShort", { level: guild.level })} · ${t("guild.capacity", { count: guild.memberCount, capacity: guild.capacity })} · ${t(`guild.joinMode.${guild.joinMode}`)}`, { role: "emphasis", size: 28, color: COLOR.accentText });
    squeezeTextToWidth(detail, room);
    if (guild.notice) row.add(squeezeTextToWidth(this.add.text(R.textX, R.noteY, guild.notice, textStyle({ role: "body", size: 28, color: COLOR.ink })).setOrigin(0, 0.5), room));
  }

  /** 오른쪽 위 칩이 여는 창 — 다른 길드 찾기 · 탈퇴(혼자 남은 길드장은 해산). */
  private openGuildMenu(): void {
    const guild = this.state!.guild!, role = this.myRole!;
    const alone = guild.memberCount === 1;
    const leaderStuck = role === "leader" && !alone;
    const leaveLabel = t(role === "leader" && alone ? "guild.info.disband" : "guild.info.leave");
    this.popups.open({ width: 700, height: 420, title: t("guild.menu.title"), closeOnBackdrop: true, dim: true }, (body, close) => {
      addRowButton(this, body, 0, -40, 560, 90, t("guild.menu.browse"), "neutral", () => FULL_CLIP, () => true, () => {
        close();
        this.browsing = true; this.query = "";
        void this.reload();
      });
      addRowButton(this, body, 0, 80, 560, 90, leaveLabel, leaderStuck ? "disabled" : "danger", () => FULL_CLIP, () => true, () => {
        close();
        this.confirmLeave(role === "leader" && alone);
      });
      if (leaderStuck) this.label(body, 0, 160, t("guild.error.LEADER_CANNOT_LEAVE"), { role: "body", size: 24, color: COLOR.inkDim }, [0.5, 0.5]);
    });
  }

  private confirmLeave(disband: boolean): void {
    this.popups.confirm({
      title: t(disband ? "guild.info.disbandTitle" : "guild.info.leaveTitle"),
      message: t(disband ? "guild.info.disbandConfirm" : "guild.info.leaveConfirm"),
      confirmLabel: t(disband ? "guild.info.disband" : "guild.info.leave"), destructive: true,
    }, () => { void this.act(() => (disband ? guildApi.disbandGuild() : guildApi.leaveGuild()), () => { this.page = "info"; this.tab = "info"; }); });
  }

  /* ── 정보 ─────────────────────────────────────────────────────────────── */

  private paintInfo(): void {
    const guild = this.state!.guild!, me = this.state!.me!;
    const v = this.view;
    v.add(new RailButton(this, I.rail.x, I.rail.ranking, { icon: "bar-chart", label: t("guild.ranking.title"), size: I.rail.size, onClick: () => this.openRanking() }));
    v.add(addSideShopButton(this, I.rail.x, I.rail.shop, I.rail.size, t("guild.shop.title"), () => this.openShop()));

    addGuildBadge(this, v, I.badge.x, I.badge.y, guild.badge, I.badge.size);
    const textRoom = I.left + I.width - I.name.x;
    v.add(squeezeTextToWidth(this.add.text(I.name.x, I.name.y, guild.name, textStyle({ role: "display", size: 52 })).setOrigin(0, 0.5), textRoom));
    this.label(v, I.level.x, I.level.y, t("guild.levelShort", { level: guild.level }), { role: "display", size: 38, color: COLOR.accentText });
    this.label(v, I.capacity.x, I.capacity.y, `${t("guild.capacity", { count: guild.memberCount, capacity: guild.capacity })} · ${t(`guild.joinMode.${guild.joinMode}`)}`, { role: "emphasis", size: 28, color: COLOR.ink });
    this.label(v, I.leader.x, I.leader.y, t("guild.info.leader", { name: guild.leaderName }), { role: "body", size: 26, color: COLOR.inkDim });

    // 게이지도 이 쪽의 일부다 — 장면에 바로 세우면 탭을 바꿔도 남는다(예전 버그).
    const progress = guildLevelProgress(guild.prosperity);
    new HoloBar(this, I.left + I.width / 2, I.bar.y, I.width, I.bar.height, { color: COLOR.accent, trackAlpha: 0.85, outline: true })
      .addTo(v).setValue(progress.next === null ? 1 : progress.into / progress.span);
    this.label(v, I.left, I.barText.y, t("guild.info.prosperity", { value: guild.prosperity.toLocaleString() }), { role: "emphasis", size: 28 });
    this.label(v, I.left + I.width, I.barText.y, progress.next === null ? t("guild.info.maxLevel") : t("guild.info.nextLevel", { value: (progress.span - progress.into).toLocaleString() }), { role: "body", size: 26, color: COLOR.inkDim }, [1, 0.5]);

    const perks = guildPerks(guild.level);
    const perkLines = [
      perks.excavationBonusPercent > 0 ? t("guild.info.perkExcavation", { value: perks.excavationBonusPercent }) : "",
      perks.dispatchTimeReductionPercent > 0 ? t("guild.info.perkDispatch", { value: perks.dispatchTimeReductionPercent }) : "",
    ].filter(Boolean);
    (perkLines.length > 0 ? perkLines : [t("guild.info.perkNone")]).forEach((line, index) => this.label(v, I.left, I.perks.y + index * I.perks.gap, line, { role: "emphasis", size: 30, color: COLOR.accentText }));

    this.plate(v, I.left + I.width / 2, I.notice.y + I.notice.height / 2, I.width, I.notice.height);
    const notice = guild.notice || t("guild.info.noticeEmpty");
    v.add(this.add.text(I.left + 36, I.notice.y + 36, notice, textStyle({ role: "body", size: 30, color: guild.notice ? COLOR.ink : COLOR.inkDim, wrap: I.width - 72 })).setOrigin(0, 0));

    this.label(v, I.left, I.me.y, t("guild.info.me", { role: t(`guild.role.${me.role}`) }), { role: "display", size: 32, color: COLOR.ink });
    this.label(v, I.left, I.me.y + I.me.gap, t("guild.info.contribution", { week: me.contributionWeek.toLocaleString(), total: me.contributionTotal.toLocaleString() }), { role: "emphasis", size: 28, color: COLOR.accentText });
    this.label(v, I.left, I.me.y + I.me.gap * 2, t("guild.info.coin", { coin: me.coin.toLocaleString() }), { role: "emphasis", size: 28, color: COIN_TEXT });

    const buttons: { label: string; run: () => void }[] = [];
    if (guildCan(me.role, "notice") || guildCan(me.role, "joinMode")) buttons.push({ label: t("guild.info.settings"), run: () => this.openSettings() });
    if (guildCan(me.role, "badge")) buttons.push({ label: t("guild.badge.apply"), run: () => this.openEditor("badge") });
    buttons.forEach((button, index) => {
      const x = I.left + I.actions.width / 2 + index * (I.actions.width + I.actions.gap);
      addRowButton(this, v, x, I.actions.y, I.actions.width, I.actions.height, button.label, "neutral", () => FULL_CLIP, () => true, button.run);
    });
  }

  private openSettings(): void {
    const guild = this.state!.guild!;
    let joinMode: GuildJoinMode = guild.joinMode;
    this.popups.open({ width: 900, height: 820, title: t("guild.settings.title"), closeOnBackdrop: false, dim: true }, (body, close) => {
      this.label(body, -400, -300, t("guild.settings.notice"), { role: "emphasis", size: 28, color: COLOR.accentText });
      const input = new TextInputField(this, 0, -170, { width: 800, height: 200, value: guild.notice, maxGlyphs: GUILD_NOTICE_MAX, ariaLabel: t("guild.settings.noticeAria"), fontSize: 28, multiline: true });
      body.add(input);
      this.label(body, -400, -20, t("guild.settings.joinMode"), { role: "emphasis", size: 28, color: COLOR.accentText });
      const chips: Phaser.GameObjects.Container[] = [];
      const paintChips = (): void => {
        chips.splice(0).forEach((chip) => chip.destroy());
        (["open", "approval"] as const).forEach((mode, index) => chips.push(addFriendChip(this, body, -200 + index * 400, 60, 380, 72, t(`guild.joinMode.${mode}`), joinMode === mode, () => { joinMode = mode; paintChips(); })));
      };
      paintChips();
      addRowButton(this, body, 0, 280, 420, 90, t("guild.settings.save"), "accent", () => FULL_CLIP, () => true, () => {
        const update = { notice: input.value, joinMode };
        void this.act(() => guildApi.updateGuild(update), () => { close(); this.toast(t("guild.settings.saved"), "unlocked"); });
      });
    });
  }

  /** 길드 순위 — 레벨이 높은 순, 같으면 길드원이 많은 순. 내 길드 줄은 강조색 테를 두른다. */
  /**
   * 길드 순위 — 부흥도(=레벨)로 줄을 세우고 같으면 총 기여도로 가른다. 줄마다 레벨·인원 아래에 총 기여도·길드전·
   * 수호전 점수가 함께 선다. 길드전·수호전은 아직 판이 열리지 않아 점수가 없으면 「-」다.
   */
  private openRanking(): void {
    if (this.busy) return;
    void this.act(async () => {
      // 요약에 순위 값이 실리기 전의 서버가 답해도 줄이 서도록 빈 값을 0·null로 채운다.
      const guilds = (await guildApi.searchGuilds("")).guilds
        .map((guild) => ({ ...guild, prosperity: guild.prosperity ?? 0, contributionTotal: guild.contributionTotal ?? 0, warScore: guild.warScore ?? null, guardScore: guild.guardScore ?? null }))
        .sort((a, b) => b.prosperity - a.prosperity || b.contributionTotal - a.contributionTotal || a.name.localeCompare(b.name)).slice(0, 8);
      if (!this.scene.isActive()) return;
      const rowGap = 156;
      const height = 220 + Math.max(1, guilds.length) * rowGap;
      const mine = this.state?.guild?.id;
      const score = (value: number | null): string => value === null ? t("guild.ranking.none") : value.toLocaleString();
      this.popups.open({ width: 940, height, title: t("guild.ranking.title"), closeOnBackdrop: true, dim: true }, (body) => {
        if (guilds.length === 0) { this.label(body, 0, 0, t("guild.browse.empty"), { role: "body", size: 28, color: COLOR.inkDim }, [0.5, 0.5]); return; }
        guilds.forEach((guild, index) => {
          const y = -height / 2 + 150 + index * rowGap;
          this.plate(body, 0, y, 860, rowGap - 14, guild.id === mine ? COLOR.accent : undefined);
          this.label(body, -390, y, `${index + 1}`, { role: "display", size: 40, color: index < 3 ? COLOR.accentText : COLOR.ink }, [0.5, 0.5]);
          addGuildBadge(this, body, -300, y, guild.badge, 88);
          body.add(squeezeTextToWidth(this.add.text(-236, y - 40, guild.name, textStyle({ role: "display", size: 32 })).setOrigin(0, 0.5), 440));
          this.label(body, 400, y - 40, t("guild.levelShort", { level: guild.level }), { role: "display", size: 34, color: COLOR.accentText }, [1, 0.5]);
          this.label(body, -236, y + 2, `${t("guild.capacity", { count: guild.memberCount, capacity: guild.capacity })} · ${t("guild.ranking.prosperity", { value: guild.prosperity.toLocaleString() })}`, { role: "body", size: 24, color: COLOR.inkDim });
          body.add(squeezeTextToWidth(this.add.text(-236, y + 40, t("guild.ranking.scores", {
            contribution: guild.contributionTotal.toLocaleString(), war: score(guild.warScore), guard: score(guild.guardScore),
          }), textStyle({ role: "emphasis", size: 24, color: COIN_TEXT })).setOrigin(0, 0.5), 636));
        });
      });
    }).then(() => undefined);
  }

  /** 길드 상점 — 일반 상점과 같은 무대·전시대(`ShopScene`)를 쓰고, 돌아오는 길은 길드 화면이다. */
  private openShop(): void {
    if (this.busy) return;
    startScene(this, "shop", { storefront: "guild", returnScene: "guild" });
  }

  /* ── 출석 도장판 ──────────────────────────────────────────────────────── */

  /**
   * 그날 처음 들어오면 뜨는 도장판. 일곱 칸 중 지난 칸은 이미 찍혀 있고, 판이 서면 곧바로 서버에 찍고(고를 것이 없다)
   * 오늘 칸에 인장이 **쾅** 박힌 뒤 영수증으로 넘어간다. 7일차를 찍은 다음 날은 빈 판의 1일차부터 다시 돈다.
   */
  private openStampBoard(attendance: GuildAttendanceState): void {
    if (this.popups.isOpen) return;
    this.busy = true;
    const today = attendance.day;
    this.popups.open({ width: A.width, height: A.height, title: t("guild.attendance.title"), closeOnBackdrop: false, dim: true }, (body, close) => {
      const cells: { x: number; y: number }[] = [];
      GUILD_ATTENDANCE_CYCLE.forEach((day, index) => {
        const slot = guildStampSlot(index);
        cells.push(slot);
        const number = index + 1;
        const isToday = number === today;
        const last = index === GUILD_ATTENDANCE_CYCLE.length - 1;
        const cell = this.add.container(slot.x, slot.y);
        body.add(cell);
        cell.add(drawLayer(this, 0, 0, chipPoints(slot.width, slot.height, { bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 } }), {
          fill: last ? 0x2b2616 : 0x141b24, alpha: 0.96, edge: isToday ? COLOR.accent : last ? 0xf2c14e : undefined, edgeAlpha: 0.9,
        }));
        this.label(cell, 0, -slot.height / 2 + 30, t("guild.attendance.dayLabel", { day: number }), { role: "display", size: 26, color: isToday ? COLOR.accentText : COLOR.ink }, [0.5, 0.5]);
        const reward = attendanceRewardIcon(number);
        addFramedIcon(this, cell, 0, 8, last ? 116 : 104, reward.texture, { amount: reward.amount.toLocaleString(), plain: true });
        this.label(cell, 0, slot.height / 2 - 26, t("guild.attendance.cellGain", { contribution: day.contribution, coin: day.coin }), { role: "emphasis", size: 20, color: COIN_TEXT }, [0.5, 0.5]);
        if (number <= attendance.filled) body.add(addAttendanceStamp(this, slot.x, slot.y + 8, A.stampSize, COLOR.accent).setAlpha(0.92));
      });
      const regular = GUILD_ATTENDANCE_CYCLE[0], final = GUILD_ATTENDANCE_CYCLE[GUILD_ATTENDANCE_CYCLE.length - 1];
      this.label(body, 0, A.info, t("guild.attendance.gain", { contribution: regular.contribution, coin: regular.coin, finalContribution: final.contribution, finalCoin: final.coin }), { role: "body", size: 24, color: COLOR.inkDim, align: "center", wrap: A.width - 80 }, [0.5, 0.5]);

      const race = this.paintRace(body, guildAttendanceDay(today).contribution);

      const slot = cells[today - 1];
      this.time.delayedCall(420, () => {
        if (!this.scene.isActive()) return;
        gameApi.stampGuildAttendance({}).then((result) => {
          if (!this.scene.isActive() || !body.active) return;
          playAttendanceStamp(this, body, slot.x, slot.y + 8, A.stampSize, COLOR.accent, {
            onDone: () => race(() => this.time.delayedCall(320, () => {
              close();
              this.busy = false;
              if (!this.scene.isActive()) return;
              const gain = guildAttendanceDay(result.day);
              const items: RewardPopupItem[] = [
                ...(result.granted.gold > 0 ? [{ icon: CURRENCY_ICON_BY_WALLET.gold, amount: result.granted.gold }] : []),
                ...(result.granted.cheesecake > 0 ? [{ icon: CURRENCY_ICON_BY_WALLET.cheesecake, amount: result.granted.cheesecake }] : []),
                ...(result.granted.gems > 0 ? [{ icon: CURRENCY_ICON_BY_WALLET.gems, amount: result.granted.gems }] : []),
                { icon: "currency-guild-coin", amount: gain.coin },
              ];
              openRewardPopup(this, this.popups, {
                title: t("guild.attendance.receipt", { day: result.day }), items,
                footnote: t("guild.attendance.footnote", { contribution: gain.contribution, prosperity: gain.prosperity }),
              });
              void this.reload(true);
            })),
          });
        }, (error: unknown) => {
          close();
          this.busy = false;
          if (this.scene.isActive()) this.fail(error);
        });
      });
    });
  }

  /**
   * 도장판 맨 위의 기여도 경쟁 줄 — 나와 바로 위 한 사람(내가 1위면 2위)이 이번 주 기여도로 마주 선다. 돌려주는 함수가
   * 도장이 박힌 뒤의 연출이다: 내 수가 **뽀로롱** 한 칸씩 튀며 오르고, 위 사람을 넘으면 두 줄이 자리를 바꾸며 「역전!」이 선다.
   * 길드원을 받지 못했으면 줄을 세우지 않고 연출도 곧바로 넘어간다.
   */
  private paintRace(body: Phaser.GameObjects.Container, gain: number): (onDone: () => void) => void {
    const race = this.members ? guildAttendanceRace(this.members.members, gain) : null;
    if (!race) return (onDone) => onDone();
    const RA = A.race;
    const rowY = (top: boolean): number => RA.rows[top ? 0 : 1];
    const makeRow = (member: GuildMemberView, top: boolean, rank: number, mine: boolean) => {
      const row = this.add.container(0, rowY(top));
      body.add(row);
      row.add(drawLayer(this, 0, 0, chipPoints(RA.width, RA.height, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } }), {
        fill: mine ? 0x162a2a : 0x141b24, alpha: 0.96, edge: mine ? COLOR.accent : undefined, edgeAlpha: 0.9,
      }));
      const rankText = this.label(row, -RA.width / 2 + 46, 0, t("guild.attendance.raceRank", { rank }), { role: "display", size: 32, color: mine ? COLOR.accentText : COLOR.ink }, [0.5, 0.5]);
      const relic = RELICS.find((candidate) => candidate.id === member.avatarRelicId);
      row.add(new ProfileAvatar(this, -RA.width / 2 + 132, 0, { size: RA.avatar, frameId: member.frameId, portraitAssetId: relic?.portraitAssetId, fallback: Array.from(member.name.trim())[0] ?? "?" }));
      row.add(squeezeTextToWidth(this.add.text(-RA.width / 2 + 190, 0, member.name, textStyle({ role: "display", size: 30, color: mine ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5), 330));
      this.label(row, RA.width / 2 - 150, 0, t("guild.attendance.raceLabel"), { role: "body", size: 22, color: COLOR.inkDim }, [1, 0.5]);
      const value = this.label(row, RA.width / 2 - 30, 0, member.contributionWeek.toLocaleString(), { role: "display", size: 38, color: mine ? COIN_TEXT : COLOR.ink }, [1, 0.5]);
      return { row, rankText, value };
    };
    const rival = race.rival ? makeRow(race.rival, !race.meOnTopBefore, race.rivalRankBefore, false) : undefined;
    const me = makeRow(race.me, race.meOnTopBefore, race.rankBefore, true);
    return (onDone) => {
      if (!body.active) { onDone(); return; }
      const from = race.me.contributionWeek;
      // 오른 몫이 위로 떠오른다.
      const plus = this.label(me.row, RA.width / 2 - 30, -10, `+${gain}`, { role: "display", size: 30, color: COIN_TEXT }, [1, 0.5]).setAlpha(0);
      this.tweens.add({ targets: plus, y: -54, alpha: { from: 1, to: 0 }, duration: 900, ease: "Cubic.easeOut" });
      let shown = from;
      this.tweens.addCounter({
        from, to: race.after, duration: Math.min(900, 120 + gain * 24), ease: "Linear",
        onUpdate: (tween) => {
          const next = Math.round(tween.getValue() ?? from);
          if (next === shown || !me.value.active) return;
          shown = next;
          me.value.setText(next.toLocaleString()).setScale(1.28);
          this.tweens.add({ targets: me.value, scale: 1, duration: 110, ease: "Back.easeOut" });
        },
        onComplete: () => {
          if (!body.active) { onDone(); return; }
          me.value.setText(race.after.toLocaleString());
          if (!race.overtook || !rival) { this.time.delayedCall(260, onDone); return; }
          // 역전 — 두 줄이 서로의 자리로 미끄러지고, 내 줄이 한 번 부풀었다 가라앉는다.
          body.bringToTop(me.row);
          this.tweens.add({ targets: me.row, y: rowY(true), duration: 460, ease: "Back.easeInOut" });
          this.tweens.add({ targets: rival.row, y: rowY(false), duration: 460, ease: "Back.easeInOut" });
          this.tweens.add({ targets: me.row, scale: { from: 1, to: 1.06 }, duration: 230, yoyo: true, ease: "Sine.easeInOut" });
          this.time.delayedCall(300, () => {
            if (!body.active) return;
            me.rankText.setText(t("guild.attendance.raceRank", { rank: race.rankAfter }));
            rival.rankText.setText(t("guild.attendance.raceRank", { rank: race.rivalRankAfter }));
          });
          const banner = this.label(body, -RA.width / 2 + 10, rowY(true) - RA.height / 2 - 6, t("guild.attendance.overtake"), { role: "display", size: 34, color: "#ffd36e" }, [0, 0.5])
            .setStroke("#2a1600", 6).setScale(0).setAngle(-6);
          this.tweens.add({ targets: banner, scale: 1, delay: 380, duration: 260, ease: "Back.easeOut" });
          this.time.delayedCall(1200, onDone);
        },
      });
    };
  }

  /* ── 만들기 · 뱃지 ────────────────────────────────────────────────────── */

  private openEditor(mode: "create" | "badge"): void {
    const badge: GuildBadge = { ...(mode === "badge" && this.state?.guild ? this.state.guild.badge : DEFAULT_GUILD_BADGE) };
    let joinMode: GuildJoinMode = "open";
    const creating = mode === "create";
    const free = !creating && this.state?.guild?.badgeFree === true;
    const height = creating ? 1180 : 840;
    this.popups.open({ width: E.width, height, title: t(creating ? "guild.create.title" : "guild.badge.title"), closeOnBackdrop: false, dim: true }, (body, close) => {
      const top = creating ? 0 : 210;
      let input: TextInputField | undefined;
      if (creating) {
        this.label(body, -400, E.nameLabel, t("guild.create.nameLabel"), { role: "emphasis", size: 28, color: COLOR.accentText });
        input = new TextInputField(this, 0, E.nameInput, { width: 800, height: 80, value: "", maxGlyphs: GUILD_NAME_MAX, ariaLabel: t("guild.create.nameAria"), fontSize: 32 });
        body.add(input);
        const chips: Phaser.GameObjects.Container[] = [];
        const paintChips = (): void => {
          chips.splice(0).forEach((chip) => chip.destroy());
          (["open", "approval"] as const).forEach((m, index) => chips.push(addFriendChip(this, body, -200 + index * 400, E.joinMode, 380, 72, t(`guild.joinMode.${m}`), joinMode === m, () => { joinMode = m; paintChips(); })));
        };
        paintChips();
      }
      let preview: Phaser.GameObjects.Container | undefined;
      const paintPreview = (): void => { preview?.destroy(); preview = addGuildBadge(this, body, 0, E.preview.y + top, badge, E.preview.size); };
      paintPreview();
      BADGE_CHOICES.forEach((cycler, row) => {
        const y = E.cyclers.top + top + row * E.cyclers.gap;
        this.label(body, -400, y, t(cycler.labelKey), { role: "emphasis", size: 28 });
        const values: readonly GuildBadge[keyof GuildBadge][] = cycler.values;
        let selector: Phaser.GameObjects.Container;
        const paintSelector = (): void => {
          selector?.destroy();
          const index = values.indexOf(badge[cycler.field]);
          selector = addFriendChip(this, body, 190, y, 420, 76, t("guild.badge.index", { index: index + 1, count: values.length }), false, () => {
            openGuildBadgePicker(this, this.popups, {
              title: t(cycler.labelKey), badge, field: cycler.field, choices: values,
              onPick: (value) => {
                // 값 목록과 field는 위의 같은 정의에서 온다. 서버 검증·저장 계약은 그대로 둔다.
                Object.assign(badge, { [cycler.field]: value });
                paintSelector(); paintPreview();
              },
            });
          });
        };
        paintSelector();
      });
      if (!creating) this.label(body, 0, E.note + top - 120, free ? t("guild.badge.free") : "", { role: "body", size: 26, color: COLOR.accentText }, [0.5, 0.5]);
      const submitY = creating ? E.submit : 380;
      addRowButton(this, body, 0, submitY, 460, 92, t(creating ? "guild.create.submit" : "guild.badge.apply"), "accent", () => FULL_CLIP, () => true, () => {
        if (!isGuildBadge(badge)) { this.toast(t("guild.error.BADGE_INVALID")); return; }
        if (creating) {
          const checked = validateGuildName(input?.value ?? "");
          if (!checked.ok) { this.toast(t(`guild.name.${checked.problem}`)); return; }
          const name = checked.name;
          this.popups.confirm({
            title: t("guild.create.confirmTitle"), message: t("guild.create.confirmMessage", { name }), confirmLabel: t("guild.create.submit"),
            costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gems, amount: GUILD_CREATE_GEMS }],
            balance: { iconKey: CURRENCY_ICON_BY_WALLET.gems, before: session.wallet.gems, after: session.wallet.gems - GUILD_CREATE_GEMS },
          }, () => { void this.act(() => gameApi.createGuild({ name, joinMode, badge: { ...badge } }), () => { close(); this.toast(t("guild.create.done"), "unlocked"); }); });
          return;
        }
        const current = this.state?.guild?.badge;
        if (current && current.shape === badge.shape && current.shapeColor === badge.shapeColor && current.icon === badge.icon && current.iconColor === badge.iconColor) { this.toast(t("guild.badge.same")); return; }
        const change = (): void => { void this.act(() => gameApi.changeGuildBadge({ badge: { ...badge } }), () => { close(); this.toast(t("guild.badge.done"), "unlocked"); }); };
        if (free) { change(); return; }
        this.popups.confirm({
          title: t("guild.badge.confirmTitle"), message: t("guild.badge.confirmMessage"), confirmLabel: t("guild.badge.apply"),
          costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gems, amount: GUILD_BADGE_CHANGE_GEMS }],
          balance: { iconKey: CURRENCY_ICON_BY_WALLET.gems, before: session.wallet.gems, after: session.wallet.gems - GUILD_BADGE_CHANGE_GEMS },
        }, change);
      });
      addRowButton(this, body, 0, submitY + 110, 460, 80, t("guild.members.close"), "neutral", () => FULL_CLIP, () => true, close);
    });
  }

  /* ── 멤버 ─────────────────────────────────────────────────────────────── */

  private paintMembers(keep: boolean): void {
    this.listBottom = S.body.bottom;
    const data = this.members, me = this.state?.me;
    if (!data || !me) return;
    const guild = this.state!.guild!;
    this.label(this.controls, S.side, S.summary.y, t("guild.members.summary", { count: data.members.length, capacity: guild.capacity }) + (data.requests.length > 0 ? ` · ${t("guild.members.requests", { count: data.requests.length })}` : ""), { role: "body", size: 28, color: COLOR.inkDim });
    const rows = [...data.requests.map((request) => ({ request })), ...data.members.map((member) => ({ member }))];
    this.mountList(rows.length, keep, (row, index) => {
      const entry = rows[index];
      const person = "request" in entry ? entry.request : entry.member;
      this.plate(row, 0, 0, S.width, S.row.height - 4, "member" in entry && entry.member.isMe ? COLOR.accent : undefined);
      const relic = RELICS.find((candidate) => candidate.id === person.avatarRelicId);
      row.add(new ProfileAvatar(this, R.badge.x, 0, { size: 104, frameId: person.frameId, portraitAssetId: relic?.portraitAssetId, fallback: Array.from(person.name.trim())[0] ?? "?" }));
      if ("request" in entry) {
        const room = S.width / 2 - (R.button.width * 2 + 60) - R.textX;
        row.add(squeezeTextToWidth(this.add.text(R.textX, R.nameY, person.name, textStyle({ role: "display", size: 34 })).setOrigin(0, 0.5), room));
        this.label(row, R.textX, R.subY, t("guild.levelShort", { level: person.level }), { role: "emphasis", size: 28, color: COLOR.accentText });
        this.label(row, R.textX, R.noteY, t("guild.members.applied"), { role: "body", size: 26, color: COLOR.inkDim });
        addRowButton(this, row, guildRowButtonX(1), 0, R.button.width, R.button.height, t("guild.members.decline"), "danger", this.clip, this.canTap, () => { void this.act(() => guildApi.decideJoinRequest(person.userId, false)); });
        addRowButton(this, row, guildRowButtonX(0), 0, R.button.width, R.button.height, t("guild.members.approve"), "accent", this.clip, this.canTap, () => { void this.act(() => guildApi.decideJoinRequest(person.userId, true)); });
        return;
      }
      this.paintMemberRow(row, entry.member);
    });
  }

  /** 길드원 줄 — 이름 · 직책 · 레벨 · 접속 상태, 오른쪽에 이번 주 기여도와 누적. 줄 전체를 누르면 카드가 열린다. */
  private paintMemberRow(row: Phaser.GameObjects.Container, member: GuildMemberView): void {
    const hit = addClippedHit(this, row, 0, 0, S.width, S.row.height - 4, this.clip);
    hit.on("pointerdown", () => pressIn(row));
    hit.on("pointerout", () => pressOut(row, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(row); if (this.canTap()) this.openMemberProfile(member); });
    const right = S.width / 2 - 36;
    const room = right - 250 - R.textX;
    row.add(squeezeTextToWidth(this.add.text(R.textX, R.nameY, member.name, textStyle({ role: "display", size: 34 })).setOrigin(0, 0.5), room));
    const roleText = this.label(row, R.textX, R.subY, t(`guild.role.${member.role}`), { role: "emphasis", size: 28, color: member.role === "leader" ? "#f2c14e" : COLOR.accentText });
    this.label(row, R.textX + roleText.displayWidth + 18, R.subY, t("friends.researchLevel", { level: member.level }), { role: "emphasis", size: 26, color: COLOR.ink });
    const online = member.isMe || isOnline(member.lastActiveAt, this.now);
    this.label(row, R.textX + (online ? 24 : 0), R.noteY, member.isMe ? t("guild.members.me") : this.ageText(member.lastActiveAt), { role: "body", size: 26, color: online ? hex(ONLINE_COLOR) : COLOR.inkDim });
    if (online) row.add(this.add.circle(R.textX + 8, R.noteY, 8, ONLINE_COLOR));
    this.label(row, right, -34, t("guild.members.week"), { role: "body", size: 22, color: COLOR.inkDim }, [1, 0.5]);
    this.label(row, right, 4, member.contributionWeek.toLocaleString(), { role: "display", size: 40, color: COLOR.accentText }, [1, 0.5]);
    this.label(row, right, 46, t("guild.members.total", { value: member.contributionTotal.toLocaleString() }), { role: "body", size: 22, color: COLOR.ink }, [1, 0.5]);
  }

  /** 길드원 카드 — 친구 카드와 같은 한 장에 직책·기여도가 먼저 서고, 관리 권한이 있으면 밑동에 조작이 선다. */
  private openMemberProfile(member: GuildMemberView): void {
    if (this.popups.isOpen) return;
    const lastActive = member.isMe ? t("friends.age.online") : this.ageText(member.lastActiveAt);
    const records = [
      { label: t("guild.profile.role"), value: t(`guild.role.${member.role}`), sub: t("guild.levelShort", { level: this.state?.guild?.level ?? 1 }) },
      { label: t("guild.profile.contribution"), value: member.contributionWeek.toLocaleString(), sub: t("guild.members.total", { value: member.contributionTotal.toLocaleString() }) },
    ];
    const actions: ProfileAction[] = member.isMe ? [] : this.memberActions(member).map((action) => ({
      label: action.label, destructive: action.tone === "danger", onClick: () => { popup.close(); action.run(); },
    }));
    const popup = new PlayerProfilePopup(this, this.popups, guildMemberProfileDisplay(member, lastActive, records), () => undefined, undefined, {
      title: t("guild.profile.title"), actions: actions.length > 3 ? [{ label: t("guild.members.manage"), onClick: () => { popup.close(); this.openMemberActions(member); } }] : actions,
    });
    popup.open();
  }

  private memberActions(member: GuildMemberView): { label: string; tone: RowButtonTone; run: () => void }[] {
    const role = this.myRole;
    if (!role) return [];
    const actions: { label: string; tone: RowButtonTone; run: () => void }[] = [];
    if (guildCan(role, "promote") && member.role !== "leader") {
      for (const target of ASSIGNABLE_ROLES) {
        if (target === member.role || (target === "vice" && role !== "leader")) continue;
        const key = target === "vice" ? "guild.members.promoteVice" : target === "officer" ? "guild.members.promoteOfficer" : "guild.members.demote";
        actions.push({ label: t(key), tone: "neutral", run: () => { void this.act(() => guildApi.setMemberRole(member.userId, target)); } });
      }
    }
    if (role === "leader") {
      actions.push({
        label: t("guild.members.transfer"), tone: "neutral",
        run: () => this.popups.confirm({ title: t("guild.members.transferTitle"), message: t("guild.members.transferConfirm", { name: member.name }), confirmLabel: t("guild.members.transfer") }, () => { void this.act(() => guildApi.transferLeader(member.userId)); }),
      });
    }
    if (guildCanKick(role, member.role)) {
      actions.push({
        label: t("guild.members.kick"), tone: "danger",
        run: () => this.popups.confirm({ title: t("guild.members.kickTitle"), message: t("guild.members.kickConfirm", { name: member.name }), confirmLabel: t("guild.members.kick"), destructive: true }, () => { void this.act(() => guildApi.kickMember(member.userId)); }),
      });
    }
    return actions;
  }

  private openMemberActions(member: GuildMemberView): void {
    const actions = this.memberActions(member);
    const height = 220 + actions.length * 110;
    this.popups.open({ width: 700, height, title: t("guild.members.actionTitle", { name: member.name }), closeOnBackdrop: true, dim: true }, (body, close) => {
      actions.forEach((action, index) => {
        addRowButton(this, body, 0, -height / 2 + 150 + index * 110, 560, 86, action.label, action.tone, () => FULL_CLIP, () => true, () => { close(); action.run(); });
      });
    });
  }

  /* ── 길드전 · 수호전 ──────────────────────────────────────────────────── */

  private paintEventPlate(heading: string): Phaser.GameObjects.Container {
    const v = this.view;
    this.plate(v, BASE_WIDTH / 2, P.plate.y, S.width, P.plate.height, COLOR.accent);
    this.label(v, S.side + 48, P.heading, heading, { role: "display", size: 48 });
    return v;
  }

  private paintWar(): void {
    const guild = this.state!.guild!;
    const v = this.paintEventPlate(t("guild.page.war"));
    const war = guildWarNow(this.now);
    const phase = t(war.phase === "battle" ? "guild.war.battle" : "guild.war.prep");
    this.label(v, S.side + 48, P.phase, phase, { role: "display", size: 40, color: war.phase === "battle" ? COLOR.dangerText : COLOR.accentText });
    const timer = this.label(v, S.side + 48, P.timer, "", { role: "emphasis", size: 28, color: COLOR.ink });
    this.tick(timer, () => t(war.phase === "battle" ? "guild.war.battleEnds" : "guild.war.prepEnds", { time: hmText(war.endsAt - this.now) }));
    const lines = [
      guild.warScore === null ? t("guild.war.noScore") : t("guild.war.score", { score: guild.warScore.toLocaleString(), rank: guild.warRank ?? "-" }),
      t("guild.war.slots", { count: guildWarTotalSlots(guild.level) }),
      t("guild.war.members", { need: GUILD_WAR_MIN_MEMBERS, count: guild.memberCount }),
    ];
    lines.forEach((line, index) => this.label(v, S.side + 48, P.lines.y + index * P.lines.gap, line, {
      role: "body", size: 30, color: index === 2 && guild.memberCount < GUILD_WAR_MIN_MEMBERS ? COLOR.dangerText : COLOR.ink,
    }));
  }

  private paintGuard(): void {
    const v = this.paintEventPlate(t("guild.page.guard"));
    const element = guildGuardElement(this.now);
    v.add(new AffinityBadge(this, S.side + 84, P.phase + 6, ELEMENT_ICON[element], 84));
    this.label(v, S.side + 150, P.phase, t("guild.guard.boss", { element: t(`element.${element}`) }), { role: "display", size: 40, color: COLOR.accentText });
    const timer = this.label(v, S.side + 48, P.timer, "", { role: "emphasis", size: 28, color: COLOR.ink });
    this.tick(timer, () => t("guild.guard.next", { time: hmText(guildGuardEndsAt(this.now) - this.now) }));
    [t("guild.guard.rule"), t("guild.guard.reward")].forEach((line, index) => this.label(v, S.side + 48, P.lines.y + index * P.lines.gap, line, { role: "body", size: 30, color: COLOR.ink }));
  }

  /* ── 스크롤 목록 ──────────────────────────────────────────────────────── */

  private clip = (): ClipRect => ({ left: S.side, right: S.side + S.width, top: S.body.top, bottom: this.listBottom });
  private canTap = (): boolean => this.dragMoved < TAP_SLOP && !this.busy;

  private mountList(count: number, keep: boolean, build: (row: Phaser.GameObjects.Container, index: number) => void): void {
    const list = this.add.container(BASE_WIDTH / 2, S.body.top);
    this.view.add(list);
    this.list = list;
    for (let index = 0; index < count; index += 1) {
      const row = this.add.container(0, guildRowY(index));
      list.add(row);
      build(row, index);
    }
    const viewport = this.listBottom - S.body.top;
    const maskShape = this.add.rectangle(BASE_WIDTH / 2, S.body.top + viewport / 2, BASE_WIDTH, viewport, 0xffffff).setVisible(false);
    list.setMask(maskShape.createGeometryMask());
    list.once(Phaser.GameObjects.Events.DESTROY, () => { list.clearMask(true); maskShape.destroy(); });
    this.minScroll = guildMinScroll(count, this.listBottom);
    this.scrollOffset = keep ? Phaser.Math.Clamp(this.scrollOffset, this.minScroll, 0) : 0;
    list.y = S.body.top + this.scrollOffset;
  }

  private bindScroll(): void {
    const inside = (pointer: Phaser.Input.Pointer): boolean => pointer.y >= S.body.top && pointer.y <= this.listBottom;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { this.dragMoved = 0; this.dragging = inside(pointer) && !this.popups.isOpen; this.dragLastY = pointer.y; });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const delta = pointer.y - this.dragLastY;
      this.dragLastY = pointer.y; this.dragMoved += Math.abs(delta); this.scrollBy(delta);
    });
    this.input.on("pointerup", () => { this.dragging = false; });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => { if (!this.popups.isOpen) this.scrollBy(-dy * 0.65); });
  }

  private scrollBy(delta: number): void {
    if (!this.list) return;
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + delta, this.minScroll, 0);
    this.list.y = S.body.top + this.scrollOffset;
  }
}
