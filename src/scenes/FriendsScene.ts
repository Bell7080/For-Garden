import { NotificationDot } from "../ui/NotificationDot";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import { openArenaFriendPopup } from "../ui/ArenaFriendPopup";
import Phaser from "phaser";
import { t } from "../i18n";
import { socialApi, SocialApiError, type FriendListResponse, type FriendRequestEntry, type FriendRequestsResponse, type UserSearchEntry } from "../api/FakeSocialServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import {
  defaultFriendSortDirection, FRIEND_FILTERS, FRIEND_REQUEST_LIMIT, FRIEND_SORT_MODES, DAILY_HELPER_LIMIT, helperRentalAvailability,
  isOnline, lastActiveAge, normalizeSearchQuery, viewFriends,
  type FriendFilter, type FriendSortMode,
} from "../core/social";
import type { FriendProfile } from "../data/friends";
import { profileFrameOrDefault } from "../data/profileFrames";
import { getRelic } from "../data/relics";
import { setDebugScene } from "../debug";
import { notificationManager } from "../managers/NotificationManager";
import { friendProfileDisplay } from "../state/playerProfile";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addCategoryTab } from "../ui/CategoryTab";
import { addClippedHit } from "../ui/clippedHit";
import type { ClipRect } from "../ui/clipRect";
import { drawGlyph } from "../ui/glyphs";
import { addBackButton } from "../ui/IconButton";
import { chipPoints, drawLayer, HOLO } from "../ui/holo";
import { InfoManager } from "../ui/info";
import {
  FRIENDS_CONTROLS as C, FRIENDS_SCREEN as S, FRIEND_ROW as R, friendRowButtonX, friendRowStarX, friendRowTextRight,
  friendsChipX, friendsChipXFromRight, friendsMinScroll, friendsRowY, friendsSearchRow, friendsSortX, friendsTabX,
} from "../ui/friendsLayout";
import { addFriendChip, addRowButton } from "../ui/friendsWidgets";
import { PlayerProfilePopup, type ProfileAction } from "../ui/PlayerProfilePopup";
import { compactProfileText } from "../ui/playerProfileLayout";
import { PopupLayer } from "../ui/PopupLayer";
import { pressIn, pressOut } from "../ui/pressFeedback";
import { ProfileAvatar } from "../ui/ProfileAvatar";
import { playSceneEntrance, slideTabPage, startScene } from "../ui/screenTransition";
import { SortControl } from "../ui/SortControl";
import { squeezeTextToWidth } from "../ui/textFit";
import { TextInputField } from "../ui/TextInputField";
import { COLOR, PROFILE_MODIFIER_RARITY_COLOR, textStyle } from "../ui/theme";
import { showContentIntro } from "../ui/contentIntro";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** 세 갈래. 씬 하나 안에서 판만 갈아 끼운다(가방·고고학·결투장과 같은 좌하단 라벨). */
type FriendsTab = "friends" | "requests" | "search";
const TABS = [
  { key: "friends", labelKey: "friends.tab.friends" },
  { key: "requests", labelKey: "friends.tab.requests" },
  { key: "search", labelKey: "friends.tab.search" },
] as const;

type RequestView = "incoming" | "outgoing";

/** 손가락이 이만큼 움직였으면 누른 것이 아니라 끈 것이다. */
const TAP_SLOP = TAP_DRAG_SLOP;
/** 접속 중 초록 원 — 체력의 연두와 같은 「살아 있음」의 색이다. */
const ONLINE_COLOR = COLOR.hpFill;
const SEARCH_MAX_GLYPHS = 20;
const FULL_CLIP: ClipRect = { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 };

/** 서버 오류 코드마다 플레이어에게 말할 한 줄. */
const ERROR_KEY = {
  FRIEND_LIMIT: "friends.error.friendLimit",
  REQUEST_LIMIT: "friends.error.requestLimit",
  ALREADY_FRIEND: "friends.error.alreadyFriend",
  ALREADY_REQUESTED: "friends.error.alreadyRequested",
  SELF_REQUEST: "friends.error.self",
  USER_NOT_FOUND: "friends.error.gone",
  REQUEST_NOT_FOUND: "friends.error.gone",
  FRIEND_NOT_FOUND: "friends.error.gone",
  DAILY_HELPER_LIMIT: "friends.error.gone",
} as const;

