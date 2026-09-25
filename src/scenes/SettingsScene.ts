import { availableBattleSpeeds } from "../core/battleControls";
import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { settingsManager } from "../managers/SettingsManager";
import { LANGUAGE_NATIVE_NAME, SELECTABLE_LANGUAGE_IDS } from "../core/language";
import { loadGameFonts } from "../ui/fonts";
import { loadDataOverlay, loadTextCatalog, t, type TextKey } from "../i18n";
import { saveManager } from "../state/SaveManager";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { addBackButton } from "../ui/IconButton";
import { drawHairline, drawLayer, HOLO, slantedRect } from "../ui/holo";
import { SettingsSelectRow } from "../ui/SettingsSelectRow";
import { SettingsSlider } from "../ui/SettingsSlider";
import { SettingsToggle } from "../ui/SettingsToggle";
import { COLOR, textStyle } from "../ui/theme";
import { platformFeedback } from "../api/PlatformFeedback";
import { accountApi, type AccountFailureCode, type AccountState } from "../api/AccountApi";
import { AccountSaveSync } from "../api/AccountSaveSync";
import { session } from "../state/session";
import { openSaveConflictPopup, type SaveConflictChoice } from "../ui/SaveConflictPopup";
import { PopupLayer } from "../ui/PopupLayer";
import { SETTINGS_HEAD, SETTINGS_ROW, SETTINGS_SECTION, SETTINGS_SUPPORT, SETTINGS_TEXT, settingsSectionHeight, settingsTabSlot } from "../ui/settingsLayout";
import { addCategoryTab } from "../ui/CategoryTab";
import { addSectionTitle } from "../ui/SectionTitle";
import { validateSettingsReturn, type SettingsEntryData, type SettingsReturnScene } from "./settingsNavigation";
import { relicCollection } from "../managers/RelicCollectionManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { getRelic } from "../data/relics";
import { openPolicyDocument, type PolicyPath } from "./policyNavigation";
import { consumeSceneEntry } from "./sceneEntry";
import { playSceneEntrance, startScene, restartScene } from "../ui/screenTransition";

/** 상단 탭은 긴 설정을 의미 단위로 나눠 좁은 화면에서도 한 섹션만 스크롤하게 한다. */
const TABS = [
  { id: "sound", key: "settings.tab.sound" }, { id: "alerts", key: "settings.tab.alerts" },
  // 좁은 화면에서 텍스트 배율을 키워도 이웃 탭과 겹치지 않도록 상세 범위는 본문 섹션에서 설명한다.
  { id: "play", key: "settings.tab.play" }, { id: "access", key: "settings.tab.access" }, { id: "support", key: "settings.tab.support" },
] as const satisfies ReadonlyArray<{ id: string; key: TextKey }>;
type SettingsTab = typeof TABS[number]["id"];

/**
 * 줄과 줄 사이를 가르는 선.
 *
 * **선은 줄과 줄 사이에 선다.** 예전에는 줄을 하나 쌓은 뒤 곧바로 그 자리에 그어, 다음 줄의
 * 중심과 정확히 같은 높이가 되었다 — 금색 선이 이름 글자를 가로질렀다. 구분선은 앞 줄과 다음
 * 줄의 한가운데(= 줄 간격의 절반 위)에 그어야 두 줄을 가른다.
 *
 * 폭도 줄과 같은 선을 쓴다. 줄의 글과 조작은 `SETTINGS_ROW.left`에서 시작해 `right`에서
 * 끝나므로 선도 그 두 변을 그대로 잇는다 — 선만 안쪽으로 들어가 있으면 어느 줄까지가 한
 * 묶음인지 흐려진다. 자리와 크기는 순수 배치표(`ui/settingsLayout.ts`)가 갖는다.
 */

