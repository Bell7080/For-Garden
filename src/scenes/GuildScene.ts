import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { guildApi } from "../api/guildApi";
import {
  GuildApiError, isGuildErrorCode, type GuildAttendanceState, type GuildMemberView, type GuildMembersResponse, type GuildShopState,
  type GuildStateResponse, type GuildSummary,
} from "../api/guildContracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import {
  GUILD_ATTENDANCE_GAIN, GUILD_ATTENDANCE_REWARD, GUILD_ATTENDANCE_WEEK_BONUS, GUILD_BADGE_CHANGE_GEMS, GUILD_CREATE_GEMS, GUILD_NAME_MAX,
  GUILD_NOTICE_MAX, GUILD_SHOP_PRODUCTS, GUILD_STAMP_DAYS, guildCan, guildCanKick, guildLevelProgress, guildPerks, validateGuildName,
  type GuildJoinMode, type GuildRole,
} from "../core/guild";
import {
  DEFAULT_GUILD_BADGE, GUILD_BADGE_COLOR_IDS, GUILD_BADGE_ICONS, GUILD_BADGE_SHAPES, isGuildBadge, type GuildBadge,
} from "../core/guildBadge";
import { RELICS } from "../data/relics";
import { setDebugScene } from "../debug";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { withBusy } from "../ui/BusyOverlay";
import { addCategoryTab } from "../ui/CategoryTab";
import type { ClipRect } from "../ui/clipRect";
import { showContentToast } from "../ui/ContentToast";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { addFriendChip, addRowButton, type RowButtonTone } from "../ui/friendsWidgets";
import { addBackButton } from "../ui/IconButton";
import { addFramedIcon } from "../ui/itemFrame";
import { addGuildBadge } from "../ui/GuildBadge";
import { openGuildBadgePicker } from "../ui/GuildBadgePicker";
import {
  GUILD_ATTENDANCE as A, GUILD_EDITOR as E, GUILD_INFO as I, GUILD_ROW as R, GUILD_SCREEN as S, guildMinScroll, guildRowButtonX, guildRowY,
  guildStampSlot, guildTabX,
} from "../ui/guildLayout";
import { chipPoints, drawLayer, HoloBar, HOLO } from "../ui/holo";
import { PopupLayer } from "../ui/PopupLayer";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { playSceneEntrance, slideTabPage, startScene } from "../ui/screenTransition";
import { squeezeTextToWidth } from "../ui/textFit";
import { TextInputField } from "../ui/TextInputField";
import { COLOR, textStyle } from "../ui/theme";

type GuildTab = "info" | "members" | "attendance" | "shop";
const TABS = [
  { key: "info", labelKey: "guild.tab.info" },
  { key: "members", labelKey: "guild.tab.members" },
  { key: "attendance", labelKey: "guild.tab.attendance" },
  { key: "shop", labelKey: "guild.tab.shop" },
] as const;

const TAP_SLOP = 14;
const FULL_CLIP: ClipRect = { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 };
const BADGE_CHOICES = [
  { labelKey: "guild.badge.shape", field: "shape", values: GUILD_BADGE_SHAPES },
  { labelKey: "guild.badge.shapeColor", field: "shapeColor", values: GUILD_BADGE_COLOR_IDS },
  { labelKey: "guild.badge.icon", field: "icon", values: GUILD_BADGE_ICONS },
  { labelKey: "guild.badge.iconColor", field: "iconColor", values: GUILD_BADGE_COLOR_IDS },
] as const;
const DAY_KEYS = ["guild.day.0", "guild.day.1", "guild.day.2", "guild.day.3", "guild.day.4", "guild.day.5", "guild.day.6"] as const;
const ASSIGNABLE_ROLES = ["vice", "officer", "member"] as const;

const hmText = (ms: number): string => {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes >= 60 ? t("guild.time.hm", { h: Math.floor(minutes / 60), m: minutes % 60 }) : t("guild.time.m", { m: minutes });
};