/**
 * 로비의 친구 버튼에서 진입하는 친구 화면 — **친구 · 신청 · 찾기** 세 탭.
 *
 * - 친구: 즐겨찾기·접속 중 필터와 접속순/이름순/레벨순 정렬. 즐겨찾기는 어느 정렬에서든 맨 위에 모인다.
 * - 신청: 받은 신청(수락·거절·모두 처리)과 보낸 신청(대기 중인 것을 보고 취소)을 나눈다.
 * - 찾기: 이름(부분 일치) 또는 고유 ID(정확히 일치)로 찾고, 검색 전에는 추천 이용자가 쭉 선다.
 *
 * 한 줄을 누르면 **자기 카드와 같은 플레이어 카드**가 친구의 공개 값으로 뜬다(`friendProfileDisplay`).
 * 줄의 얼굴도 카드와 같은 한 장(`ProfileAvatar`)이라 그 친구가 두른 테두리가 목록에서부터 읽힌다.
 * 관계의 규칙(상한·상호 신청의 자동 수락)은 서버(`socialApi`)가 판정하고 화면은 결과만 그린다.
 */
export class FriendsScene extends Phaser.Scene {
  private tab: FriendsTab = "friends";
  private friendData?: FriendListResponse;
  private requestData?: FriendRequestsResponse;
  private recommendations: UserSearchEntry[] = [];

  private filter: FriendFilter = "all";
  private sort: FriendSortMode = "lastActive";
  private descending = true;
  private requestView: RequestView = "incoming";
  private searchQuery = "";
  /** 검색을 눌러 받은 결과. `undefined`면 아직 검색하지 않아 추천이 선다. */
  private searchResults?: UserSearchEntry[];

  private popups!: PopupLayer;
  /** 친구 정보창은 생성 때부터 읽기 전용 권한으로 고정한다. */
  private info!: InfoManager;
  private controls!: Phaser.GameObjects.Container;
  private view!: Phaser.GameObjects.Container;
  private tabRow!: Phaser.GameObjects.Container;
  private list?: Phaser.GameObjects.Container;
  private sortControl?: SortControl<FriendSortMode>;

  private scrollOffset = 0;
  private minScroll = 0;
  private dragging = false;
  private dragLastY = 0;
  private dragMoved = 0;
  private busy = false;

  constructor() { super("friends"); }

