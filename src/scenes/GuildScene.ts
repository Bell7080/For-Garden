import Phaser from "phaser";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { guildApi } from "../api/guildApi";
import { guildQaClockShift } from "../api/guildQa";
import {
  GuildApiError, isGuildErrorCode, type GuildAttendanceState, type GuildMe, type GuildMemberView, type GuildMembersResponse,
  type GuildStateResponse, type GuildSummary, type GuildGuardBoard, type GuildWarMapSlot, type GuildWarMapState,
} from "../api/guildContracts";
import type { GuildGuardStatusResponse } from "../api/contracts";
import { GUILD_GUARD } from "../core/guildGuard";
import { Button } from "../ui/Button";
import { consumeSceneEntry } from "./sceneEntry";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import {
  GUILD_ATTENDANCE_CYCLE, GUILD_BADGE_CHANGE_GEMS, GUILD_CREATE_GEMS, GUILD_NAME_MAX, GUILD_NAME_MIN, GUILD_NOTICE_MAX,
  guildAttendanceDay, guildCan, guildCanKick, guildLevelProgress, guildLevelUpNotice, guildPerks, validateGuildName, type GuildJoinMode, type GuildRole,
} from "../core/guild";
import {
  DEFAULT_GUILD_BADGE, GUILD_BADGE_COLORS, GUILD_BADGE_COLOR_IDS, GUILD_BADGE_ICONS, GUILD_BADGE_SHAPES, isGuildBadge, type GuildBadge,
} from "../core/guildBadge";
import { guildGuardElement, guildGuardEndsAt, guildPageEventKey, guildPageHasNews, guildWarNow, type GuildPage } from "../core/guildPages";
import { GUILD_WAR_MIN_MEMBERS } from "../core/guildWar";
import { guildAttendanceRace } from "../core/guildRace";
import { isOnline, lastActiveAge } from "../core/social";
import { RELICS } from "../data/relics";
import { setDebugScene } from "../debug";
import { settingsManager } from "../managers/SettingsManager";
import { guildMemberProfileDisplay, playerProfileDisplay } from "../state/playerProfile";
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
import {
  GUILD_ATTENDANCE as A, GUILD_EDITOR as E, guildEditorSpots, guildSwatchSpot, GUILD_INFO as I, GUILD_ROW as R, GUILD_SCREEN as S, guildMinScroll,
  GUILD_WAR_MAP as W, guildPageX, guildRowButtonX, guildRowY, guildStampSlot, guildStampRewardPair, guildTabX, guildWarColumnX, guildWarNodeSpot,
} from "../ui/guildLayout";
import { guildWarSlotLabel } from "../ui/guildWarLabels";
import { chipPoints, drawFrameVignette, drawLayer, drawShapeOutline, HoloBar, HOLO } from "../ui/holo";
import { addBackButton } from "../ui/IconButton";
import { addFramedIcon } from "../ui/itemFrame";
import { PlayerProfilePopup, type ProfileAction } from "../ui/PlayerProfilePopup";
import { PopupLayer } from "../ui/PopupLayer";
import { pressIn, pressOut } from "../ui/pressFeedback";
import { FaceFrame } from "../ui/FaceFrame";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { GUILD_COIN_ICON } from "../ui/priceTag";
import { RailButton } from "../ui/RailButton";
import { openRewardPopup, type RewardPopupItem } from "../ui/RewardPopup";
import { playSceneEntrance, slideTabPage, startScene } from "../ui/screenTransition";
import { addScrollHint } from "../ui/ScrollHint";
import { addSideShopButton } from "../ui/sideShop";
import { squeezeTextToWidth } from "../ui/textFit";
import { TextInputField } from "../ui/TextInputField";
import { TopBar } from "../ui/TopBar";
import { GUILD_COIN_TEXT } from "../ui/topBarSlots";
import { COLOR, textStyle } from "../ui/theme";

type GuildTab = "info" | "members";
type GuardTab = "members" | "guilds";
const GUARD_TABS = [
  { key: "members", labelKey: "guild.guard.tab.members" },
  { key: "guilds", labelKey: "guild.guard.tab.guilds" },
] as const;
/** 수호전 순위 줄 안의 자리 — 줄 가운데가 0이다. 등수가 맨 왼쪽, 그 오른쪽에 얼굴·뱃지가 선다. */
const GUARD_ROW = { rankX: -420, faceX: -320, faceSize: 96, textX: -250 } as const;
/** 수호전 쪽 위의 두 줄 — 그날 속성 · 초기화 시각, 남은 도전 · 오늘 최고와 출격 버튼. */
const GUARD_HEAD = { start: { width: 280, height: 80 } } as const;
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
/** 방어진 지도의 칸 결 — 우두머리 금빛, 정예 보랏빛. 일반 칸은 판 결 그대로다. */
const WAR_BOSS_EDGE = 0xf2c14e;
const WAR_ELITE_EDGE = 0xb48cff;

/** 길드 코인의 결 — 코인 일러스트의 금빛. 상단 줄 칸과 같은 값을 읽는다. */
const COIN_TEXT = GUILD_COIN_TEXT;

const hmText = (ms: number): string => {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes >= 60 ? t("guild.time.hm", { h: Math.floor(minutes / 60), m: minutes % 60 }) : t("guild.time.m", { m: minutes });
};

