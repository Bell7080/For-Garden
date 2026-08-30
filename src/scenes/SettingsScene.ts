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
import { PopupLayer } from "../ui/PopupLayer";
import { validateSettingsReturn, type SettingsEntryData, type SettingsReturnScene } from "./settingsNavigation";
import { relicCollection } from "../managers/RelicCollectionManager";

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
      section("알림", 850);
      const permission = platformFeedback.getNotificationPermission();
      this.addTextAction(90, y, s.notifications.enabled ? "알림 활성화됨" : "알림 활성화 확인", () => void settingsManager.confirmNotifications().then(() => this.buildRows())); y += 64;
      this.content.add(this.add.text(90, y, `예약 지원: ${platformFeedback.notificationScheduling} · 권한: ${permission}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim }))); y += 72;
      ([['스테미나 충전 완료','staminaFull'],['무료 모집','freeRecruit'],['일일 임무','dailyMission'],['이벤트','event'],['우편','mail'],['야간 알림 제한','quietHours']] as const).forEach(([a,b]) => toggle(a,'notifications',b));
    } else if (this.activeTab === "play") {
      section("연출 · 게임", 1050);
      // 궁극기 연출 스킵은 전투 HUD의 즉시 조작으로 옮겼으므로 여기에는 화면 품질 옵션만 남긴다.
      ([['화면 흔들림','screenShake'],['피해 숫자','damageNumbers'],['연구 연출 단축','shortenExcavation'],['저사양 모드','lowSpecMode']] as const).forEach(([a,b]) => toggle(a,'presentation',b));
      // 인게임 배속 칩과 같은 1·2·3배 선택지를 보여 주며 SettingsManager가 즉시 저장한다.
      this.content.add(new SettingsSelectRow(this,90,y,'전투 배속',s.game.battleSpeed,[1,2,3] as const,v=>settingsManager.update({game:{battleSpeed:v}}))); y+=94;
      toggle('자동 궁극기','game','autoUltimate');
      this.content.add(new SettingsSelectRow(this,90,y,'텍스트 속도',s.game.textSpeed,[0.5,1,2] as const,v=>settingsManager.update({game:{textSpeed:v}}))); y+=94;
      this.content.add(new SettingsSelectRow(this,90,y,'언어',s.game.language,['ko','en','ja'] as const,v=>settingsManager.update({game:{language:v}}))); y+=110;
    } else if (this.activeTab === "access") {
      section("접근성", 650);
      this.content.add(new SettingsSelectRow(this,90,y,'텍스트 크기',s.accessibility.textScale,[1,1.15,1.3] as const,value=>{ settingsManager.update({accessibility:{textScale:value}}); this.scene.restart({ tab: "access" }); })); y+=94;
      toggle('화면 흔들림 감소','accessibility','reduceMotion'); toggle('섬광 감소','accessibility','reduceFlashes'); toggle('색각 보조','accessibility','colorAssist'); toggle('자막 표시','accessibility','subtitles');
      this.content.add(this.add.text(90, y + 28, "텍스트 배율은 공용 스타일에 적용되며 장면 좌표는 변경하지 않습니다.", textStyle({ role: "body", size: 22, color: COLOR.inkDim, wrap: 850 }))); y += 120;
    } else {
      y = this.buildSupportRows(y, section);
    }
    this.content.setData("height", y + 70); this.scrollTo(this.scrollY);
  }

  /** 지원·데이터 탭은 계정 연결, 정책 문서, 캐시와 저장 삭제를 한곳에서 구분한다. */
  private buildSupportRows(y: number, section: (title: string, height: number) => number): number {
    y = section("계정", 330);
    const account = this.accountState;
    this.content.add(this.add.text(90, y, `상태  ${account.kind === "guest" ? "게스트" : "연동됨"}\n제공자  ${account.provider.toUpperCase()}\n식별 ID  ${account.maskedId}`, textStyle({ role: "body", size: 26, color: COLOR.inkDim, lineSpacing: 10 }))); y += 150;
    if (account.kind === "guest") { this.addTextAction(90, y, "Google 연동", () => void this.login("google")); this.addTextAction(350, y, "Apple 연동", () => void this.login("apple")); }
    else { this.addTextAction(90, y, "로그아웃", () => this.confirmAccountAction("로그아웃", "계정 연결만 해제합니다. 저장 데이터 초기화와 서버 데이터 삭제는 실행하지 않습니다.", () => accountApi.logout()), true); }
    y += 120; y = section("고객지원 · 데이터", 660);
    this.addTextAction(90, y, "캐시 정리", () => void this.clearCache()); y += 92;
    this.addTextAction(90, y, "이용약관", () => this.openPolicy("/terms")); y += 92;
    this.addTextAction(90, y, "개인정보 처리방침", () => this.openPolicy("/privacy")); y += 92;
    this.addTextAction(90, y, "저장 데이터 초기화", () => this.confirmLocalReset(), true); y += 92;
    // 스타터 렐릭 추가처럼 저장 마이그레이션이 소급하지 않는 변경을 QA가 재설치 없이 확인하는 임시 진입점이다.
    this.addTextAction(90, y, "모든 캐릭터 획득", () => this.grantAllRelics()); y += 92;
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

  /** 정책은 같은 출처의 문서 진입점으로 열어 배포 환경이 실제 문서를 연결할 수 있게 한다. */
  private openPolicy(path: "/terms" | "/privacy"): void { window.open(path, "_blank", "noopener,noreferrer"); }

  /** 1차 위험 안내 후 2차 최종 확인을 거쳐 로컬 저장만 삭제한다. */
  private confirmLocalReset(): void {
    this.popups.confirm({ title: "저장 데이터 초기화", message: "1단계: 이 기기의 로컬 진행만 삭제합니다. 로그아웃하지 않으며 연동 계정의 서버 데이터는 삭제하지 않습니다.", confirmLabel: "다음", destructive: true }, () => {
      this.popups.confirm({ title: "최종 확인", message: "2단계: 삭제한 로컬 진행은 복구할 수 없습니다. 정말 초기화하시겠습니까?", confirmLabel: "초기화", destructive: true }, () => { saveManager.reset(); this.scene.start("boot"); });
    });
  }

  /** 미보유 렐릭만 채워 넣고 몇 명이 새로 늘었는지만 짧게 알린다. */
  private grantAllRelics(): void {
    const grantedCount = relicCollection.grantAllForDebug();
    this.popups.confirm({ title: "모든 캐릭터 획득", message: grantedCount > 0 ? `새 캐릭터 ${grantedCount}명을 보유 처리했습니다.` : "이미 모든 캐릭터를 보유하고 있습니다.", confirmLabel: "확인" }, () => undefined);
  }

  /** 로그인은 플랫폼 경계만 호출하며 토큰이나 서버 DTO를 Session에 넣지 않는다. */
  private async login(provider: "google" | "apple"): Promise<void> { await this.runAccountAction(() => accountApi.login({ provider, mergeGuestProgress: true })); }

  /** 로그아웃/탈퇴는 저장 초기화와 별개의 공용 확인 팝업을 통과한다. */
  private confirmAccountAction(title: string, message: string, operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): void {
    this.popups.confirm({ title, message, confirmLabel: title, destructive: true }, () => void this.runAccountAction(operation));
  }

  /** 전환 중 입력을 잠그고 성공하면 부트의 저장 검증·마이그레이션 경계를 다시 탄다. */
  private async runAccountAction(operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): Promise<void> {
    this.accountBusy = true; this.input.enabled = false; const result = await operation(); this.accountBusy = false; this.input.enabled = true;
    if (result.ok) { this.scene.start("boot"); return; }
    const labels: Record<AccountFailureCode, string> = { unsupported: "계정 연동 미지원", cancelled: "로그인이 취소되었습니다.", "network-error": "네트워크 연결을 확인해 주세요.", "guest-merge-unavailable": "게스트 진행을 기존 계정에 합칠 수 없습니다.", "conflict-cancelled": "저장 충돌 선택을 취소했습니다." };
    this.popups.confirm({ title: "계정 안내", message: labels[result.code ?? "network-error"], confirmLabel: "확인" }, () => undefined);
  }

  /** 현재 탭 높이만 기준으로 콘텐츠를 움직여 다른 탭 영역으로 새지 않게 한다. */
  private scrollTo(value: number): void { const min = Math.min(0, 1370 - Number(this.content.getData("height") || 0)); this.scrollY = Phaser.Math.Clamp(value, min, 0); this.content.y = 286 + this.scrollY; }
}