  create(): void {
    setDebugScene("friends");
    this.tab = "friends"; this.filter = "all"; this.sort = "lastActive"; this.descending = true;
    this.requestView = "incoming"; this.searchQuery = ""; this.searchResults = undefined;
    this.friendData = undefined; this.requestData = undefined; this.recommendations = [];
    this.list = undefined; this.sortControl = undefined; this.scrollOffset = 0; this.minScroll = 0; this.busy = false;

    addSceneBackground(this, BACKGROUND.lobby);
    // 기존 목록 화면과 같은 검은 유리 오버레이로 광장 원화는 남기고 정보 대비만 확보한다.
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.74).setDepth(-29);
    this.add.text(S.title.x, S.title.y, t("friends.title"), textStyle({ role: "display", size: 52 })).setOrigin(0, 0);
    addBackButton(this, () => startScene(this, "lobby"));
    this.view = this.add.container(0, 0);
    this.controls = this.add.container(0, 0);
    this.tabRow = this.add.container(0, 0);
    this.popups = new PopupLayer(this);
    this.info = new InfoManager(this, 3000, "friend");
    this.bindScroll();
    this.paintTabs();
    void this.reload();
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
    showContentIntro(this, "friends");
  }

  /* ── 데이터 ───────────────────────────────────────────────────────────── */

  private get selfUid(): string | undefined {
    const uid = session.playerCard.uid;
    return uid || undefined;
  }

  private get nowMs(): number { return this.friendData?.serverTime ?? Date.now(); }

  /** 세 응답을 한꺼번에 다시 받아 지금 탭을 그린다. 관계가 바뀐 모든 조작이 이 길을 지난다. */
  private async reload(keepScroll = false): Promise<void> {
    try {
      const [friends, requests, recommended] = await Promise.all([socialApi.getFriends(), socialApi.getRequests(), socialApi.getRecommendations(this.selfUid)]);
      if (!this.scene.isActive()) return;
      this.friendData = friends; this.requestData = requests; this.recommendations = recommended.users;
      // 검색 결과 줄의 관계 표시도 새 응답과 같은 시점의 것이어야 한다.
      if (this.searchResults) {
        const response = await socialApi.searchUsers({ query: this.searchQuery, selfUid: this.selfUid });
        if (!this.scene.isActive()) return;
        this.searchResults = response.users;
      }
    } catch {
      return;
    }
    void notificationManager.refresh().catch(() => undefined);
    this.paintAll(keepScroll);
  }

  private paintAll(keepScroll = false): void {
    setDebugScene("friends", this.tab);
    this.paintControls();
    this.paintList(keepScroll);
  }

  /* ── 탭 ───────────────────────────────────────────────────────────────── */

  private paintTabs(): void {
    this.tabRow.removeAll(true);
    TABS.forEach(({ key, labelKey }, index) => {
      const tab = addCategoryTab(this, this.tabRow, {
        x: friendsTabX(index), y: S.tabs.y, width: S.tabs.width, height: S.tabs.height,
        label: t(labelKey), selected: this.tab === key,
        onSelect: () => {
          if (this.tab === key) return;
          const from = TABS.findIndex((candidate) => candidate.key === this.tab);
          this.tab = key;
          this.paintTabs();
          this.paintAll();
          slideTabPage(this, [this.view], from, index);
        },
      });
      // 받은 신청이 있는 동안 신청 탭 글자 오른쪽 어깨에 빨간 점이 선다. 모서리가 아니라 글자를 기준으로
      // 잡아야 깎인 모서리·솟는 켜진 라벨·줄어든 글자에서도 점이 라벨에 붙어 읽힌다.
      if (key === "requests" && (this.requestData?.incoming.length ?? 0) > 0) {
        new NotificationDot(this, tab, S.tabDot);
      }
    });
  }

  /* ── 조작 줄 ──────────────────────────────────────────────────────────── */

  private paintControls(): void {
    this.sortControl = undefined;
    this.controls.removeAll(true);
    this.paintTabs();
    const y = S.controls.y;
    if (this.tab === "friends") this.paintFriendControls(y);
    else if (this.tab === "requests") this.paintRequestControls(y);
    else this.paintSearchControls(y);
  }

  private addSummary(text: string): void {
    this.controls.add(this.add.text(S.side, S.summary.y, text, textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0, 0.5));
  }

  private paintFriendControls(y: number): void {
    const data = this.friendData;
    const helper = helperRentalAvailability(data?.helperUsesToday ?? 0);
    this.addSummary(t("friends.summary.friends", {
      count: data?.friends.length ?? 0, limit: data?.friendLimit ?? 0, remaining: helper.remaining, max: DAILY_HELPER_LIMIT, points: (data?.friendPoints ?? 0).toLocaleString(),
    }));
    FRIEND_FILTERS.forEach((filter, index) => {
      addFriendChip(this, this.controls, friendsChipX(index, C.filter), y, C.filter.width, C.filter.height, t(`friends.filter.${filter}`), this.filter === filter, () => {
        if (this.filter === filter) return;
        this.filter = filter;
        this.paintControls(); this.paintList();
      });
    });
    this.sortControl = new SortControl<FriendSortMode>(this, {
      x: friendsSortX(), y, height: C.sort.dirWidth - 16, sortWidth: C.sort.width, dirWidth: C.sort.dirWidth, gap: C.sort.gap, fontSize: 26,
      sortOptions: FRIEND_SORT_MODES.map((id) => ({ id, label: t(`friends.sort.${id}`) })),
      sortMode: this.sort, descending: this.descending, parent: this.controls,
      onSort: (mode) => {
        this.sort = mode; this.descending = defaultFriendSortDirection(mode);
        this.sortControl?.setDirection(this.descending);
        this.paintList();
      },
      onDirection: (descending) => { this.descending = descending; this.paintList(); },
    });
  }

  private paintRequestControls(y: number): void {
    const data = this.requestData;
    const incoming = data?.incoming.length ?? 0;
    const outgoing = data?.outgoing.length ?? 0;
    this.addSummary(t("friends.summary.requests", { incoming, outgoing, limit: FRIEND_REQUEST_LIMIT }));
    (["incoming", "outgoing"] as const).forEach((view, index) => {
      addFriendChip(this, this.controls, friendsChipX(index, C.subTab), y, C.subTab.width, C.subTab.height, t(`friends.requests.${view}`, { count: view === "incoming" ? incoming : outgoing }), this.requestView === view, () => {
        if (this.requestView === view) return;
        const from = this.requestView === "incoming" ? 0 : 1;
        this.requestView = view;
        this.paintControls(); this.paintList();
        slideTabPage(this, [this.view], from, index);
      });
    });
    if (this.requestView === "incoming" && incoming > 0) {
      const buttons = [
        { label: t("friends.requests.declineAll"), tone: "danger" as const, run: () => socialApi.declineAllRequests() },
        { label: t("friends.requests.acceptAll"), tone: "accent" as const, run: () => socialApi.acceptAllRequests() },
      ];
      buttons.forEach((button, index) => {
        addRowButton(this, this.controls, friendsChipXFromRight(index, buttons.length, C.bulk), y, C.bulk.width, C.bulk.height, button.label, button.tone, () => FULL_CLIP, () => true, () => {
          void this.mutate(async () => {
            const result = await button.run();
            if (result.skipped > 0) this.notify(t("friends.error.friendLimit"));
          });
        });
      });
    }
  }

  private paintSearchControls(y: number): void {
    if (this.searchResults) this.addSummary(t("friends.summary.results", { count: this.searchResults.length }));
    else this.addSummary(t("friends.summary.recommend"));
    const row = friendsSearchRow();
    const field = new TextInputField(this, row.input.x, y, {
      width: row.input.width, height: C.search.height, value: this.searchQuery, maxGlyphs: SEARCH_MAX_GLYPHS,
      ariaLabel: t("friends.search.aria"), fontSize: 28,
      onChange: (value) => { this.searchQuery = value; },
    });
    this.controls.add(field);
    addRowButton(this, this.controls, row.button.x, y, C.search.width, C.search.height, t("friends.search.button"), "accent", () => FULL_CLIP, () => true, () => {
      this.searchQuery = field.value;
      void this.runSearch();
    });
  }

  private async runSearch(): Promise<void> {
    const query = normalizeSearchQuery(this.searchQuery);
    try {
      // 비운 채 누르면 검색을 접고 추천으로 돌아간다.
      if (query.length === 0) { this.searchResults = undefined; }
      else this.searchResults = (await socialApi.searchUsers({ query, selfUid: this.selfUid })).users;
    } catch { return; }
    if (!this.scene.isActive()) return;
    this.paintControls(); this.paintList();
  }

  /* ── 목록 ─────────────────────────────────────────────────────────────── */

  private clip = (): ClipRect => ({ left: S.side, right: S.side + S.width, top: S.list.top, bottom: S.list.bottom });
  private canTap = (): boolean => this.dragMoved < TAP_SLOP && !this.busy;

  /** 지금 탭이 보여 줄 줄 목록을 다시 세운다. 스크롤 위치는 부르는 쪽이 정한다(`keepScroll`). */
  private paintList(keepScroll = false): void {
    if (this.tab === "friends") this.paintFriendList(keepScroll);
    else if (this.tab === "requests") this.paintRequestList(keepScroll);
    else this.paintSearchList(keepScroll);
  }

  private mountList(count: number, keepScroll: boolean, build: (row: Phaser.GameObjects.Container, index: number) => void): void {
    this.list?.destroy();
    const list = this.add.container(BASE_WIDTH / 2, S.list.top);
    this.view.add(list);
    this.list = list;
    for (let index = 0; index < count; index += 1) {
      const row = this.add.container(0, friendsRowY(index));
      list.add(row);
      build(row, index);
    }
    const viewport = S.list.bottom - S.list.top;
    const maskShape = this.add.rectangle(BASE_WIDTH / 2, S.list.top + viewport / 2, BASE_WIDTH, viewport, 0xffffff).setVisible(false);
    list.setMask(maskShape.createGeometryMask());
    // 마스크는 그것이 자르는 목록과 같은 목숨을 산다.
    list.once(Phaser.GameObjects.Events.DESTROY, () => { list.clearMask(true); maskShape.destroy(); });
    this.minScroll = friendsMinScroll(count);
    this.scrollOffset = keepScroll ? Phaser.Math.Clamp(this.scrollOffset, this.minScroll, 0) : 0;
    list.y = S.list.top + this.scrollOffset;
  }

  /** 끌어서 스크롤한다. 줄과 버튼은 `canTap`으로 끈 손을 누른 것으로 읽지 않는다. */
  private bindScroll(): void {
    const inside = (pointer: Phaser.Input.Pointer): boolean => pointer.y >= S.list.top && pointer.y <= S.list.bottom;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.dragMoved = 0;
      this.dragging = inside(pointer) && !this.popups.isOpen;
      this.dragLastY = pointer.y;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const delta = pointer.y - this.dragLastY;
      this.dragLastY = pointer.y;
      this.dragMoved += Math.abs(delta);
      this.scrollBy(delta);
    });
    this.input.on("pointerup", () => { this.dragging = false; });
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => { if (!this.popups.isOpen) this.scrollBy(-dy * 0.65); });
  }

  private scrollBy(delta: number): void {
    if (!this.list) return;
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + delta, this.minScroll, 0);
    this.list.y = S.list.top + this.scrollOffset;
  }

  /* ── 줄 ───────────────────────────────────────────────────────────────── */

  private ageText(lastActiveAt: number): string {
    const age = lastActiveAge(lastActiveAt, this.nowMs);
    return age.unit === "online" ? t("friends.age.online") : t(`friends.age.${age.unit}`, { value: age.value });
  }

  /** 줄의 판·얼굴·이름·레벨·수식어·소개. 오른쪽 조작은 줄 종류마다 다르다. */
  private paintRowBody(row: Phaser.GameObjects.Container, profile: FriendProfile, textRight: number, extra?: string): void {
    const frame = profileFrameOrDefault(profile.frameId);
    row.add(drawLayer(this, 0, 0, chipPoints(S.width, S.row.height, { bevel: { topLeft: 42, topRight: 0, bottomRight: 42, bottomLeft: 0 } }), { fill: 0x1a1f27, alpha: HOLO.glass, edge: frame.color, edgeAlpha: 0.6 }));
    const relic = getRelic(profile.favoriteRelic.relicId);
    row.add(new ProfileAvatar(this, R.avatar.x, 0, {
      size: R.avatar.size, frameId: frame.id, portraitAssetId: relic.portraitAssetId, fallback: Array.from(profile.displayName.trim())[0] ?? "?",
    }));
    const room = textRight - R.textX;
    row.add(squeezeTextToWidth(this.add.text(R.textX, R.nameY, compactProfileText(profile.displayName, 12), textStyle({ role: "display", size: 36 })).setOrigin(0, 0.5), room));
    const level = this.add.text(R.textX, R.levelY, t("friends.researchLevel", { level: profile.level }), textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0, 0.5);
    row.add(level);
    let cursor = R.textX + level.width + 20;
    const modifier = profile.equippedModifiers[0];
    if (modifier) {
      const chip = this.add.text(cursor, R.levelY, compactProfileText(modifier.displayName, 8), textStyle({ role: "emphasis", size: 28, color: hex(PROFILE_MODIFIER_RARITY_COLOR[modifier.rarity]) })).setOrigin(0, 0.5);
      row.add(squeezeTextToWidth(chip, Math.max(40, textRight - cursor)));
      cursor += chip.displayWidth + 20;
    }
    if (extra && cursor < textRight - 60) {
      row.add(squeezeTextToWidth(this.add.text(cursor, R.levelY, extra, textStyle({ role: "body", size: 28, color: COLOR.ink })).setOrigin(0, 0.5), textRight - cursor));
    }
    row.add(squeezeTextToWidth(this.add.text(R.textX, R.bioY, t("profile.bio.quoted", { bio: profile.status }), textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0, 0.5), room));
  }

  /** 줄 전체를 덮는 입력면 — 누르면 카드가 열린다. 버튼·별은 이 위에 얹혀 먼저 손을 받는다. */
  private addRowHit(row: Phaser.GameObjects.Container, onTap: () => void): void {
    const hit = addClippedHit(this, row, 0, 0, S.width, S.row.height, this.clip);
    hit.on("pointerdown", () => pressIn(row));
    hit.on("pointerout", () => pressOut(row, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(row); if (this.canTap()) onTap(); });
  }

  private paintFriendList(keepScroll: boolean): void {
    const data = this.friendData;
    if (!data) { this.mountList(0, false, () => undefined); return; }
    const favorites = new Set(data.favoriteIds);
    const friends = viewFriends(data.friends, { filter: this.filter, sort: this.sort, descending: this.descending, favoriteIds: favorites, nowMs: this.nowMs });
    this.mountList(friends.length, keepScroll, (row, index) => {
      const friend = friends[index];
      const favorite = favorites.has(friend.id);
      this.paintRowBody(row, friend, friendRowTextRight(0));
      this.addRowHit(row, () => this.openProfile(friend, true, favorite));
      // 즐겨찾기 별 — 정보창 헤더의 책갈피와 같은 글리프. 꺼짐은 회색 선, 켜짐은 강조색이다.
      row.add(drawGlyph(this, "bookmark", friendRowStarX(), R.star.y, 44, favorite ? COLOR.accent : COLOR.inkDimHex, favorite ? 1 : 0.6, 3));
      const star = addClippedHit(this, row, friendRowStarX(), R.star.y, R.star.size, R.star.size, this.clip);
      star.on("pointerup", () => { if (this.canTap()) void this.mutate(() => socialApi.setFavorite(friend.id, !favorite), true); });
      const age = this.ageText(friend.lastActiveAt);
      const online = isOnline(friend.lastActiveAt, this.nowMs);
      const ageLabel = this.add.text(S.width / 2 - R.padRight, R.age.y, age, textStyle({ role: "body", size: 28, color: online ? hex(ONLINE_COLOR) : COLOR.ink })).setOrigin(1, 0.5);
      row.add(ageLabel);
      // 접속 중 초록 점은 얼굴이 아니라 접속 상태 글자 왼쪽에 선다.
      if (online) row.add(this.add.circle(ageLabel.x - ageLabel.displayWidth - R.online.gap - R.online.radius, R.age.y, R.online.radius, ONLINE_COLOR));
    });
  }

  private paintRequestList(keepScroll: boolean): void {
    const data = this.requestData;
    const entries: FriendRequestEntry[] = (this.requestView === "incoming" ? data?.incoming : data?.outgoing) ?? [];
    this.mountList(entries.length, keepScroll, (row, index) => {
      const { profile, requestedAt } = entries[index];
      const incoming = this.requestView === "incoming";
      const buttons = incoming ? 2 : 1;
      const ago = this.ageText(requestedAt);
      this.paintRowBody(row, profile, friendRowTextRight(buttons), t("friends.request.sentAgo", { ago: ago === t("friends.age.online") ? t("friends.age.justNow") : ago }));
      this.addRowHit(row, () => this.openProfile(profile, false, false));
      const y = 0;
      const press = (run: () => Promise<unknown>) => () => { void this.mutate(run); };
      if (incoming) {
        addRowButton(this, row, friendRowButtonX(0, 2), y, R.button.width, R.button.height, t("friends.action.decline"), "danger", this.clip, this.canTap, press(() => socialApi.declineRequest(profile.id)));
        addRowButton(this, row, friendRowButtonX(1, 2), y, R.button.width, R.button.height, t("friends.action.accept"), "accent", this.clip, this.canTap, press(() => socialApi.acceptRequest(profile.id)));
      } else {
        addRowButton(this, row, friendRowButtonX(0, 1), y, R.button.width, R.button.height, t("friends.action.cancel"), "danger", this.clip, this.canTap, press(() => socialApi.cancelRequest(profile.id)));
      }
    });
  }

  private paintSearchList(keepScroll: boolean): void {
    const entries = this.searchResults ?? this.recommendations;
    this.mountList(entries.length, keepScroll, (row, index) => {
      const { profile, relation } = entries[index];
      this.paintRowBody(row, profile, friendRowTextRight(1));
      this.addRowHit(row, () => this.openProfile(profile, false, false));
      const x = friendRowButtonX(0, 1);
      const press = (run: () => Promise<unknown>) => () => { void this.mutate(run); };
      if (relation === "none") {
        addRowButton(this, row, x, 0, R.button.width, R.button.height, t("friends.action.request"), "accent", this.clip, this.canTap, press(() => socialApi.sendRequest(profile.id, this.selfUid)));
      } else if (relation === "incoming") {
        addRowButton(this, row, x, 0, R.button.width, R.button.height, t("friends.action.accept"), "accent", this.clip, this.canTap, press(() => socialApi.acceptRequest(profile.id)));
      } else {
        addRowButton(this, row, x, 0, R.button.width, R.button.height, t(relation === "friend" ? "friends.action.already" : "friends.action.pending"), "disabled", this.clip, this.canTap, () => undefined);
      }
    });
  }

  /* ── 조작 ─────────────────────────────────────────────────────────────── */

  /**
   * 관계를 바꾸는 서버 호출 하나. 끝나면 세 응답을 다시 받아 그린다 — 화면이 관계를 따로 기억하지 않는다.
   * 연타가 같은 조작을 두 번 보내지 않도록 끝날 때까지 줄 입력을 막는다(`canTap`).
   */
  private async mutate(run: () => Promise<unknown>, keepScroll = false): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await run();
    } catch (error) {
      if (error instanceof SocialApiError) this.notify(t(ERROR_KEY[error.code]));
    } finally {
      this.busy = false;
    }
    if (this.scene.isActive()) await this.reload(keepScroll);
  }

  /** 알리기만 하는 확인 창 — 거절 사유는 문장 한 줄이다. */
  private notify(message: string): void {
    if (this.popups.isOpen) return;
    this.popups.confirm({ title: t("friends.error.title"), message, confirmLabel: t("friends.error.ok"), cancelLabel: false });
  }

  /** 카드 — 자기 카드와 같은 한 장이되 편집이 없고, 애착 렐릭을 누르면 읽기 전용 정보창이 열린다. */
  private openProfile(profile: FriendProfile, isFriend: boolean, favorite: boolean, instant = false): void {
    if (this.popups.isOpen) return;
    const actions: ProfileAction[] = isFriend ? [
      {label:t("arena.friend.button"),onClick:()=>{popup.close();openArenaFriendPopup(this,this.popups,{id:profile.id,name:profile.displayName,frameId:profile.frameId,favoriteRelicId:profile.favoriteRelic.relicId,level:profile.level});}},
      {
        label: t(favorite ? "friends.action.unfavorite" : "friends.action.favorite"),
        onClick: () => {
          popup.close();
          void this.mutate(() => socialApi.setFavorite(profile.id, !favorite), true).then(() => {
            if (this.scene.isActive()) this.openProfile(profile, true, !favorite, true);
          });
        },
      },
      {
        label: t("friends.action.remove"), destructive: true,
        onClick: () => this.popups.confirm({
          title: t("friends.remove.title"), message: t("friends.remove.message", { name: profile.displayName }),
          confirmLabel: t("friends.remove.confirm"), destructive: true,
        }, () => { popup.close(); void this.mutate(() => socialApi.removeFriend(profile.id), true); }),
      },
    ] : [];
    const popup = new PlayerProfilePopup(this, this.popups, friendProfileDisplay({ ...profile, lastActive: this.ageText(profile.lastActiveAt) }), () => undefined, undefined, {
      title: t("friends.profile"),
      onFavorite: () => this.info.showFriend(profile.favoriteRelic),
      actions,
    });
    popup.open({ instant });
  }
}