/**
 * 로비의 길드 버튼에서 진입하는 길드 화면. 규칙은 `src/core/guild*.ts`가, 가입·직위·출석 기록은 길드 백엔드(`guildApi`)가,
 * 지갑이 얽힌 네 조작(만들기·뱃지 변경·출석 보상·상점 구매)은 `gameApi`가 맡고 이 화면은 결과를 그리기만 한다.
 *
 * - 길드가 없으면 추천 길드를 훑고 검색·가입·신청, 또는 직접 만든다.
 * - 길드가 있으면 **정보 · 멤버 · 출석 · 상점** 네 탭(좌하단 라벨)이다.
 */
export class GuildScene extends Phaser.Scene {
  private state?: GuildStateResponse;
  private members?: GuildMembersResponse;
  private attendance?: GuildAttendanceState;
  private shop?: GuildShopState;
  private browse: GuildSummary[] = [];
  private query = "";
  private tab: GuildTab = "info";

  private popups!: PopupLayer;
  private view!: Phaser.GameObjects.Container;
  private controls!: Phaser.GameObjects.Container;
  private tabRow!: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private scrollOffset = 0;
  private minScroll = 0;
  private dragging = false;
  private dragLastY = 0;
  private dragMoved = 0;
  private busy = false;

  constructor() { super("guild"); }

  create(): void {
    setDebugScene("guild");
    this.state = undefined; this.members = undefined; this.attendance = undefined; this.shop = undefined;
    this.browse = []; this.query = ""; this.tab = "info"; this.list = undefined; this.scrollOffset = 0; this.minScroll = 0; this.busy = false;
    addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.74).setDepth(-29);
    this.add.text(S.title.x, S.title.y, t("guild.title"), textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    addBackButton(this, () => startScene(this, "lobby"));
    this.view = this.add.container(0, 0);
    this.controls = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    this.popups = new PopupLayer(this);
    this.bindScroll();
    void this.reload();
    playSceneEntrance(this);
  }

  /* ── 데이터·오류 ──────────────────────────────────────────────────────── */

  private get myRole(): GuildRole | undefined { return this.state?.me?.role; }
  private get now(): number { return this.state?.serverTime ?? Date.now(); }

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

  /** 길드 상태를 다시 받고 지금 탭의 자료도 새로 받아 그린다. */
  private async reload(keep = false): Promise<void> {
    try {
      this.state = await guildApi.getGuild();
      if (!this.scene.isActive()) return;
      if (!this.state.guild) this.browse = (await guildApi.searchGuilds(this.query)).guilds;
      else await this.loadTab();
    } catch (error) {
      if (this.scene.isActive()) this.fail(error);
      return;
    }
    if (this.scene.isActive()) this.paint(keep);
  }

  private async loadTab(): Promise<void> {
    if (this.tab === "members") this.members = await guildApi.getMembers();
    else if (this.tab === "attendance") this.attendance = await guildApi.getAttendance();
    else if (this.tab === "shop") this.shop = await guildApi.getShop();
  }

  /* ── 그리기 ───────────────────────────────────────────────────────────── */

  private paint(keep = false): void {
    setDebugScene("guild", this.state?.guild ? this.tab : "browse");
    this.controls.removeAll(true);
    this.tabRow.removeAll(true);
    this.view.removeAll(true);
    this.list = undefined;
    if (!this.state?.guild) { this.paintBrowse(keep); return; }
    this.paintTabs();
    if (this.tab === "info") this.paintInfo();
    else if (this.tab === "members") this.paintMembers(keep);
    else if (this.tab === "attendance") this.paintAttendance();
    else this.paintShop();
  }