/** 설정 씬은 배치와 입력 연결만 맡고 값 보정·저장·알림은 각 manager/API 경계에 위임한다. */
export class SettingsScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private dragStartY = 0;
  private activeTab: SettingsTab = "sound";
  private readonly popups = new PopupLayer(this, 3000);
  private accountState: AccountState = { kind: "guest", provider: "guest", maskedId: "GUEST-••••" };
  private accountBusy = false;
  /** 검증을 마친 반환 경로만 보관해 탭 재시작 뒤에도 원래 화면을 잃지 않는다. */
  private returnScene: SettingsReturnScene = "lobby";
  private returnData?: SettingsEntryData["returnData"];

  constructor() { super("settings"); }

  create(): void {
    // 고정 제목과 탭은 스크롤 마스크 밖에 두어 현재 위치와 전환점을 항상 볼 수 있게 한다.
    // 디버그 채널의 제목은 화면에 그리지 않고 E2E가 어느 화면인지 확인하는 데만 쓴다. 언어를
    // 따라 바뀌면 그 확인이 언어마다 갈리므로 한국어 그대로 둔다.
    setDebugScene("settings", "환경 설정"); addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.82).setDepth(-20);
    // 제목 아래 `SYSTEM CONFIGURATION`이 한 줄 서 있었다 — 「환경 설정」을 영어로 한 번 더
    // 풀이할 뿐이라 없어도 조작 결과가 같다. 화면 문구는 행동을 정하는 것만 남긴다.
    this.add.text(SETTINGS_HEAD.titleX, SETTINGS_HEAD.titleY, t("settings.title"), textStyle({ role: "display", size: SETTINGS_HEAD.titleSize })).setDepth(20);
    this.buildTabs();
    this.content = this.add.container(0, SETTINGS_HEAD.contentTop);
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff).fillRect(34, SETTINGS_HEAD.contentTop - 10, 1012, 1430);
    this.content.setMask(maskShape.createGeometryMask()); this.buildRows();
    void accountApi.getState().then(result => { if (result.ok && this.scene.isActive()) { this.accountState = result.value; if (this.activeTab === "support") this.buildRows(); } });
    // 88px 이상 행뿐 아니라 빈 여백도 드래그를 받아 긴 탭의 스크롤이 끊기지 않는다.
    const zone = this.add.zone(BASE_WIDTH / 2, SETTINGS_HEAD.contentTop + 705, BASE_WIDTH, 1430).setInteractive({ draggable: true }).setDepth(-1);
    zone.on("dragstart", (pointer: Phaser.Input.Pointer) => { this.dragStartY = pointer.y - this.scrollY; });
    zone.on("drag", (pointer: Phaser.Input.Pointer) => this.scrollTo(pointer.y - this.dragStartY));
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollTo(this.scrollY - dy));
    addBackButton(this, () => startScene(this, this.returnScene, this.returnData)).setDepth(30);
    // 화면이 한 뼘 아래에서 떠오르며 들어온다. 조각마다 트윈을 걸지 않고 카메라 하나를
    // 움직이므로, 이 뒤에 무엇을 더 세워도 함께 지나간다 — 그래서 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  /**
   * 탭 줄.
   *
   * **맨 글자가 아니라 가방·상점과 같은 전환 라벨이다.** 예전에는 다섯 낱말이 나란히 적혀
   * 있고 지금 탭만 색이 달랐다 — 같은 일(보는 목록을 통째로 바꾸기)을 하는 조작이 가방에서는
   * 솟은 라벨이고 여기서는 맨 글자였다. 내용이 **아래로** 흐르는 화면이라 `face: "down"`으로
   * 뒤집어, 켜진 라벨이 내용 쪽으로 솟고 그 밑변에 강조선이 흐른다.
   */
  private buildTabs(): void {
    TABS.forEach((tab, index) => {
      const slot = settingsTabSlot(index, TABS.length, BASE_WIDTH);
      addCategoryTab(this, undefined, {
        x: slot.x, y: SETTINGS_HEAD.tabY, width: slot.width, height: SETTINGS_HEAD.tabHeight,
        label: t(tab.key), selected: tab.id === this.activeTab, face: "down",
        onSelect: () => { this.activeTab = tab.id; this.scrollY = 0; restartScene(this, { tab: tab.id, returnScene: this.returnScene, returnData: this.returnData }); },
      }).setDepth(20);
    });
  }

  /** 재시작으로 탭의 고정 헤더와 확대된 글자까지 깨끗하게 다시 만들되 선택 탭은 유지한다. */
  init(data: SettingsEntryData): void {
    if (data?.tab && TABS.some(tab => tab.id === data.tab)) this.activeTab = data.tab;
    const route = validateSettingsReturn(data);
    this.returnScene = route.returnScene; this.returnData = route.returnData;
    consumeSceneEntry(this);
  }

  /** 현재 탭에 종속된 행만 생성해 다른 탭의 입력면이 마스크 뒤에 남지 않게 한다. */
  private buildRows(): void {
    this.content.removeAll(true);
    const s = settingsManager.get();
    // 첫 판이 서는 자리. 배치표가 갖는 이유는 E2E가 같은 값으로 줄을 짚기 때문이다.
    let y: number = SETTINGS_SECTION.firstTop;
    let previousPanelBottom = SETTINGS_SECTION.firstTop - SETTINGS_SECTION.gap;
    /**
     * 아직 닫지 않은 섹션. 판은 **내용을 다 쌓은 뒤에** 그리므로, 시작한 자리와 그 판이 들어갈
     * 자식 순서를 들고 있는다.
     */
    let openSection: { title: string; top: number; index: number } | undefined;
    /**
     * 섹션을 닫고 그제야 판을 그린다.
     *
     * **높이를 손으로 적지 않는다.** 예전에는 `section(제목, 1140)`처럼 판 높이가 호출부에
     * 적혀 있어, 줄을 하나 더하거나 언어가 바뀌어 줄이 늘면 마지막 줄이 판 밖으로 나갔다.
     * 판은 나중에 그리되 **먼저 넣어 둔 자리**(`index`)에 끼워 줄 뒤로 깔리게 한다 — 컨테이너는
     * 자식의 depth가 아니라 넣은 순서대로 그린다.
     */
    const endSection = (): void => {
      trailingDivider?.destroy(); trailingDivider = undefined;
      const open = openSection;
      if (!open) return;
      openSection = undefined;
      const height = settingsSectionHeight(open.top, this.sectionContentBottom(open.index, open.top));
      const panel = drawLayer(this, BASE_WIDTH / 2, open.top + height / 2, slantedRect(SETTINGS_SECTION.width, height, SETTINGS_SECTION.bevel), { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.42 });
      this.content.addAt(panel, open.index);
      // 제목은 판 **윗변에 걸터앉는다.** 판 안에 들여놓은 맨 글자였을 때는, 같은 위계의 제목이
      // 다른 화면에서는 판에 걸터앉고 여기서만 글자로 서서 위계가 갈렸다.
      this.content.addAt(addSectionTitle(this, SETTINGS_ROW.left - 18, open.top, open.title, { size: SETTINGS_TEXT.section }), open.index + 1);
      previousPanelBottom = open.top + height;
    };
    const section = (title: string): number => {
      endSection();
      // 앞 섹션의 판 아래에 안전 여백을 확보해 두 판의 면·입력 영역이 겹치지 않게 한다.
      y = Math.max(y, previousPanelBottom + SETTINGS_SECTION.gap);
      openSection = { title, top: y, index: this.content.length };
      y += SETTINGS_SECTION.headRoom;
      return y;
    };
    // 섹션이 끝나면 마지막 줄 뒤의 선은 가를 것이 없다 — 다음 판을 세울 때 걷어 낸다.
    let trailingDivider: Phaser.GameObjects.GameObject | undefined;
    const divider = (): void => {
      trailingDivider = drawHairline(this, (SETTINGS_ROW.left + SETTINGS_ROW.right) / 2, y - SETTINGS_ROW.step / 2, SETTINGS_ROW.right - SETTINGS_ROW.left, { alpha: 0.16 });
      this.content.add(trailingDivider);
    };
    const toggle = <K extends "vibration" | "notifications" | "presentation" | "game" | "accessibility">(label: string, group: K, key: keyof typeof s[K]): void => {
      this.content.add(new SettingsToggle(this, SETTINGS_ROW.left, y, label, s[group][key] as boolean, value => settingsManager.update({ [group]: { [key]: value } })));
      y += SETTINGS_ROW.step; divider();
    };
    if (this.activeTab === "sound") {
      section(t("settings.section.sound"));
      ([["settings.sound.master",'masterVolume'],["settings.sound.music",'musicVolume'],["settings.sound.effects",'effectsVolume'],["settings.sound.voice",'voiceVolume']] as const).forEach(([label,key]) => { this.content.add(new SettingsSlider(this, SETTINGS_ROW.left, y, t(label), s.sound[key], value => settingsManager.update({ sound: { [key]: value } }))); y += SETTINGS_ROW.step; divider(); });
      ([["settings.sound.masterMuted",'masterMuted'],["settings.sound.musicMuted",'musicMuted'],["settings.sound.effectsMuted",'effectsMuted'],["settings.sound.voiceMuted",'voiceMuted']] as const).forEach(([label,key]) => { this.content.add(new SettingsToggle(this,SETTINGS_ROW.left,y,t(label),s.sound[key],value=>settingsManager.update({sound:{[key]:value}}))); y+=SETTINGS_ROW.step; divider(); });
      section(t("settings.section.vibration")); ([["settings.vibration.all",'enabled'],["settings.vibration.combatHit",'combatHit'],["settings.vibration.ultimate",'ultimate'],["settings.vibration.excavation",'excavationResult'],["settings.vibration.uiInput",'uiInput']] as const).forEach(([a,b]) => toggle(t(a),'vibration',b));
    } else if (this.activeTab === "alerts") {
      section(t("settings.section.alerts"));
      const permission = platformFeedback.getNotificationPermission();
      this.addTextAction(90, y, t(s.notifications.enabled ? "settings.alerts.enabled" : "settings.alerts.confirm"), () => void settingsManager.confirmNotifications().then(() => this.buildRows())); y += 64;
      // 플랫폼 차이는 구현 용어 대신 플레이어가 기대할 수 있는 짧은 상태명으로만 구분한다.
      const scheduling = t(platformFeedback.notificationScheduling === "persistent" ? "settings.alerts.device" : platformFeedback.notificationScheduling === "foreground-only" ? "settings.alerts.foreground" : "settings.alerts.unsupported");
      const permissionLabel = t(permission === "granted" ? "settings.alerts.permissionGranted" : "settings.alerts.permissionNeeded");
      this.content.add(this.add.text(90, y, t("settings.alerts.status", { scheduling, permission: permissionLabel }), textStyle({ role: "body", size: SETTINGS_TEXT.note, color: COLOR.inkDim }))); y += 72;
      // 알림 행은 저장과 플랫폼 예약 해제를 함께 처리하는 manager 전용 경계를 통과시킨다.
      ([["settings.alerts.all",'enabled'],["settings.alerts.staminaFull",'staminaFull'],["settings.alerts.dailyMission",'dailyMission'],["settings.alerts.quietHours",'quietHours']] as const).forEach(([label, key]) => {
        this.content.add(new SettingsToggle(this, SETTINGS_ROW.left, y, t(label), s.notifications[key], value => settingsManager.updateNotificationPreferences({ [key]: value })));
        y += SETTINGS_ROW.step; divider();
      });
      // 기존 선택 행의 눌림·강조 양식을 재사용하며 30분 단위의 유효 HH:mm 값만 저장한다.
      const quietTimes = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);
      this.content.add(new SettingsSelectRow(this, SETTINGS_ROW.left, y, t("settings.alerts.quietStart"), s.notifications.quietHoursStart, quietTimes, value => void settingsManager.updateNotificationPreferences({ quietHoursStart: value }))); y += SETTINGS_ROW.step; divider();
      this.content.add(new SettingsSelectRow(this, SETTINGS_ROW.left, y, t("settings.alerts.quietEnd"), s.notifications.quietHoursEnd, quietTimes, value => void settingsManager.updateNotificationPreferences({ quietHoursEnd: value }))); y += SETTINGS_ROW.step; divider();
    } else if (this.activeTab === "play") {
      section(t("settings.section.play"));
      // 기존 저사양 토글은 품질 선택과 의미가 겹쳐 제거하고, 서로 다른 연출 토글만 남긴다.
      ([["settings.play.screenShake",'screenShake'],["settings.play.damageNumbers",'damageNumbers'],["settings.play.shortenExcavation",'shortenExcavation']] as const).forEach(([a,b]) => toggle(t(a),'presentation',b));
      // 기존 SettingsToggle의 행·강조·입력 피드백을 그대로 쓰며 접근성 선택과 별도 필드로 저장한다.
      toggle(t("settings.play.powerSaving"),'presentation','powerSaving');
      // 홀로그램 선택 행의 강조색·눌림 확대를 그대로 재사용한다.
      const qualityKeys = { high: "settings.play.quality.high", balanced: "settings.play.quality.balanced", low: "settings.play.quality.low" } as const;
      this.content.add(new SettingsSelectRow(this,SETTINGS_ROW.left,y,t("settings.play.graphicsQuality"),s.presentation.graphicsQuality,['high','balanced','low'] as const,v=>settingsManager.update({presentation:{graphicsQuality:v}}),v=>t(qualityKeys[v]))); y+=SETTINGS_ROW.step; divider();
      this.content.add(new SettingsSelectRow(this,SETTINGS_ROW.left,y,t("settings.play.frameRateLimit"),s.presentation.frameRateLimit,[30,60] as const,v=>settingsManager.update({presentation:{frameRateLimit:v}}),v=>`${v} FPS`)); y+=SETTINGS_ROW.step; divider();
      // 기존 선택 행의 크기 반응과 강조색을 재사용하고 저장값만 안정적인 영문 ID로 유지한다.
      const motionKeys = { default: "settings.play.motion.default", reduced: "settings.play.motion.reduced", off: "settings.play.motion.off" } as const;
      this.content.add(new SettingsSelectRow(this,SETTINGS_ROW.left,y,t("settings.play.battleUiMotion"),s.presentation.battleUiMotion,['default','reduced','off'] as const,v=>settingsManager.update({presentation:{battleUiMotion:v}}),v=>t(motionKeys[v]))); y+=SETTINGS_ROW.step; divider();
      // 인게임 배속 칩과 같은 1·2·3배 선택지를 보여 주며 SettingsManager가 즉시 저장한다.
      this.content.add(new SettingsSelectRow(this,SETTINGS_ROW.left,y,t("settings.play.battleSpeed"),s.game.battleSpeed,availableBattleSpeeds(false),v=>settingsManager.update({game:{battleSpeed:v}}))); y+=SETTINGS_ROW.step; divider();
      toggle(t("settings.play.autoUltimate"),'game','autoUltimate');
      this.content.add(new SettingsSelectRow(this,SETTINGS_ROW.left,y,t("settings.play.textSpeed"),s.game.textSpeed,[0.5,1,2] as const,v=>settingsManager.update({game:{textSpeed:v}}))); y+=SETTINGS_ROW.step; divider();
      // 목록·표기는 core/language.ts 한 표가 갖는다. 각 언어는 제 이름으로 서야 지금 화면을
      // 읽지 못하는 사람도 제 언어를 찾는다.
      //
      // 고를 수 있는 언어가 하나뿐이면 줄 자체를 세우지 않는다 — 눌러도 아무 일이 없는 조작은
      // 준비 상태를 과장한다. 번역이 들어와 `SELECTABLE_LANGUAGE_IDS`가 늘면 저절로 나타난다.
      if (SELECTABLE_LANGUAGE_IDS.length > 1) {
      this.content.add(new SettingsSelectRow(this,SETTINGS_ROW.left,y,t("settings.play.language"),s.game.language,SELECTABLE_LANGUAGE_IDS,v=>{
        settingsManager.update({game:{language:v}});
        // 글꼴 스택과 문구 표가 함께 바뀌므로, 둘 다 도착한 뒤에 다시 그린다. Phaser Text는 그린
        // 순간의 글꼴로 텍스처를 굳으니 받기 전에 그리면 대체 글꼴 상태로 남는다.
        void Promise.all([loadGameFonts(v), loadTextCatalog(v), loadDataOverlay(v)]).then(()=>{ if (this.scene.isActive()) restartScene(this, { tab: "play", returnScene: this.returnScene, returnData: this.returnData }); });
      },v=>LANGUAGE_NATIVE_NAME[v])); y+=SETTINGS_ROW.step; divider();
      }
    } else if (this.activeTab === "access") {
      section(t("settings.section.access"));
      this.content.add(new SettingsSelectRow(this,SETTINGS_ROW.left,y,t("settings.access.textScale"),s.accessibility.textScale,[1,1.15,1.3] as const,value=>{ settingsManager.update({accessibility:{textScale:value}}); restartScene(this, { tab: "access" }); })); y+=SETTINGS_ROW.step; divider();
      // 접근성 선택은 공용 효과·의미 표식 경계에서 소비하며 씬마다 별도 색이나 밝기를 만들지 않는다.
      toggle(t("settings.access.reduceMotion"),'accessibility','reduceMotion'); toggle(t("settings.access.reduceFlashes"),'accessibility','reduceFlashes'); toggle(t("settings.access.colorAssist"),'accessibility','colorAssist');
    } else {
      y = this.buildSupportRows(y, section);
    }
    // 마지막 섹션의 판은 아직 그려지지 않았다 — 닫아야 선다.
    endSection();
    this.content.setData("height", y + 70); this.scrollTo(this.scrollY);
  }

  /**
   * 이 섹션이 실제로 그린 것들의 **가장 아래 끝**.
   *
   * 쌓아 올린 `y`는 "다음 줄이 설 자리"라 마지막 줄보다 한 줄 앞서 있고, 지원 탭처럼 줄마다
   * 다른 만큼 내려가는 곳은 그 차이도 제각각이다 — 그 값을 그대로 판 끝으로 쓰면 판 밑에
   * 아무것도 없는 자리가 한 뼘 남는다. 세어 두는 대신 **그려 놓은 것을 잰다**: 줄의 보이지
   * 않는 입력면까지 경계에 들어오므로, 손이 닿는 자리는 언제나 판 안이다.
   *
   * 경계는 월드 좌표로 나오는데 이 판은 스크롤하는 컨테이너 안에 있으므로, 컨테이너가 지금
   * 얼마나 밀려 있는지를 빼서 안쪽 좌표로 되돌린다.
   */
  private sectionContentBottom(fromIndex: number, top: number): number {
    let bottom = top;
    for (const child of this.content.list.slice(fromIndex)) {
      const measured = child as unknown as Partial<Phaser.GameObjects.Components.GetBounds>;
      if (typeof measured.getBounds !== "function") continue;
      bottom = Math.max(bottom, measured.getBounds().bottom - this.content.y);
    }
    return bottom;
  }

  /** 지원·데이터 탭은 계정 연결, 정책 문서, 환경설정 복원과 파괴적 저장 삭제를 한곳에서 구분한다. */
  private buildSupportRows(y: number, section: (title: string) => number): number {
    y = section(t("settings.section.account"));
    const account = this.accountState;
    this.content.add(this.add.text(90, y, t("settings.account.summary", { kind: t(account.kind === "guest" ? "settings.account.guest" : "settings.account.linked"), provider: account.provider.toUpperCase(), maskedId: account.maskedId }), textStyle({ role: "body", size: SETTINGS_TEXT.note, color: COLOR.inkDim, lineSpacing: 10 }))); y += SETTINGS_SUPPORT.accountSummaryRoom;
    if (account.kind === "guest") { this.addTextAction(90, y, t("settings.account.linkGoogle"), () => void this.login("google")); this.addTextAction(350, y, t("settings.account.linkApple"), () => void this.login("apple")); }
    else { this.addTextAction(90, y, t("settings.account.signOut"), () => this.confirmAccountAction(t("settings.account.signOut"), t("settings.account.signOutNotice"), () => accountApi.logout()), true); }
    y += SETTINGS_SUPPORT.accountFootRoom;
    // 두 번째 판은 **정해진 자리**에서 시작한다. 계정 판이 언어에 따라 길어지면 그때만
    // 밀려나며(`section`의 `Math.max`), 그 밖에는 줄 자리가 언제나 같아 E2E가 짚을 수 있다.
    y = Math.max(y, SETTINGS_SUPPORT.sectionTop);
    y = section(t("settings.section.support"));
    this.addTextAction(90, y, t("settings.support.clearCache"), () => void this.clearCache()); y += SETTINGS_SUPPORT.actionStep;
    this.addTextAction(90, y, t("settings.support.terms"), () => this.openPolicy("/terms")); y += SETTINGS_SUPPORT.actionStep;
    this.addTextAction(90, y, t("settings.support.privacy"), () => this.openPolicy("/privacy")); y += SETTINGS_SUPPORT.actionStep;
    // 환경설정 복원은 일반 강조색으로 두어 위험색을 쓰는 진행 삭제·계정 탈퇴와 시각적으로 구분한다.
    this.addTextAction(90, y, t("settings.support.resetSettings"), () => this.confirmSettingsReset()); y += SETTINGS_SUPPORT.actionStep;
    this.addTextAction(90, y, t("settings.support.resetSave"), () => this.confirmLocalReset(), true); y += SETTINGS_SUPPORT.actionStep;
    // 스타터 렐릭 추가처럼 저장 마이그레이션이 소급하지 않는 변경을 QA가 재설치 없이 확인하는 임시 진입점이다.
    this.addTextAction(90, y, t("settings.debug.grantAll"), () => this.grantAllRelics()); y += SETTINGS_SUPPORT.actionStep;
    // 한계 돌파는 레벨 상한·파편·치즈케이크 셋이 동시에 맞아야 열리는 조작이라, 재료 없이는
    // 그 화면과 별마다 열리는 개체 효과를 확인할 방법이 없다. 재료만 주고 돌파는 사람이 누른다.
    this.addTextAction(90, y, t("settings.debug.breakthroughSet"), () => this.grantBreakthroughSet("anky")); y += SETTINGS_SUPPORT.actionStep;
    this.addTextAction(90, y, t("settings.support.withdraw"), () => this.confirmAccountAction(t("settings.support.withdraw"), t("settings.support.withdrawNotice"), () => accountApi.requestWithdrawal()), true); y += 110;
    return y;
  }

  /** 텍스트형 진입점도 최소 88px 터치 영역과 눌림 확대 규칙을 갖는다. */
  private addTextAction(x: number, y: number, label: string, action: () => void, destructive = false): void {
    const button = this.add.text(x, y, label, textStyle({ role: "emphasis", size: SETTINGS_TEXT.action, color: destructive ? COLOR.dangerText : COLOR.accentText })).setOrigin(0, 0.5);
    const hit = this.add.rectangle(x + 420, y, 840, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => button.setScale(1.08)); hit.on("pointerout", () => button.setScale(1)); hit.on("pointerup", () => { button.setScale(1); if (!this.accountBusy) action(); });
    this.content.add([button, hit]);
  }

  /** 캐시는 진행 저장과 분리해 Cache Storage의 다운로드 자산만 지운다. */
  private async clearCache(): Promise<void> {
    if ("caches" in globalThis) await Promise.all((await caches.keys()).map(key => caches.delete(key)));
    this.popups.confirm({ title: t("settings.support.cacheCleared"), message: t("settings.support.cacheClearedBody"), confirmLabel: t("settings.action.confirm") }, () => undefined);
  }

  /** 정책은 새 탭을 우선 사용하되 팝업 차단 시 같은 탭으로 이동해 문서 접근을 보장한다. */
  private openPolicy(path: PolicyPath): void { openPolicyDocument(path); }

  /** 한 번의 확인 뒤 환경설정만 복원하고 지원 탭을 재생성해 모든 입력과 글자 배율을 즉시 동기화한다. */
  private confirmSettingsReset(): void {
    this.popups.confirm({ title: t("settings.support.resetSettings"), message: t("settings.support.resetSettingsBody"), confirmLabel: t("settings.action.reset") }, () => {
      settingsManager.reset();
      // 현재 반환 경로도 함께 넘겨 초기화 뒤 뒤로가기가 사용자가 들어온 화면을 그대로 가리키게 한다.
      restartScene(this, { tab: "support", returnScene: this.returnScene, returnData: this.returnData });
    });
  }

  /** 1차 위험 안내 후 2차 최종 확인을 거쳐 로컬 저장만 삭제한다. */
  private confirmLocalReset(): void {
    this.popups.confirm({ title: t("settings.support.resetSave"), message: t("settings.support.resetSaveStep1"), confirmLabel: t("settings.action.next"), destructive: true }, () => {
      this.popups.confirm({ title: t("settings.support.finalConfirm"), message: t("settings.support.resetSaveStep2"), confirmLabel: t("settings.action.reset"), destructive: true }, () => { saveManager.reset(); startScene(this, "boot"); });
    });
  }

  /** 별 다섯까지 남은 재료를 한 번에 넣고 실제로 지급한 수만 알린다. */
  private grantBreakthroughSet(relicId: string): void {
    if (!session.owned.has(relicId)) {
      this.popups.confirm({ title: t("settings.debug.breakthroughTitle"), message: t("settings.debug.needOwned"), confirmLabel: t("settings.action.confirm") }, () => undefined);
      return;
    }
    const granted = relicProgression.grantBreakthroughSetForDebug(relicId);
    const name = getRelic(relicId).name;
    this.popups.confirm({
      title: name + t("settings.debug.breakthroughSuffix"),
      message: granted.fragments > 0 || granted.cheesecake > 0
        ? t("settings.debug.granted", { name, fragments: granted.fragments, cheesecake: granted.cheesecake.toLocaleString() })
        : t("settings.debug.alreadyMax"),
      confirmLabel: t("settings.action.confirm"),
    }, () => undefined);
  }

  /** 미보유 렐릭만 채워 넣고 몇 명이 새로 늘었는지만 짧게 알린다. */
  private grantAllRelics(): void {
    const grantedCount = relicCollection.grantAllForDebug();
    this.popups.confirm({ title: t("settings.debug.grantAll"), message: grantedCount > 0 ? t("settings.debug.grantedRelics", { count: grantedCount }) : t("settings.debug.alreadyAll"), confirmLabel: t("settings.action.confirm") }, () => undefined);
  }

  /** 인증 성공 뒤 해시를 비교하고, 게스트의 로컬 선택은 서버 멱등 병합으로만 처리한다. */
  private async login(provider: "google" | "apple"): Promise<void> {
    this.accountBusy = true; this.input.enabled = false;
    // login 자체에는 합산을 맡기지 않는다. 아래 명시적 mergeGuestSave 계약만 게스트 진행을 병합한다.
    const loggedIn = await accountApi.login({ provider, mergeGuestProgress: false });
    this.accountBusy = false; this.input.enabled = true;
    if (!loggedIn.ok) { this.showAccountFailure(loggedIn.code); return; }

    const sync = new AccountSaveSync(accountApi, saveManager);
    const requestId = crypto.randomUUID();
    const result = await sync.synchronize(session, (local, remote) => new Promise<SaveConflictChoice>(resolve => openSaveConflictPopup(this, this.popups, local, remote, resolve)), requestId);
    if (result.ok) { startScene(this, "boot"); return; }
    this.showAccountFailure(result.code);
  }

  /** 로그아웃/탈퇴는 저장 초기화와 별개의 공용 확인 팝업을 통과한다. */
  private confirmAccountAction(title: string, message: string, operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): void {
    this.popups.confirm({ title, message, confirmLabel: title, destructive: true }, () => void this.runAccountAction(operation));
  }

  /** 전환 중 입력을 잠그고 성공하면 부트의 저장 검증·마이그레이션 경계를 다시 탄다. */
  private async runAccountAction(operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): Promise<void> {
    this.accountBusy = true; this.input.enabled = false; const result = await operation(); this.accountBusy = false; this.input.enabled = true;
    if (result.ok) { startScene(this, "boot"); return; }
    this.showAccountFailure(result.code ?? "network-error");
  }

  /** 서버 계약의 실패 코드를 플레이어용 문구로 한곳에서 바꾼다. */
  private showAccountFailure(code: AccountFailureCode): void {
    const keys: Record<AccountFailureCode, TextKey> = { unsupported: "settings.account.unsupported", cancelled: "settings.account.cancelled", "network-error": "settings.account.network", "guest-merge-unavailable": "settings.account.mergeBlocked", "conflict-cancelled": "settings.account.conflictCancelled", "save-conflict": "settings.account.stale", "invalid-remote-save": "settings.account.unavailable" };
    this.popups.confirm({ title: t("settings.account.notice"), message: t(keys[code]), confirmLabel: t("settings.action.confirm") }, () => undefined);
  }

  /** 현재 탭 높이만 기준으로 콘텐츠를 움직여 다른 탭 영역으로 새지 않게 한다. */
  private scrollTo(value: number): void { const min = Math.min(0, 1370 - Number(this.content.getData("height") || 0)); this.scrollY = Phaser.Math.Clamp(value, min, 0); this.content.y = 286 + this.scrollY; }
}