/** 출석 한 날의 보상 그림과 수 — 판과 영수증이 같은 표(`GUILD_ATTENDANCE_CYCLE`)를 읽는다. */
/** 그 레벨의 혜택 문구 — 정보 탭과 레벨업 창이 같은 줄을 읽는다. */
function guildPerkLines(level: number): string[] {
  const perks = guildPerks(level);
  return [
    perks.excavationBonusPercent > 0 ? t("guild.info.perkExcavation", { value: perks.excavationBonusPercent }) : "",
    perks.dispatchTimeReductionPercent > 0 ? t("guild.info.perkDispatch", { value: perks.dispatchTimeReductionPercent }) : "",
    perks.shopSlots > 3 ? t("guild.info.perkShop") : "",
  ].filter(Boolean);
}

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
  private guardTab: GuardTab = "members";
  private guardBoard?: GuildGuardBoard;
  private guardStatus?: GuildGuardStatusResponse;
  private warMap?: GuildWarMapState;
  /** 방어덱을 막 배치하고 돌아왔으면 한 번 알린다. */
  private entryToast = false;
  /** 들어올 때 열 큰 탭 — 수호전 결과판에서 돌아오면 수호전 쪽이 바로 선다. */
  private entryPage: GuildPage = "info";
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
  private backdrop?: Phaser.GameObjects.Image;
  private backdropKey: string = BACKGROUND.guild;

  constructor() { super("guild"); }

  init(data?: { page?: unknown; toast?: unknown }): void {
    this.entryPage = data?.page === "guard" || data?.page === "war" ? data.page : "info";
    this.entryToast = data?.toast === "placed";
    consumeSceneEntry(this);
  }

  create(): void {
    setDebugScene("guild");
    this.state = undefined; this.members = undefined; this.browse = []; this.query = ""; this.page = this.entryPage; this.tab = "info";
    this.guardTab = "members"; this.guardBoard = undefined; this.guardStatus = undefined; this.warMap = undefined;
    this.browsing = false; this.stampChecked = false; this.list = undefined; this.scrollOffset = 0; this.minScroll = 0; this.busy = false;
    this.ticker = undefined;
    this.backdropKey = this.page === "war" ? BACKGROUND.guildWar : this.page === "guard" ? BACKGROUND.guildGuard : BACKGROUND.guild;
    this.backdrop = addSceneBackground(this, this.backdropKey);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.50).setDepth(-29);
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
  private get now(): number { return Date.now() + this.clockOffset + guildQaClockShift(); }
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
      else if (this.page === "guard") [this.guardBoard, this.guardStatus] = await Promise.all([guildApi.getGuard(), gameApi.getGuildGuard()]);
      else if (this.page === "war") this.warMap = await guildApi.getWarMap();
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
    else if (this.announceLevelUp()) return;
    else if (this.entryToast) { this.entryToast = false; this.toast(t("guild.war.placedToast"), "unlocked"); }
  }

  /* ── 그리기 ───────────────────────────────────────────────────────────── */

  private paint(keep = false): void {
    const backdrop = this.inGuild && !this.browsing
      ? this.page === "war" ? BACKGROUND.guildWar : this.page === "guard" ? BACKGROUND.guildGuard : BACKGROUND.guild
      : BACKGROUND.guild;
    if (backdrop !== this.backdropKey) {
      this.backdrop?.destroy();
      this.backdropKey = backdrop;
      this.backdrop = addSceneBackground(this, backdrop);
    }
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

    const perkLines = guildPerkLines(guild.level);
    (perkLines.length > 0 ? perkLines : [t("guild.info.perkNone")]).forEach((line, index) => this.label(v, I.left, I.perks.y + index * I.perks.gap, line, { role: "emphasis", size: 30, color: COLOR.accentText }));

    this.plate(v, I.left + I.width / 2, I.notice.y + I.notice.height / 2, I.width, I.notice.height);
    const notice = guild.notice || t("guild.info.noticeEmpty");
    v.add(this.add.text(I.left + 36, I.notice.y + 36, notice, textStyle({ role: "body", size: 30, color: guild.notice ? COLOR.ink : COLOR.inkDim, wrap: I.width - 72 })).setOrigin(0, 0));

    this.paintMyCard(v, me);

    const buttons: { label: string; run: () => void }[] = [];
    if (guildCan(me.role, "notice") || guildCan(me.role, "joinMode")) buttons.push({ label: t("guild.info.settings"), run: () => this.openSettings() });
    if (guildCan(me.role, "badge")) buttons.push({ label: t("guild.badge.apply"), run: () => this.openEditor("badge") });
    buttons.forEach((button, index) => {
      const x = I.left + I.actions.width / 2 + index * (I.actions.width + I.actions.gap);
      addRowButton(this, v, x, I.actions.y, I.actions.width, I.actions.height, button.label, "neutral", () => FULL_CLIP, () => true, button.run);
    });
  }

  /**
   * 길드 전용 플레이어 카드 — 길드 안의 나를 한 장으로 말한다. 왼쪽에 얼굴·테두리(상단 줄·프로필 카드와 같은 `ProfileAvatar`),
   * 그 옆에 이름·연구원 레벨과 직책 칩, 오른쪽 끝에 이번 주 기여도(큰 수) · 누적 · 보유 길드 코인이 선다.
   * 이름·얼굴은 내 프로필에서, 직책·기여·코인은 길드원 행(`GuildMe`)에서 온다.
   */
  private paintMyCard(v: Phaser.GameObjects.Container, me: GuildMe): void {
    const C = I.card, profile = playerProfileDisplay(session);
    const cy = C.y + C.height / 2, left = I.left, right = I.left + I.width;
    this.plate(v, left + I.width / 2, cy, I.width, C.height, COLOR.accent);
    v.add(new ProfileAvatar(this, left + 28 + C.avatar / 2 + 8, cy, { size: C.avatar, frameId: profile.frameId, portraitAssetId: profile.avatar?.portraitAssetId, fallback: Array.from(profile.displayName.trim())[0] ?? "?" }));
    const textX = left + 28 + C.avatar + 52, statX = right - 34;
    const nameRoom = statX - 250 - textX;
    v.add(squeezeTextToWidth(this.add.text(textX, cy - 40, profile.displayName, textStyle({ role: "display", size: 38 })).setOrigin(0, 0.5), nameRoom));
    this.label(v, textX, cy + 6, t("friends.researchLevel", { level: profile.level }), { role: "emphasis", size: 26, color: COLOR.ink });
    const leader = me.role === "leader", tone = leader ? 0xf2c14e : COLOR.accent;
    const roleText = this.add.text(0, 0, t(`guild.role.${me.role}`), textStyle({ role: "emphasis", size: 26, color: hex(tone) })).setOrigin(0.5);
    const chipW = Math.max(130, roleText.displayWidth + 44), chipH = 46;
    this.plate(v, textX + chipW / 2, cy + 52, chipW, chipH, tone);
    roleText.setPosition(textX + chipW / 2, cy + 52);
    v.add(roleText);
    this.label(v, statX, cy - 54, t("guild.members.week"), { role: "body", size: 24, color: COLOR.inkDim }, [1, 0.5]);
    this.label(v, statX, cy - 12, me.contributionWeek.toLocaleString(), { role: "display", size: 50, color: COLOR.accentText }, [1, 0.5]);
    this.label(v, statX, cy + 28, t("guild.members.total", { value: me.contributionTotal.toLocaleString() }), { role: "body", size: 24, color: COLOR.ink }, [1, 0.5]);
    const coin = this.label(v, statX, cy + 66, me.coin.toLocaleString(), { role: "emphasis", size: 30, color: COIN_TEXT }, [1, 0.5]);
    v.add(this.add.image(statX - coin.displayWidth - 24, cy + 66, GUILD_COIN_ICON).setDisplaySize(40, 40));
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
  /** 길드 레벨이 오른 뒤 처음 들어오면 한 번 알린다 — 새로 열리거나 커진 혜택만 적는다. 띄웠으면 true. */
  private announceLevelUp(): boolean {
    const guild = this.state?.guild;
    if (!guild || this.popups.isOpen) return false;
    const notice = guildLevelUpNotice(settingsManager.get().game.guildLevelSeen, guild.id, guild.level);
    settingsManager.rememberGuildLevel(notice.key);
    if (notice.from === null) return false;
    const before = new Set(guildPerkLines(notice.from));
    const gained = guildPerkLines(guild.level).filter((line) => !before.has(line));
    this.popups.confirm({
      title: t("guild.levelUp.title"),
      message: [t("guild.levelUp.message", { level: guild.level }), ...gained].join("\n"),
      confirmLabel: t("guild.levelUp.ok"), cancelLabel: false,
    });
    return true;
  }

  private openStampBoard(attendance: GuildAttendanceState): void {
    if (this.popups.isOpen) return;
    this.busy = true;
    const today = attendance.day;
    // 고를 것이 없는 판이라 X를 두지 않는다 — 도장이 찍히면 영수증으로, 실패하면 오류로 저절로 닫힌다.
    this.popups.open({ width: A.width, height: A.height, title: t("guild.attendance.title"), closeOnBackdrop: false, hideCloseButton: true, dim: true, onClose: () => { this.busy = false; } }, (body, close) => {
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
        // 그날 보상 액자 + 길드 코인 액자 — 코인도 글이 아니라 같은 액자 양식으로 붙인다.
        const reward = attendanceRewardIcon(number);
        const pair = guildStampRewardPair(slot.width, last);
        addFramedIcon(this, cell, pair.mainX, 8, pair.mainSize, reward.texture, { amount: reward.amount.toLocaleString(), plain: true });
        this.label(cell, pair.plusX, 8, "+", { role: "display", size: 30, color: COIN_TEXT }, [0.5, 0.5]);
        addFramedIcon(this, cell, pair.coinX, 8, pair.coinSize, GUILD_COIN_ICON, { amount: day.coin.toLocaleString(), plain: true });
        this.label(cell, 0, slot.height / 2 - 26, t("guild.attendance.cellGain", { contribution: day.contribution }), { role: "emphasis", size: 20, color: COLOR.inkDim }, [0.5, 0.5]);
        if (number <= attendance.filled) body.add(addAttendanceStamp(this, slot.x, slot.y + 8, A.stampSize, COLOR.accent).setAlpha(0.92));
      });
      const regular = GUILD_ATTENDANCE_CYCLE[0], final = GUILD_ATTENDANCE_CYCLE[GUILD_ATTENDANCE_CYCLE.length - 1];
      this.label(body, 0, A.info, t("guild.attendance.gain", { contribution: regular.contribution, finalContribution: final.contribution }), { role: "body", size: 24, color: COLOR.inkDim, align: "center", wrap: A.width - 80 }, [0.5, 0.5]);

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
    const creating = mode === "create";
    const guild = this.state?.guild;
    const badge: GuildBadge = { ...(!creating && guild ? guild.badge : DEFAULT_GUILD_BADGE) };
    let joinMode: GuildJoinMode = "open";
    let field: keyof GuildBadge = "shape";
    const free = !creating && guild?.badgeFree === true;
    const P = guildEditorSpots(creating);
    const cost = creating ? GUILD_CREATE_GEMS : free ? 0 : GUILD_BADGE_CHANGE_GEMS;
    this.popups.open({ width: E.width, height: P.height, title: t(creating ? "guild.create.title" : "guild.badge.title"), closeOnBackdrop: false, dim: true, backButton: true }, (body, close) => {
      const left = -E.inner / 2;

      // ── 문장 무대 — 정보 탭 머리와 같은 문법(왼쪽 큰 배지, 오른쪽 이름·레벨·가입 방식). 고른 값이 곧바로 여기 선다.
      const stageShape = chipPoints(E.inner, E.stage.height, { bevel: { topLeft: E.stage.bevel, bottomRight: E.stage.bevel } });
      body.add(drawLayer(this, 0, P.stage, stageShape, { fill: 0x0b1017, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.55 }));
      body.add(drawFrameVignette(this, 0, P.stage, E.inner, E.stage.height, { strength: 0.45 }));
      const halo = this.add.graphics();
      body.add(halo);
      let preview: Phaser.GameObjects.Container | undefined;
      const nameText = this.label(body, E.stage.textX, P.stage - 34, "", { role: "display", size: 46 }, [0, 0.5]);
      const subText = this.label(body, E.stage.textX, P.stage + 34, "", { role: "emphasis", size: 28, color: COLOR.accentText }, [0, 0.5]);
      const paintStage = (): void => {
        preview?.destroy();
        halo.clear();
        // 배지 뒤에 바탕색을 옅게 번지게 깔아 무대가 고른 색으로 물든다(겹쳐 밝아지는 합성은 쓰지 않는다).
        const color = GUILD_BADGE_COLORS[badge.shapeColor];
        for (let i = 4; i >= 1; i -= 1) {
          const r = E.stage.badge * (0.38 + i * 0.07);
          halo.fillStyle(color, 0.05).fillPoints([{ x: E.stage.badgeX, y: P.stage - r }, { x: E.stage.badgeX + r, y: P.stage }, { x: E.stage.badgeX, y: P.stage + r }, { x: E.stage.badgeX - r, y: P.stage }], true);
        }
        preview = addGuildBadge(this, body, E.stage.badgeX, P.stage, badge, E.stage.badge);
        const typed = creating ? (input?.value ?? "").trim() : guild?.name ?? "";
        nameText.setText(typed || t("guild.create.nameLabel")).setColor(typed ? COLOR.ink : COLOR.inkDim);
        squeezeTextToWidth(nameText, E.inner / 2 - E.stage.textX - 30);
        subText.setText(`${t("guild.levelShort", { level: guild?.level ?? 1 })} · ${t(`guild.joinMode.${creating ? joinMode : guild?.joinMode ?? "open"}`)}`);
      };

      // ── 이름 · 가입 방식 (만들기만)
      let input: TextInputField | undefined;
      if (creating) {
        this.label(body, left, P.nameLabel!, t("guild.create.nameLabel"), { role: "emphasis", size: 28, color: COLOR.accentText }, [0, 0.5]);
        this.label(body, -left, P.nameLabel!, t("guild.create.nameRule", { min: GUILD_NAME_MIN, max: GUILD_NAME_MAX }), { role: "body", size: 24, color: COLOR.inkDim }, [1, 0.5]);
        input = new TextInputField(this, 0, P.nameInput!, { width: E.inner, height: E.input.height, value: "", maxGlyphs: GUILD_NAME_MAX, ariaLabel: t("guild.create.nameAria"), fontSize: 32, onChange: () => paintStage() });
        body.add(input);
        this.label(body, left, P.joinLabel!, t("guild.create.joinLabel"), { role: "emphasis", size: 28, color: COLOR.accentText }, [0, 0.5]);
        const joinChips: Phaser.GameObjects.Container[] = [];
        const paintJoin = (): void => {
          joinChips.splice(0).forEach((chip) => chip.destroy());
          (["open", "approval"] as const).forEach((m, index) => joinChips.push(this.addEditorOption(body, (index - 0.5) * (E.join.width + 20), P.join!, E.join.width, E.join.height,
            t(`guild.joinMode.${m}`), joinMode === m, () => { joinMode = m; paintJoin(); paintStage(); })));
        };
        paintJoin();
      }
      paintStage();

      // ── 배지 공방 — 네 갈래 전환 라벨, 그 아래 고를 견본이 실제 배지로 늘어선다(고른 값을 바꿔 끼운 모습).
      const tabs = this.add.container(0, 0);
      const grid = this.add.container(0, 0);
      body.add([grid, tabs]);
      const tabWidth = (E.inner - E.tabs.gap * (BADGE_CHOICES.length - 1)) / BADGE_CHOICES.length;
      const paintWorkshop = (): void => {
        tabs.removeAll(true);
        BADGE_CHOICES.forEach((choice, index) => addCategoryTab(this, tabs, {
          x: left + tabWidth / 2 + index * (tabWidth + E.tabs.gap), y: P.tabs, width: tabWidth, height: E.tabs.height,
          label: t(choice.labelKey), selected: field === choice.field, face: "down", labelSize: E.tabs.labelSize,
          onSelect: () => { if (field === choice.field) return; field = choice.field; paintWorkshop(); },
        }));
        grid.removeAll(true);
        const choice = BADGE_CHOICES.find((c) => c.field === field)!;
        const values: readonly GuildBadge[keyof GuildBadge][] = choice.values;
        values.forEach((value, index) => {
          const spot = guildSwatchSpot(index, values.length, P.gridTop);
          const candidate = { ...badge, [field]: value } as GuildBadge;
          const selected = badge[field] === value;
          const allowed = isGuildBadge(candidate);
          grid.add(this.addBadgeSwatch(spot.x, spot.y, candidate, selected, allowed, () => {
            Object.assign(badge, { [field]: value });
            paintWorkshop(); paintStage();
          }));
        });
      };
      paintWorkshop();

      // ── 확정 — 값은 상점 결제처럼 버튼 판 안에 박는다(첫 배지 변경은 「무료」 표). 취소는 판 밖 우하단 뒤로가기다.
      body.add(new Button(this, 0, P.submit, {
        width: E.submit.width, height: E.submit.height, fontSize: 34, variant: "primary",
        label: t(creating ? "guild.create.submit" : "guild.badge.apply"),
        ...(free ? { tag: t("product.price.free"), ribbon: t("guild.badge.firstFree") } : { cost: { icon: CURRENCY_ICON_BY_WALLET.gems, amount: cost, affordable: session.wallet.gems >= cost } }),
        onClick: () => {
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
        const current = guild?.badge;
        if (current && current.shape === badge.shape && current.shapeColor === badge.shapeColor && current.icon === badge.icon && current.iconColor === badge.iconColor) { this.toast(t("guild.badge.same")); return; }
        const change = (): void => { void this.act(() => gameApi.changeGuildBadge({ badge: { ...badge } }), () => { close(); this.toast(t("guild.badge.done"), "unlocked"); }); };
        if (free) { change(); return; }
        this.popups.confirm({
          title: t("guild.badge.confirmTitle"), message: t("guild.badge.confirmMessage"), confirmLabel: t("guild.badge.apply"),
          costs: [{ iconKey: CURRENCY_ICON_BY_WALLET.gems, amount: GUILD_BADGE_CHANGE_GEMS }],
          balance: { iconKey: CURRENCY_ICON_BY_WALLET.gems, before: session.wallet.gems, after: session.wallet.gems - GUILD_BADGE_CHANGE_GEMS },
        }, change);
      } }));
    });
  }

  /** 고르는 칸 한 장 — 깎인 칩 위에 글자. 고른 것은 강조색 외곽선과 짙은 면, 나머지는 눌린 유리. 배지 견본 칸과 같은 결이다. */
  private addEditorOption(parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number, label: string, selected: boolean, onTap: () => void): Phaser.GameObjects.Container {
    const node = this.add.container(x, y);
    const shape = chipPoints(width, height, { bevel: { topLeft: 16, bottomRight: 16 } });
    node.add(drawLayer(this, 0, 0, shape, { fill: selected ? 0x27313b : 0x0c1118, alpha: 0.96 }));
    node.add(drawShapeOutline(this, 0, 0, shape, { color: selected ? COLOR.accent : 0x536170, alpha: selected ? 1 : 0.45, width: selected ? 4 : 2 }));
    node.add(squeezeTextToWidth(this.add.text(0, 1, label, textStyle({ role: "emphasis", size: 30, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5), width - 24));
    parent.add(node);
    const hit = addClippedHit(this, node, 0, 0, width, height, () => FULL_CLIP);
    hit.on("pointerdown", () => pressIn(node));
    hit.on("pointerout", () => pressOut(node, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(node); onTap(); });
    return node;
  }

  /** 배지 견본 한 칸 — 지금 배지에서 그 값만 바꿔 끼운 실제 배지가 선다. 바탕색과 문양색이 같아지는 견본은 흐리고 눌리지 않는다. */
  private addBadgeSwatch(x: number, y: number, candidate: GuildBadge, selected: boolean, allowed: boolean, onTap: () => void): Phaser.GameObjects.Container {
    const { size, badge: badgeSize } = E.swatch;
    const node = this.add.container(x, y);
    const shape = chipPoints(size, size, { bevel: { topLeft: 18, bottomRight: 18 } });
    node.add(drawLayer(this, 0, 0, shape, { fill: selected ? 0x27313b : 0x0c1118, alpha: 0.96 }));
    node.add(drawShapeOutline(this, 0, 0, shape, { color: selected ? COLOR.accent : 0x536170, alpha: selected ? 1 : 0.4, width: selected ? 4 : 2 }));
    addGuildBadge(this, node, 0, 0, candidate, badgeSize);
    node.setAlpha(allowed ? 1 : 0.3);
    if (!allowed) return node;
    const hit = addClippedHit(this, node, 0, 0, size, size, () => FULL_CLIP);
    hit.on("pointerdown", () => pressIn(node));
    hit.on("pointerout", () => pressOut(node, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(node); if (!selected) onTap(); });
    return node;
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

  /**
   * 길드전 쪽 — 위 두 줄에 지금 국면·남은 시간과 길드전 점수·배치 현황이 서고, 본문에 **방어진 지도**가 선다. 지부 셋이
   * 기둥 셋이고 기둥마다 우두머리 → 정예 둘 → 일반 칸이다. 정비일에 빈 칸을 누르면 그 칸의 방어덱 편성이 열리고, 찬 칸을
   * 누르면 그 덱을 보는 쪽지가 뜬다. 전투일에는 지도를 고칠 수 없다.
   */
  private paintWar(): void {
    const guild = this.state!.guild!;
    const war = guildWarNow(this.now);
    const battle = war.phase === "battle";
    this.label(this.controls, S.side, S.summary.y, t(battle ? "guild.war.battle" : "guild.war.prep"), { role: "display", size: 40, color: battle ? COLOR.dangerText : COLOR.accentText });
    const timer = this.label(this.controls, S.side + S.width, S.summary.y, "", { role: "body", size: 26, color: COLOR.inkDim }, [1, 0.5]);
    this.tick(timer, () => t(battle ? "guild.war.battleEnds" : "guild.war.prepEnds", { time: hmText(war.endsAt - this.now) }));
    this.label(this.controls, S.side, S.controls.y, guild.warScore === null ? t("guild.war.noScore") : t("guild.war.score", { score: guild.warScore.toLocaleString(), rank: guild.warRank ?? "-" }), { role: "emphasis", size: 28, color: COLOR.ink });
    const map = this.warMap;
    if (map) {
      const placed = map.slots.filter(({ holder }) => holder).length;
      this.label(this.controls, S.side + S.width, S.controls.y, t("guild.war.placed", { count: placed, total: map.slots.length }), { role: "emphasis", size: 28, color: COLOR.accentText }, [1, 0.5]);
    }
    this.label(this.controls, BASE_WIDTH / 2, W.note, t("guild.war.members", { need: GUILD_WAR_MIN_MEMBERS, count: guild.memberCount }), {
      role: "body", size: 28, color: guild.memberCount < GUILD_WAR_MIN_MEMBERS ? COLOR.dangerText : COLOR.inkDim,
    }, [0.5, 0.5]);
    if (map) this.paintWarMap(map);
  }

  private paintWarMap(map: GuildWarMapState): void {
    const v = this.view;
    const { width, top, bottom } = W.column;
    for (const branch of [1, 2, 3] as const) {
      const x = guildWarColumnX(branch);
      this.plate(v, x, (top + bottom) / 2, width, bottom - top);
      this.label(v, x, W.header, t("guild.war.branch", { n: branch }), { role: "display", size: 34, color: COLOR.ink }, [0.5, 0.5]);
      // 우두머리 → 정예 → 일반 칸으로 내려가는 줄기. 칸보다 뒤에 옅게 긋는다.
      const lines = this.add.graphics().lineStyle(3, COLOR.accent, 0.28);
      const boss = guildWarNodeSpot({ branch, kind: "boss", index: 0 });
      for (const index of [0, 1]) {
        const elite = guildWarNodeSpot({ branch, kind: "elite", index });
        lines.lineBetween(boss.x, boss.y + boss.size / 2, elite.x, elite.y - elite.size / 2);
        if (map.slots.some((slot) => slot.branch === branch && slot.kind === "grunt" && slot.index === index)) {
          const grunt = guildWarNodeSpot({ branch, kind: "grunt", index });
          lines.lineBetween(elite.x, elite.y + elite.size / 2 + W.nameGap + 18, grunt.x, grunt.y - grunt.size / 2);
        }
      }
      v.add(lines);
    }
    for (const slot of map.slots) this.paintWarNode(v, map, slot);
  }

  private paintWarNode(v: Phaser.GameObjects.Container, map: GuildWarMapState, slot: GuildWarMapSlot): void {
    const { x, y, size } = guildWarNodeSpot(slot);
    const node = this.add.container(x, y);
    v.add(node);
    const edge = slot.kind === "boss" ? WAR_BOSS_EDGE : slot.kind === "elite" ? WAR_ELITE_EDGE : undefined;
    const holder = slot.holder;
    if (holder) {
      if (edge !== undefined) this.plate(node, 0, 0, size + 12, size + 12, edge);
      const relic = RELICS.find((candidate) => candidate.id === holder.avatarRelicId);
      node.add(new ProfileAvatar(this, 0, 0, { size: Math.round(size * 0.8), frameId: holder.frameId, portraitAssetId: relic?.portraitAssetId, fallback: Array.from(holder.name.trim())[0] ?? "?" }));
    } else {
      this.plate(node, 0, 0, size, size, edge);
      const open = map.phase === "prep";
      this.label(node, 0, 0, "+", { role: "display", size: Math.round(size * 0.46), color: open ? COLOR.accentText : COLOR.inkDim }, [0.5, 0.5]);
    }
    const name = holder ? holder.name : t(`guild.war.kind.${slot.kind}`);
    const caption = this.label(node, 0, size / 2 + W.nameGap, name, {
      role: holder ? "emphasis" : "body", size: slot.kind === "grunt" ? 20 : 24, color: holder?.isMe ? COLOR.accentText : holder ? COLOR.ink : COLOR.inkDim,
    }, [0.5, 0.5]);
    squeezeTextToWidth(caption, slot.kind === "grunt" ? 116 : slot.kind === "elite" ? 128 : 260);
    // 지도 판 안에서만 손을 받는다 — 이 화면은 목록을 마스크로 자르므로 입력면을 직접 달지 않는다.
    const hit = addClippedHit(this, node, 0, 0, size + 16, size + 16,
      () => ({ left: 0, right: BASE_WIDTH, top: W.column.top, bottom: W.column.bottom }), { useHandCursor: true });
    hit.on("pointerdown", () => pressIn(node));
    hit.on("pointerout", () => pressOut(node, "normal", { pop: false }));
    hit.on("pointerup", () => {
      pressOut(node);
      if (!this.canTap() || this.popups.isOpen) return;
      if (holder) this.openWarSlot(map, slot);
      else if (map.phase !== "prep") this.toast(t("guild.error.WAR_LOCKED"));
      else this.openWarDefense(map, slot.id);
    });
  }

  /** 그 칸의 방어덱 편성을 연다. 이미 다른 칸을 맡았으면 그 덱에서 시작해 옮긴다. */
  private openWarDefense(map: GuildWarMapState, slotId: string): void {
    const mine = map.slots.find(({ id }) => id === map.mySlotId);
    startScene(this, "party", { content: "guildWarDefense", slotId, deck: mine?.deck.map(({ relicId }) => relicId) ?? [] });
  }

  /** 찬 칸의 쪽지 — 맡은 길드원과 그 덱, 정비일이면 다시 편성·비우기. */
  private openWarSlot(map: GuildWarMapState, slot: GuildWarMapSlot): void {
    const holder = slot.holder!;
    const prep = map.phase === "prep";
    const actions: { label: string; tone: RowButtonTone; run: () => void }[] = [];
    if (prep && holder.isMe) actions.push({ label: t("guild.war.slot.replace"), tone: "accent", run: () => this.openWarDefense(map, slot.id) });
    if (prep && (holder.isMe || map.canArrange)) actions.push({ label: t("guild.war.slot.clear"), tone: "danger", run: () => { void this.act(() => guildApi.clearWarSlot(slot.id)); } });
    const height = 560 + (actions.length > 0 ? 120 : 0);
    this.popups.open({ width: 760, height, title: guildWarSlotLabel(slot.id), closeOnBackdrop: true, dim: true }, (body, close) => {
      const top = -height / 2;
      const relic = RELICS.find((candidate) => candidate.id === holder.avatarRelicId);
      body.add(new ProfileAvatar(this, -260, top + 170, { size: 96, frameId: holder.frameId, portraitAssetId: relic?.portraitAssetId, fallback: Array.from(holder.name.trim())[0] ?? "?" }));
      body.add(squeezeTextToWidth(this.add.text(-180, top + 150, holder.name, textStyle({ role: "display", size: 36, color: holder.isMe ? COLOR.accentText : COLOR.ink })).setOrigin(0, 0.5), 480));
      this.label(body, -180, top + 200, t("friends.researchLevel", { level: holder.level }), { role: "emphasis", size: 26, color: COLOR.accentText });
      slot.deck.forEach((entry, index) => {
        const def = RELICS.find((candidate) => candidate.id === entry.relicId);
        const fx = (index - 1) * 200;
        if (def) body.add(new FaceFrame(this, fx, top + 340, { portraitAssetId: def.portraitAssetId, size: 150, amount: `LV.${entry.level}` }));
      });
      this.label(body, 0, top + 470, t("guild.war.slot.power", { power: slot.power.toLocaleString() }), { role: "emphasis", size: 30, color: COLOR.ink }, [0.5, 0.5]);
      const width = actions.length > 1 ? 300 : 420;
      actions.forEach((action, index) => {
        const bx = actions.length > 1 ? (index === 0 ? -170 : 170) : 0;
        addRowButton(this, body, bx, top + 570, width, 86, action.label, action.tone, () => FULL_CLIP, () => true, () => { close(); action.run(); });
      });
    });
  }

  /**
   * 수호전 쪽 — 위 두 줄에 그날 몰려올 적의 속성·초기화 시각, 남은 도전·오늘 최고와 출격 버튼이 서고, 아래 목록이
   * 길드 안 순위(오늘 최고 점수) 또는 길드 순위(길드원 최고 점수의 합)를 흐른다. 작은 탭이 두 목록을 가른다.
   */
  private paintGuard(): void {
    this.listBottom = S.body.bottom;
    const status = this.guardStatus, board = this.guardBoard;
    const element = status?.element ?? guildGuardElement(this.now);
    this.controls.add(new AffinityBadge(this, S.side + 30, S.summary.y, ELEMENT_ICON[element as keyof typeof ELEMENT_ICON], 60, 0.7));
    this.label(this.controls, S.side + 74, S.summary.y, t("guild.guard.today", { element: t(`element.${element}`) }), { role: "display", size: 34, color: COLOR.dangerText });
    const timer = this.label(this.controls, S.side + S.width, S.summary.y, "", { role: "body", size: 26, color: COLOR.inkDim }, [1, 0.5]);
    this.tick(timer, () => t("guild.guard.next", { time: hmText(guildGuardEndsAt(this.now) - this.now) }));
    if (status) {
      this.label(this.controls, S.side, S.controls.y, t("guild.guard.status", { left: status.attemptsLeft, total: GUILD_GUARD.attemptsPerDay, best: status.best.toLocaleString() }), { role: "emphasis", size: 28, color: COLOR.ink });
      const { width, height } = GUARD_HEAD.start;
      const start = new Button(this, S.side + S.width - width / 2, S.controls.y, {
        width, height, label: t("guild.guard.start"), fontSize: 32, variant: "primary",
        onClick: () => {
          if (this.busy || status.attemptsLeft <= 0) return;
          startScene(this, "party", { content: "guildGuard", element });
        },
      });
      start.setEnabled(status.attemptsLeft > 0);
      this.controls.add(start);
    }
    GUARD_TABS.forEach(({ key, labelKey }, index) => {
      addCategoryTab(this, this.tabRow, {
        x: guildTabX(index), y: S.tabs.y, width: S.tabs.width, height: S.tabs.height, label: t(labelKey), selected: this.guardTab === key,
        onSelect: () => {
          if (this.guardTab === key || this.busy) return;
          const from = GUARD_TABS.findIndex((candidate) => candidate.key === this.guardTab);
          this.guardTab = key;
          this.view.removeAll(true);
          this.paintGuardList(false);
          slideTabPage(this, [this.view], from, index);
        },
      });
    });
    if (board) this.paintGuardList(false);
  }

  /** 수호전 순위 목록. 아직 아무도 막지 않은 날은 빈 목록 대신 한 줄 안내만 선다. */
  private paintGuardList(keep: boolean): void {
    const board = this.guardBoard;
    if (!board) return;
    const rows = this.guardTab === "members" ? board.members : board.guilds;
    if (rows.length === 0) {
      this.label(this.view, BASE_WIDTH / 2, S.body.top + 120, t("guild.guard.empty"), { role: "body", size: 30, color: COLOR.inkDim }, [0.5, 0.5]);
      return;
    }
    const mine = this.guardTab === "guilds" && board.mine && !board.guilds.some((entry) => entry.isMine) ? board.mine : undefined;
    if (mine) this.listBottom = S.body.bottom - S.row.height - S.row.gap;
    this.mountList(rows.length, keep, (row, index) => {
      if (this.guardTab === "members") this.paintGuardMemberRow(row, board.members[index]);
      else this.paintGuardGuildRow(row, board.guilds[index]);
    });
    if (mine) {
      // 내 길드가 위 50길드 밖이면 목록 아래에 붙박아 둔다.
      const row = this.add.container(BASE_WIDTH / 2, this.listBottom + S.row.gap + S.row.height / 2);
      this.view.add(row);
      this.paintGuardGuildRow(row, mine);
    }
  }

  private guardRank(row: Phaser.GameObjects.Container, rank: number): void {
    const medal = rank === 1 ? "#f2c14e" : rank === 2 ? "#d7dde6" : rank === 3 ? "#d19a66" : COLOR.ink;
    this.label(row, GUARD_ROW.rankX, 0, String(rank), { role: "display", size: rank <= 3 ? 44 : 36, color: medal }, [0.5, 0.5]);
  }

  private paintGuardMemberRow(row: Phaser.GameObjects.Container, entry: GuildGuardBoard["members"][number]): void {
    this.plate(row, 0, 0, S.width, S.row.height - 4, entry.isMe ? COLOR.accent : undefined);
    this.guardRank(row, entry.rank);
    const relic = RELICS.find((candidate) => candidate.id === entry.avatarRelicId);
    row.add(new ProfileAvatar(this, GUARD_ROW.faceX, 0, { size: GUARD_ROW.faceSize, frameId: entry.frameId, portraitAssetId: relic?.portraitAssetId, fallback: Array.from(entry.name.trim())[0] ?? "?" }));
    const right = S.width / 2 - 36;
    row.add(squeezeTextToWidth(this.add.text(GUARD_ROW.textX, -20, entry.name, textStyle({ role: "display", size: 34 })).setOrigin(0, 0.5), right - 260 - GUARD_ROW.textX));
    this.label(row, GUARD_ROW.textX, 28, t("friends.researchLevel", { level: entry.level }), { role: "emphasis", size: 26, color: COLOR.accentText });
    this.label(row, right, 0, entry.score.toLocaleString(), { role: "display", size: 42, color: COLOR.accentText }, [1, 0.5]);
  }

  private paintGuardGuildRow(row: Phaser.GameObjects.Container, entry: GuildGuardBoard["guilds"][number]): void {
    this.plate(row, 0, 0, S.width, S.row.height - 4, entry.isMine ? COLOR.accent : undefined);
    this.guardRank(row, entry.rank);
    addGuildBadge(this, row, GUARD_ROW.faceX, 0, entry.badge, GUARD_ROW.faceSize);
    const right = S.width / 2 - 36;
    row.add(squeezeTextToWidth(this.add.text(GUARD_ROW.textX, -20, entry.name, textStyle({ role: "display", size: 34 })).setOrigin(0, 0.5), right - 260 - GUARD_ROW.textX));
    this.label(row, GUARD_ROW.textX, 28, t("guild.levelShort", { level: entry.level }), { role: "emphasis", size: 26, color: COLOR.accentText });
    this.label(row, right, 0, entry.score.toLocaleString(), { role: "display", size: 42, color: COLOR.accentText }, [1, 0.5]);
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
    addScrollHint(this, undefined, { x: BASE_WIDTH / 2, y: S.body.top + viewport / 2, width: BASE_WIDTH, height: viewport, depth: 45, owner: list, read: () => ({ offset: this.scrollOffset, min: this.minScroll }) });
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
