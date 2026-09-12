import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { settingsManager } from "../managers/SettingsManager";
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
import { validateSettingsReturn, type SettingsEntryData, type SettingsReturnScene } from "./settingsNavigation";
import { relicCollection } from "../managers/RelicCollectionManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { getRelic } from "../data/relics";
import { openPolicyDocument, type PolicyPath } from "./policyNavigation";

/** 상단 탭은 긴 설정을 의미 단위로 나눠 좁은 화면에서도 한 섹션만 스크롤하게 한다. */
const TABS = [
  { id: "sound", label: "사운드" }, { id: "alerts", label: "알림" },
  // 좁은 화면에서 텍스트 배율을 키워도 이웃 탭과 겹치지 않도록 상세 범위는 본문 섹션에서 설명한다.
  { id: "play", label: "게임" }, { id: "access", label: "접근성" }, { id: "support", label: "지원" },
] as const;
type SettingsTab = typeof TABS[number]["id"];

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
    setDebugScene("settings", "환경 설정"); addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.82).setDepth(-20);
    this.add.text(54, 48, "환경 설정", textStyle({ role: "display", size: 48 })).setDepth(20);
    this.add.text(54, 108, "SYSTEM CONFIGURATION", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setDepth(20);
    this.buildTabs();
    this.content = this.add.container(0, 286);
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff).fillRect(34, 276, 1012, 1430);
    this.content.setMask(maskShape.createGeometryMask()); this.buildRows();
    void accountApi.getState().then(result => { if (result.ok && this.scene.isActive()) { this.accountState = result.value; if (this.activeTab === "support") this.buildRows(); } });
    // 88px 이상 행뿐 아니라 빈 여백도 드래그를 받아 긴 탭의 스크롤이 끊기지 않는다.
    const zone = this.add.zone(BASE_WIDTH / 2, 990, BASE_WIDTH, 1430).setInteractive({ draggable: true }).setDepth(-1);
    zone.on("dragstart", (pointer: Phaser.Input.Pointer) => { this.dragStartY = pointer.y - this.scrollY; });
    zone.on("drag", (pointer: Phaser.Input.Pointer) => this.scrollTo(pointer.y - this.dragStartY));
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollTo(this.scrollY - dy));
    addBackButton(this, () => this.scene.start(this.returnScene, this.returnData)).setDepth(30);
  }

  /** 탭은 화면 폭 안에서 균등 배치하며 96px 높이의 터치 영역을 공유한다. */
  private buildTabs(): void {
    const width = (BASE_WIDTH - 64) / TABS.length;
    TABS.forEach((tab, index) => {
      const x = 32 + width * (index + 0.5);
      const label = this.add.text(x, 210, tab.label, textStyle({ role: "emphasis", size: 23, color: tab.id === this.activeTab ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5);
      const hit = this.add.rectangle(x, 210, width, 96, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => label.setScale(1.08));
      hit.on("pointerup", () => { this.activeTab = tab.id; this.scrollY = 0; this.scene.restart({ tab: tab.id, returnScene: this.returnScene, returnData: this.returnData }); });
    });
    this.add.rectangle(BASE_WIDTH / 2, 260, BASE_WIDTH - 80, 2, COLOR.accent, 0.28);
  }

  /** 재시작으로 탭의 고정 헤더와 확대된 글자까지 깨끗하게 다시 만들되 선택 탭은 유지한다. */
  init(data: SettingsEntryData): void {
    if (data?.tab && TABS.some(tab => tab.id === data.tab)) this.activeTab = data.tab;
    const route = validateSettingsReturn(data);
    this.returnScene = route.returnScene; this.returnData = route.returnData;
  }

  /** 현재 탭에 종속된 행만 생성해 다른 탭의 입력면이 마스크 뒤에 남지 않게 한다. */
  private buildRows(): void {
    this.content.removeAll(true);
    const s = settingsManager.get(); let y = 18;
    let previousPanelBottom = 0;
    const section = (title: string, height: number): number => {
      // 앞 섹션의 패널 아래에 안전 여백을 확보해 계정과 데이터 패널의 면·입력 영역이 겹치지 않게 한다.
      y = Math.max(y, previousPanelBottom + 24);
      const panel = drawLayer(this, BASE_WIDTH / 2, y + height / 2, slantedRect(980, height, 14), { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.42 });
      previousPanelBottom = y + height;
      this.content.add(panel); this.content.add(this.add.text(72, y + 24, title, textStyle({ role: "emphasis", size: 32, color: COLOR.accentText }))); y += 88;
      return y;
    };
    const divider = (): void => { this.content.add(drawHairline(this, BASE_WIDTH / 2, y, 890, { alpha: 0.16 })); };
    const toggle = <K extends "vibration" | "notifications" | "presentation" | "game" | "accessibility">(label: string, group: K, key: keyof typeof s[K]): void => {
      this.content.add(new SettingsToggle(this, 90, y, label, s[group][key] as boolean, value => settingsManager.update({ [group]: { [key]: value } })));
      y += 94; divider();
    };
    if (this.activeTab === "sound") {
      section("사운드", 850);
      ([['전체 음량','masterVolume'],['배경음','musicVolume'],['효과음','effectsVolume'],['보이스','voiceVolume']] as const).forEach(([label,key]) => { this.content.add(new SettingsSlider(this, 90, y, label, s.sound[key], value => settingsManager.update({ sound: { [key]: value } }))); y += 92; });
      ([['전체 음소거','masterMuted'],['배경음 음소거','musicMuted'],['효과음 음소거','effectsMuted'],['보이스 음소거','voiceMuted']] as const).forEach(([label,key]) => { this.content.add(new SettingsToggle(this,90,y,label,s.sound[key],value=>settingsManager.update({sound:{[key]:value}}))); y+=94; divider(); });
      section("진동", 560); ([['전체 진동','enabled'],['전투 타격','combatHit'],['궁극기','ultimate'],['연구 결과','excavationResult'],['UI 입력','uiInput']] as const).forEach(([a,b]) => toggle(a,'vibration',b));
    } else if (this.activeTab === "alerts") {
      section("알림", 944);
      const permission = platformFeedback.getNotificationPermission();
      this.addTextAction(90, y, s.notifications.enabled ? "알림 활성화됨" : "알림 활성화 확인", () => void settingsManager.confirmNotifications().then(() => this.buildRows())); y += 64;
      // 플랫폼 차이는 구현 용어 대신 플레이어가 기대할 수 있는 짧은 상태명으로만 구분한다.
      const schedulingLabel = platformFeedback.notificationScheduling === "persistent" ? "기기 알림" : platformFeedback.notificationScheduling === "foreground-only" ? "실행 중 알림" : "알림 미지원";
      this.content.add(this.add.text(90, y, `${schedulingLabel} · ${permission === "granted" ? "허용됨" : "허용 필요"}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))); y += 72;
      // 알림 행은 저장과 플랫폼 예약 해제를 함께 처리하는 manager 전용 경계를 통과시킨다.
      ([['전체 알림','enabled'],['스테미나 충전 완료','staminaFull'],['일일 임무','dailyMission'],['야간 알림 제한','quietHours']] as const).forEach(([label, key]) => {
        this.content.add(new SettingsToggle(this, 90, y, label, s.notifications[key], value => settingsManager.updateNotificationPreferences({ [key]: value })));
        y += 94; divider();
      });
      // 기존 선택 행의 눌림·강조 양식을 재사용하며 30분 단위의 유효 HH:mm 값만 저장한다.
      const quietTimes = Array.from({ length: 48 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);
      this.content.add(new SettingsSelectRow(this, 90, y, '제한 시작', s.notifications.quietHoursStart, quietTimes, value => void settingsManager.updateNotificationPreferences({ quietHoursStart: value }))); y += 94;
      this.content.add(new SettingsSelectRow(this, 90, y, '제한 종료', s.notifications.quietHoursEnd, quietTimes, value => void settingsManager.updateNotificationPreferences({ quietHoursEnd: value }))); y += 94;
    } else if (this.activeTab === "play") {
      section("연출 · 게임", 1328);
      // 기존 저사양 토글은 품질 선택과 의미가 겹쳐 제거하고, 서로 다른 연출 토글만 남긴다.
      ([['전투 화면 흔들림','screenShake'],['피해 숫자','damageNumbers'],['연구 연출 단축','shortenExcavation']] as const).forEach(([a,b]) => toggle(a,'presentation',b));
      // 기존 SettingsToggle의 행·강조·입력 피드백을 그대로 쓰며 접근성 선택과 별도 필드로 저장한다.
      toggle('절전 모드','presentation','powerSaving');
      // 홀로그램 선택 행의 강조색·눌림 확대를 그대로 재사용한다.
      const qualityLabels = { high: "높음", balanced: "균형", low: "낮음" } as const;
      this.content.add(new SettingsSelectRow(this,90,y,'그래픽 품질',s.presentation.graphicsQuality,['high','balanced','low'] as const,v=>settingsManager.update({presentation:{graphicsQuality:v}}),v=>qualityLabels[v])); y+=94;
      this.content.add(new SettingsSelectRow(this,90,y,'프레임 제한',s.presentation.frameRateLimit,[30,60] as const,v=>settingsManager.update({presentation:{frameRateLimit:v}}),v=>`${v} FPS`)); y+=94;
      // 기존 선택 행의 크기 반응과 강조색을 재사용하고 저장값만 안정적인 영문 ID로 유지한다.
      const motionLabels = { default: "기본", reduced: "감소", off: "끔" } as const;
      this.content.add(new SettingsSelectRow(this,90,y,'전투 UI 움직임',s.presentation.battleUiMotion,['default','reduced','off'] as const,v=>settingsManager.update({presentation:{battleUiMotion:v}}),v=>motionLabels[v])); y+=94;
      // 인게임 배속 칩과 같은 1·2·3배 선택지를 보여 주며 SettingsManager가 즉시 저장한다.
      this.content.add(new SettingsSelectRow(this,90,y,'전투 배속',s.game.battleSpeed,[1,2,3] as const,v=>settingsManager.update({game:{battleSpeed:v}}))); y+=94;
      toggle('자동 궁극기','game','autoUltimate');
      this.content.add(new SettingsSelectRow(this,90,y,'텍스트 속도',s.game.textSpeed,[0.5,1,2] as const,v=>settingsManager.update({game:{textSpeed:v}}))); y+=94;
      this.content.add(new SettingsSelectRow(this,90,y,'언어',s.game.language,['ko','en','ja'] as const,v=>settingsManager.update({game:{language:v}}))); y+=110;
    } else if (this.activeTab === "access") {
      section("접근성", 650);
      this.content.add(new SettingsSelectRow(this,90,y,'텍스트 크기',s.accessibility.textScale,[1,1.15,1.3] as const,value=>{ settingsManager.update({accessibility:{textScale:value}}); this.scene.restart({ tab: "access" }); })); y+=94;
      // 접근성 선택은 공용 효과·의미 표식 경계에서 소비하며 씬마다 별도 색이나 밝기를 만들지 않는다.
      toggle('전체 움직임 감소','accessibility','reduceMotion'); toggle('섬광 감소','accessibility','reduceFlashes'); toggle('색각 보조','accessibility','colorAssist');
    } else {
      y = this.buildSupportRows(y, section);
    }
    this.content.setData("height", y + 70); this.scrollTo(this.scrollY);
  }

  /** 지원·데이터 탭은 계정 연결, 정책 문서, 환경설정 복원과 파괴적 저장 삭제를 한곳에서 구분한다. */
  private buildSupportRows(y: number, section: (title: string, height: number) => number): number {
    y = section("계정", 330);
    const account = this.accountState;
    this.content.add(this.add.text(90, y, `상태  ${account.kind === "guest" ? "게스트" : "연동됨"}\n제공자  ${account.provider.toUpperCase()}\n식별 ID  ${account.maskedId}`, textStyle({ role: "body", size: 26, color: COLOR.inkDim, lineSpacing: 10 }))); y += 150;
    if (account.kind === "guest") { this.addTextAction(90, y, "Google 연동", () => void this.login("google")); this.addTextAction(350, y, "Apple 연동", () => void this.login("apple")); }
    else { this.addTextAction(90, y, "로그아웃", () => this.confirmAccountAction("로그아웃", "계정 연결만 해제합니다. 저장 데이터 초기화와 서버 데이터 삭제는 실행하지 않습니다.", () => accountApi.logout()), true); }
    y += 120; y = section("고객지원 · 데이터", 844);
    this.addTextAction(90, y, "캐시 정리", () => void this.clearCache()); y += 92;
    this.addTextAction(90, y, "이용약관", () => this.openPolicy("/terms")); y += 92;
    this.addTextAction(90, y, "개인정보 처리방침", () => this.openPolicy("/privacy")); y += 92;
    // 환경설정 복원은 일반 강조색으로 두어 위험색을 쓰는 진행 삭제·계정 탈퇴와 시각적으로 구분한다.
    this.addTextAction(90, y, "환경설정 초기화", () => this.confirmSettingsReset()); y += 92;
    this.addTextAction(90, y, "저장 데이터 초기화", () => this.confirmLocalReset(), true); y += 92;
    // 스타터 렐릭 추가처럼 저장 마이그레이션이 소급하지 않는 변경을 QA가 재설치 없이 확인하는 임시 진입점이다.
    this.addTextAction(90, y, "모든 캐릭터 획득", () => this.grantAllRelics()); y += 92;
    // 한계 돌파는 레벨 상한·파편·치즈케이크 셋이 동시에 맞아야 열리는 조작이라, 재료 없이는
    // 그 화면과 별마다 열리는 개체 효과를 확인할 방법이 없다. 재료만 주고 돌파는 사람이 누른다.
    this.addTextAction(90, y, "토리카 돌파 세트", () => this.grantBreakthroughSet("anky")); y += 92;
    this.addTextAction(90, y, "계정 탈퇴", () => this.confirmAccountAction("계정 탈퇴", "연동 계정의 서버 진행과 계정 정보 삭제를 요청합니다. 기기의 로컬 저장 초기화와는 별도입니다.", () => accountApi.requestWithdrawal()), true); y += 110;
    return y;
  }

  /** 텍스트형 진입점도 최소 88px 터치 영역과 눌림 확대 규칙을 갖는다. */
  private addTextAction(x: number, y: number, label: string, action: () => void, destructive = false): void {
    const button = this.add.text(x, y, label, textStyle({ role: "emphasis", size: 27, color: destructive ? COLOR.dangerText : COLOR.accentText })).setOrigin(0, 0.5);
    const hit = this.add.rectangle(x + 420, y, 840, 88, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => button.setScale(1.08)); hit.on("pointerout", () => button.setScale(1)); hit.on("pointerup", () => { button.setScale(1); if (!this.accountBusy) action(); });
    this.content.add([button, hit]);
  }

  /** 캐시는 진행 저장과 분리해 Cache Storage의 다운로드 자산만 지운다. */
  private async clearCache(): Promise<void> {
    if ("caches" in globalThis) await Promise.all((await caches.keys()).map(key => caches.delete(key)));
    this.popups.confirm({ title: "캐시 정리 완료", message: "다운로드 캐시만 정리했습니다. 계정과 저장 진행은 유지됩니다.", confirmLabel: "확인" }, () => undefined);
  }

  /** 정책은 새 탭을 우선 사용하되 팝업 차단 시 같은 탭으로 이동해 문서 접근을 보장한다. */
  private openPolicy(path: PolicyPath): void { openPolicyDocument(path); }

  /** 한 번의 확인 뒤 환경설정만 복원하고 지원 탭을 재생성해 모든 입력과 글자 배율을 즉시 동기화한다. */
  private confirmSettingsReset(): void {
    this.popups.confirm({ title: "환경설정 초기화", message: "사운드·알림·게임·접근성 설정을 기본값으로 되돌립니다. 진행 데이터와 계정 상태는 유지됩니다.", confirmLabel: "초기화" }, () => {
      settingsManager.reset();
      // 현재 반환 경로도 함께 넘겨 초기화 뒤 뒤로가기가 사용자가 들어온 화면을 그대로 가리키게 한다.
      this.scene.restart({ tab: "support", returnScene: this.returnScene, returnData: this.returnData });
    });
  }

  /** 1차 위험 안내 후 2차 최종 확인을 거쳐 로컬 저장만 삭제한다. */
  private confirmLocalReset(): void {
    this.popups.confirm({ title: "저장 데이터 초기화", message: "1단계: 이 기기의 로컬 진행만 삭제합니다. 로그아웃하지 않으며 연동 계정의 서버 데이터는 삭제하지 않습니다.", confirmLabel: "다음", destructive: true }, () => {
      this.popups.confirm({ title: "최종 확인", message: "2단계: 삭제한 로컬 진행은 복구할 수 없습니다. 정말 초기화하시겠습니까?", confirmLabel: "초기화", destructive: true }, () => { saveManager.reset(); this.scene.start("boot"); });
    });
  }

  /** 별 다섯까지 남은 재료를 한 번에 넣고 실제로 지급한 수만 알린다. */
  private grantBreakthroughSet(relicId: string): void {
    if (!session.owned.has(relicId)) {
      this.popups.confirm({ title: "돌파 세트", message: "먼저 그 캐릭터를 보유해야 합니다.", confirmLabel: "확인" }, () => undefined);
      return;
    }
    const granted = relicProgression.grantBreakthroughSetForDebug(relicId);
    const name = getRelic(relicId).name;
    this.popups.confirm({
      title: name + " 돌파 세트",
      message: granted.fragments > 0 || granted.cheesecake > 0
        ? `${name} 파편 ${granted.fragments}개와 치즈케이크 ${granted.cheesecake.toLocaleString()}개를 지급했습니다. 급여로 상한까지 올린 뒤 돌파 등급 옆의 한계 돌파를 누릅니다.`
        : "이미 돌파 등급 V까지 키운 캐릭터입니다.",
      confirmLabel: "확인",
    }, () => undefined);
  }

  /** 미보유 렐릭만 채워 넣고 몇 명이 새로 늘었는지만 짧게 알린다. */
  private grantAllRelics(): void {
    const grantedCount = relicCollection.grantAllForDebug();
    this.popups.confirm({ title: "모든 캐릭터 획득", message: grantedCount > 0 ? `새 캐릭터 ${grantedCount}명을 보유 처리했습니다.` : "이미 모든 캐릭터를 보유하고 있습니다.", confirmLabel: "확인" }, () => undefined);
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
    if (result.ok) { this.scene.start("boot"); return; }
    this.showAccountFailure(result.code);
  }

  /** 로그아웃/탈퇴는 저장 초기화와 별개의 공용 확인 팝업을 통과한다. */
  private confirmAccountAction(title: string, message: string, operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): void {
    this.popups.confirm({ title, message, confirmLabel: title, destructive: true }, () => void this.runAccountAction(operation));
  }

  /** 전환 중 입력을 잠그고 성공하면 부트의 저장 검증·마이그레이션 경계를 다시 탄다. */
  private async runAccountAction(operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): Promise<void> {
    this.accountBusy = true; this.input.enabled = false; const result = await operation(); this.accountBusy = false; this.input.enabled = true;
    if (result.ok) { this.scene.start("boot"); return; }
    this.showAccountFailure(result.code ?? "network-error");
  }

  /** 서버 계약의 실패 코드를 플레이어용 문구로 한곳에서 바꾼다. */
  private showAccountFailure(code: AccountFailureCode): void {
    const labels: Record<AccountFailureCode, string> = { unsupported: "계정 연동 미지원", cancelled: "로그인이 취소되었습니다.", "network-error": "네트워크 연결을 확인해 주세요.", "guest-merge-unavailable": "게스트 진행을 기존 계정에 합칠 수 없습니다.", "conflict-cancelled": "저장 충돌 선택을 취소했습니다.", "save-conflict": "다른 기기에서 저장이 갱신되었습니다. 다시 시도해 주세요.", "invalid-remote-save": "서버 저장을 확인할 수 없습니다." };
    this.popups.confirm({ title: "계정 안내", message: labels[code], confirmLabel: "확인" }, () => undefined);
  }

  /** 현재 탭 높이만 기준으로 콘텐츠를 움직여 다른 탭 영역으로 새지 않게 한다. */
  private scrollTo(value: number): void { const min = Math.min(0, 1370 - Number(this.content.getData("height") || 0)); this.scrollY = Phaser.Math.Clamp(value, min, 0); this.content.y = 286 + this.scrollY; }
}