  private paintTabs(): void {
    TABS.forEach(({ key, labelKey }, index) => {
      addCategoryTab(this, this.tabRow, {
        x: guildTabX(index), y: S.tabs.y, width: S.tabs.width, height: S.tabs.height, label: t(labelKey), selected: this.tab === key,
        onSelect: () => {
          if (this.tab === key || this.busy) return;
          const from = TABS.findIndex((candidate) => candidate.key === this.tab);
          this.tab = key;
          void this.reload().then(() => { if (this.scene.isActive()) slideTabPage(this, [this.view], from, index); });
        },
      });
    });
    const pending = this.state?.pendingRequests ?? 0;
    if (pending > 0) {
      const x = guildTabX(1) + S.tabs.width / 2 - 26;
      this.tabRow.add(this.add.circle(x, S.tabs.y - 30, 9, 0xe5484d));
    }
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

  /* ── 길드가 없을 때 ───────────────────────────────────────────────────── */

  private paintBrowse(keep: boolean): void {
    const cooldown = (this.state?.leaveCooldownUntil ?? 0) - this.now;
    const summary = cooldown > 0 ? t("guild.browse.cooldown", { time: hmText(cooldown) }) : this.query ? t("guild.browse.results", { count: this.browse.length }) : t("guild.browse.summary");
    this.label(this.controls, S.side, S.summary.y, summary, { role: "body", size: 28, color: cooldown > 0 ? COLOR.dangerText : COLOR.inkDim });
    const y = S.controls.y;
    const buttonWidth = 200;
    const inputWidth = S.width - buttonWidth * 2 - 24;
    const field = new TextInputField(this, S.side + inputWidth / 2, y, {
      width: inputWidth, height: S.controls.height - 4, value: this.query, maxGlyphs: GUILD_NAME_MAX, ariaLabel: t("guild.browse.searchAria"), fontSize: 28,
    });
    this.controls.add(field);
    const search = (): void => { this.query = field.value; void this.reload(); };
    addRowButton(this, this.controls, S.side + inputWidth + 12 + buttonWidth / 2, y, buttonWidth, S.controls.height - 4, t("guild.browse.search"), "neutral", () => FULL_CLIP, () => true, search);
    addRowButton(this, this.controls, S.side + S.width - buttonWidth / 2, y, buttonWidth, S.controls.height - 4, t("guild.browse.create"), "accent", () => FULL_CLIP, () => true, () => this.openEditor("create"));
    if (this.browse.length === 0) {
      this.label(this.view, BASE_WIDTH / 2, 700, t("guild.browse.empty"), { role: "body", size: 32, color: COLOR.inkDim }, [0.5, 0.5]);
      return;
    }
    const pending = new Set(this.state?.requestedGuildIds ?? []);
    this.mountList(this.browse.length, keep, (row, index) => {
      const guild = this.browse[index];
      this.plate(row, 0, 0, S.width, S.row.height - 4);
      addGuildBadge(this, row, R.badge.x, 0, guild.badge, R.badge.size);
      this.guildRowText(row, guild, R.button.width + R.button.padRight + 24);
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

  /* ── 정보 ─────────────────────────────────────────────────────────────── */

  private paintInfo(): void {
    const guild = this.state!.guild!, me = this.state!.me!;
    const v = this.view;
    addGuildBadge(this, v, I.badge.x, I.badge.y, guild.badge, I.badge.size);
    this.label(v, I.name.x, I.name.y, guild.name, { role: "display", size: 52 });
    this.label(v, I.level.x, I.level.y, t("guild.levelShort", { level: guild.level }), { role: "display", size: 38, color: COLOR.accentText });
    this.label(v, I.capacity.x, I.capacity.y, `${t("guild.capacity", { count: guild.memberCount, capacity: guild.capacity })} · ${t(`guild.joinMode.${guild.joinMode}`)}`, { role: "emphasis", size: 28, color: COLOR.ink });
    this.label(v, I.leader.x, I.leader.y, t("guild.info.leader", { name: guild.leaderName }), { role: "body", size: 26, color: COLOR.inkDim });

    const progress = guildLevelProgress(guild.prosperity);
    new HoloBar(this, S.side + S.width / 2, I.bar.y, S.width, I.bar.height, { color: COLOR.accent, trackAlpha: 0.85, outline: true }).setValue(progress.next === null ? 1 : progress.into / progress.span);
    this.label(v, S.side, I.barText.y, t("guild.info.prosperity", { value: guild.prosperity.toLocaleString() }), { role: "emphasis", size: 28 });
    this.label(v, S.side + S.width, I.barText.y, progress.next === null ? t("guild.info.maxLevel") : t("guild.info.nextLevel", { value: (progress.span - progress.into).toLocaleString() }), { role: "body", size: 26, color: COLOR.inkDim }, [1, 0.5]);

    const perks = guildPerks(guild.level);
    const perkLines = [
      perks.excavationBonusPercent > 0 ? t("guild.info.perkExcavation", { value: perks.excavationBonusPercent }) : "",
      perks.dispatchTimeReductionPercent > 0 ? t("guild.info.perkDispatch", { value: perks.dispatchTimeReductionPercent }) : "",
    ].filter(Boolean);
    (perkLines.length > 0 ? perkLines : [t("guild.info.perkNone")]).forEach((line, index) => this.label(v, S.side, I.perks.y + index * I.perks.gap, line, { role: "emphasis", size: 30, color: COLOR.accentText }));

    this.plate(v, BASE_WIDTH / 2, I.notice.y + I.notice.height / 2 - 60, S.width, I.notice.height);
    const notice = guild.notice || t("guild.info.noticeEmpty");
    v.add(this.add.text(S.side + 36, I.notice.y - 60 + 36, notice, textStyle({ role: "body", size: 30, color: guild.notice ? COLOR.ink : COLOR.inkDim, wrap: S.width - 72 })).setOrigin(0, 0));
    this.label(v, S.side, I.me.y, t("guild.info.me", { role: t(`guild.role.${me.role}`), coin: me.coin.toLocaleString(), week: me.contributionWeek.toLocaleString() }), { role: "body", size: 28, color: COLOR.inkDim });

    const buttons: { label: string; tone: RowButtonTone; run: () => void }[] = [];
    if (guildCan(me.role, "notice") || guildCan(me.role, "joinMode")) buttons.push({ label: t("guild.info.settings"), tone: "neutral", run: () => this.openSettings() });
    if (guildCan(me.role, "badge")) buttons.push({ label: t("guild.badge.apply"), tone: "neutral", run: () => this.openEditor("badge") });
    if (guildCan(me.role, "disband") && guild.memberCount === 1) buttons.push({ label: t("guild.info.disband"), tone: "danger", run: () => this.confirmLeave(true) });
    else if (me.role !== "leader") buttons.push({ label: t("guild.info.leave"), tone: "danger", run: () => this.confirmLeave(false) });
    buttons.forEach((button, index) => {
      const x = S.side + I.actions.width / 2 + index * (I.actions.width + I.actions.gap);
      addRowButton(this, v, x, I.actions.y, I.actions.width, I.actions.height, button.label, button.tone, () => FULL_CLIP, () => true, button.run);
    });
  }

  private confirmLeave(disband: boolean): void {
    this.popups.confirm({
      title: t(disband ? "guild.info.disbandTitle" : "guild.info.leaveTitle"),
      message: t(disband ? "guild.info.disbandConfirm" : "guild.info.leaveConfirm"),
      confirmLabel: t(disband ? "guild.info.disband" : "guild.info.leave"), destructive: true,
    }, () => { void this.act(() => (disband ? guildApi.disbandGuild() : guildApi.leaveGuild())); });
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
      const submitY = (creating ? E.submit : 380) + (creating ? 0 : 0);
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
    const data = this.members, me = this.state?.me;
    if (!data || !me) return;
    const guild = this.state!.guild!;
    this.label(this.controls, S.side, S.summary.y, t("guild.members.summary", { count: data.members.length, capacity: guild.capacity }) + (data.requests.length > 0 ? ` · ${t("guild.members.requests", { count: data.requests.length })}` : ""), { role: "body", size: 28, color: COLOR.inkDim });
    const rows = [...data.requests.map((request) => ({ request })), ...data.members.map((member) => ({ member }))];
    this.mountList(rows.length, keep, (row, index) => {
      const entry = rows[index];
      this.plate(row, 0, 0, S.width, S.row.height - 4);
      const person = "request" in entry ? entry.request : entry.member;
      const relic = RELICS.find((candidate) => candidate.id === person.avatarRelicId);
      row.add(new ProfileAvatar(this, R.badge.x, 0, { size: 104, frameId: person.frameId, portraitAssetId: relic?.portraitAssetId, fallback: Array.from(person.name.trim())[0] ?? "?" }));
      const room = S.width / 2 - (R.button.width * 2 + 60) - R.textX;
      row.add(squeezeTextToWidth(this.add.text(R.textX, R.nameY, person.name, textStyle({ role: "display", size: 34 })).setOrigin(0, 0.5), room));
      if ("request" in entry) {
        this.label(row, R.textX, R.subY, t("guild.levelShort", { level: person.level }), { role: "emphasis", size: 28, color: COLOR.accentText });
        addRowButton(this, row, guildRowButtonX(1), 0, R.button.width, R.button.height, t("guild.members.decline"), "danger", this.clip, this.canTap, () => { void this.act(() => guildApi.decideJoinRequest(person.userId, false)); });
        addRowButton(this, row, guildRowButtonX(0), 0, R.button.width, R.button.height, t("guild.members.approve"), "accent", this.clip, this.canTap, () => { void this.act(() => guildApi.decideJoinRequest(person.userId, true)); });
        return;
      }
      const member = entry.member;
      this.label(row, R.textX, R.subY, `${t(`guild.role.${member.role}`)} · ${t("guild.levelShort", { level: member.level })}`, { role: "emphasis", size: 28, color: COLOR.accentText });
      this.label(row, R.textX, R.noteY, t("guild.members.contribution", { value: member.contributionWeek.toLocaleString() }), { role: "body", size: 28, color: COLOR.ink });
      if (member.isMe) { this.label(row, S.width / 2 - 40, 0, t("guild.members.me"), { role: "display", size: 30, color: COLOR.accentText }, [1, 0.5]); return; }
      if (this.memberActions(member).length > 0) {
        addRowButton(this, row, guildRowButtonX(0), 0, R.button.width, R.button.height, "···", "neutral", this.clip, this.canTap, () => this.openMemberActions(member));
      }
    });
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

  /* ── 출석 ─────────────────────────────────────────────────────────────── */

  private paintAttendance(): void {
    const data = this.attendance;
    if (!data) return;
    const v = this.view;
    const count = data.stamps.filter((stamp) => stamp !== null).length;
    this.label(this.controls, S.side, S.summary.y, t("guild.attendance.summary", { count, total: GUILD_STAMP_DAYS }), { role: "body", size: 28, color: COLOR.inkDim });
    data.stamps.forEach((stamp, index) => {
      const slot = guildStampSlot(index);
      const cell = this.add.container(slot.x, A.slots.y);
      v.add(cell);
      const today = index === data.todayIndex;
      cell.add(drawLayer(this, 0, 0, chipPoints(slot.width, A.slots.height, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } }), { fill: stamp ? 0x2b2a1b : 0x1a1f27, alpha: HOLO.glass, edge: today ? COLOR.accent : undefined, edgeAlpha: 0.9 }));
      this.label(cell, 0, -A.slots.height / 2 + 40, t(DAY_KEYS[index]), { role: "display", size: 30, color: today ? COLOR.accentText : COLOR.ink }, [0.5, 0.5]);
      if (stamp) cell.add(this.add.image(0, 20, stamp === "gold" ? CURRENCY_ICON_BY_WALLET.gold : CURRENCY_ICON_BY_WALLET.cheesecake).setDisplaySize(slot.width * 0.62, slot.width * 0.62));
      else if (today) this.label(cell, 0, 20, t("guild.attendance.today"), { role: "emphasis", size: 28, color: COLOR.accentText }, [0.5, 0.5]);
    });
    this.label(v, S.side, A.info.y, t("guild.attendance.gain", { prosperity: GUILD_ATTENDANCE_GAIN.prosperity, contribution: GUILD_ATTENDANCE_GAIN.contribution, coin: GUILD_ATTENDANCE_GAIN.coin }), { role: "body", size: 28, color: COLOR.inkDim });
    if (data.stampedToday) {
      this.label(v, BASE_WIDTH / 2, A.pick.y, t("guild.attendance.stamped"), { role: "display", size: 44, color: COLOR.accentText }, [0.5, 0.5]);
    } else {
      (["gold", "cheesecake"] as const).forEach((choice, index) => {
        const x = BASE_WIDTH / 2 + (index === 0 ? -1 : 1) * (A.pick.width / 2 + A.pick.gap / 2);
        const label = t(choice === "gold" ? "guild.attendance.pickGold" : "guild.attendance.pickCheesecake", { value: GUILD_ATTENDANCE_REWARD[choice].toLocaleString() });
        addRowButton(this, v, x, A.pick.y, A.pick.width, A.pick.height, label, "accent", () => FULL_CLIP, () => true, () => {
          void this.act(async () => {
            const result = await gameApi.stampGuildAttendance({ choice });
            if (result.weekBonus) this.time.delayedCall(450, () => { if (this.scene.isActive()) this.toast(t("guild.attendance.bonus"), "unlocked"); });
          }, () => this.toast(t("guild.attendance.done"), "unlocked"));
        });
      });
    }
    this.label(v, S.side, A.bonus.y, data.weekBonusClaimed ? t("guild.attendance.weekClaimed") : t("guild.attendance.weekBonus", { gems: GUILD_ATTENDANCE_WEEK_BONUS.gems, coin: GUILD_ATTENDANCE_WEEK_BONUS.coin }), { role: "emphasis", size: 28, color: data.weekBonusClaimed ? COLOR.inkDim : COLOR.accentText });
  }

  /* ── 상점 ─────────────────────────────────────────────────────────────── */

  private paintShop(): void {
    const data = this.shop;
    if (!data) return;
    this.label(this.controls, S.side, S.summary.y, t("guild.shop.coin", { coin: data.coin.toLocaleString() }), { role: "emphasis", size: 30, color: COLOR.accentText });
    GUILD_SHOP_PRODUCTS.forEach((product, index) => {
      const item = data.items.find((candidate) => candidate.productId === product.id);
      const bought = item?.bought ?? 0;
      const row = this.add.container(BASE_WIDTH / 2, S.body.top + guildRowY(index));
      this.view.add(row);
      this.plate(row, 0, 0, S.width, S.row.height - 4);
      const texture = product.grant.gold ? CURRENCY_ICON_BY_WALLET.gold : product.grant.cheesecake ? CURRENCY_ICON_BY_WALLET.cheesecake : "item-stamina-tonic";
      addFramedIcon(this, row, R.badge.x, 0, 112, texture);
      this.label(row, R.textX, R.nameY, t(`guild.shop.product.${product.id}` as "guild.shop.product.guild-gold"), { role: "display", size: 34 });
      const grant = product.grant.gold ? t("guild.shop.grantGold", { value: product.grant.gold.toLocaleString() }) : product.grant.cheesecake ? t("guild.shop.grantCheesecake", { value: product.grant.cheesecake }) : t("guild.shop.grantTonic", { value: product.grant.item?.quantity ?? 1 });
      this.label(row, R.textX, R.subY, grant, { role: "emphasis", size: 26, color: COLOR.accentText });
      this.label(row, R.textX, R.noteY, `${t("guild.shop.price", { price: product.price })} · ${t("guild.shop.limit", { bought, limit: product.weeklyLimit })}`, { role: "body", size: 28, color: COLOR.ink });
      const affordable = data.coin >= product.price && bought < product.weeklyLimit;
      addRowButton(this, row, guildRowButtonX(0), 0, R.button.width, R.button.height, t("guild.shop.buy"), affordable ? "accent" : "disabled", () => FULL_CLIP, () => true, () => {
        void this.act(() => gameApi.buyGuildProduct({ productId: product.id }), () => this.toast(t("guild.shop.bought"), "unlocked"));
      });
    });
  }

  /* ── 스크롤 목록 ──────────────────────────────────────────────────────── */

  private clip = (): ClipRect => ({ left: S.side, right: S.side + S.width, top: S.body.top, bottom: S.body.bottom });
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
    const viewport = S.body.bottom - S.body.top;
    const maskShape = this.add.rectangle(BASE_WIDTH / 2, S.body.top + viewport / 2, BASE_WIDTH, viewport, 0xffffff).setVisible(false);
    list.setMask(maskShape.createGeometryMask());
    list.once(Phaser.GameObjects.Events.DESTROY, () => { list.clearMask(true); maskShape.destroy(); });
    this.minScroll = guildMinScroll(count);
    this.scrollOffset = keep ? Phaser.Math.Clamp(this.scrollOffset, this.minScroll, 0) : 0;
    list.y = S.body.top + this.scrollOffset;
  }

  private bindScroll(): void {
    const inside = (pointer: Phaser.Input.Pointer): boolean => pointer.y >= S.body.top && pointer.y <= S.body.bottom;
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
