import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { settingsManager } from "../managers/SettingsManager";
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

/** 설정 씬은 배치와 입력 연결만 맡고 값 보정·저장·알림은 SettingsManager에 위임한다. */
export class SettingsScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container; private scrollY = 0; private startY = 0;
  private readonly popups = new PopupLayer(this, 3000);
  private accountState: AccountState = { kind: "guest", provider: "guest", maskedId: "GUEST-••••" };
  private accountBusy = false;
  constructor() { super("settings"); }
  create(): void {
    // 캔버스 제목을 DOM에서 읽을 수 없는 E2E에도 실제 사용자 표시 문구를 함께 공개한다.
    setDebugScene("settings", "환경 설정"); addSceneBackground(this, BACKGROUND.lobby);
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void, 0.82).setDepth(-20);
    this.add.text(54, 60, "환경 설정", textStyle({ role: "display", size: 52 })).setDepth(20);
    this.add.text(54, 124, "SYSTEM CONFIGURATION", textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setDepth(20);
    this.content = this.add.container(0, 190); const maskShape = this.make.graphics({ x: 0, y: 0 }, false); maskShape.fillStyle(0xffffff).fillRect(34, 180, 1012, 1530); this.content.setMask(maskShape.createGeometryMask());
    this.buildRows();
    void accountApi.getState().then(result => { if (result.ok && this.scene.isActive()) { this.accountState = result.value; this.buildRows(); } });
    // 투명 입력면 하나가 빈 여백에서도 스크롤을 받아 긴 목록의 조작이 끊기지 않게 한다.
    const zone = this.add.zone(BASE_WIDTH / 2, 945, BASE_WIDTH, 1530).setInteractive({ draggable: true }).setDepth(-1);
    zone.on("dragstart", (p: Phaser.Input.Pointer) => { this.startY = p.y - this.scrollY; }); zone.on("drag", (p: Phaser.Input.Pointer) => this.scrollTo(p.y - this.startY));
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollTo(this.scrollY - dy));
    addBackButton(this, () => this.scene.start("lobby")).setDepth(30);
  }
  /** 섹션 패널은 HOLO.glass와 윗변/구분선만 사용해 사방 테두리를 피한다. */
  private buildRows(): void {
    // 비동기 계정 상태 갱신 때 기존 행을 비우고 같은 테마로 다시 그린다.
    this.content.removeAll(true);
    const s = settingsManager.get(); let y = 0;
    const section = (title: string, height: number) => { const center = y + height / 2; const panel = drawLayer(this, BASE_WIDTH / 2, center, slantedRect(980, height, 14), { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.42 }); this.content.add(panel); this.content.add(this.add.text(72, y + 24, title, textStyle({ role: "emphasis", size: 32, color: COLOR.accentText }))); y += 88; };
    const divider = () => { const line = drawHairline(this, BASE_WIDTH / 2, y, 890, { alpha: 0.16 }); this.content.add(line); };
    const toggle = <K extends "vibration" | "notifications" | "presentation" | "game">(label: string, group: K, key: keyof typeof s[K]) => { this.content.add(new SettingsToggle(this, 90, y, label, s[group][key] as boolean, value => settingsManager.update({ [group]: { [key]: value } }))); y += 90; divider(); };
    section("사운드", 850); ([['전체 음량','masterVolume'],['배경음','musicVolume'],['효과음','effectsVolume'],['보이스','voiceVolume']] as const).forEach(([label,key]) => { this.content.add(new SettingsSlider(this, 90, y, label, s.sound[key], value => settingsManager.update({ sound: { [key]: value } }))); y += 88; });
    ([['전체 음소거','masterMuted'],['배경음 음소거','musicMuted'],['효과음 음소거','effectsMuted'],['보이스 음소거','voiceMuted']] as const).forEach(([label,key]) => { this.content.add(new SettingsToggle(this,90,y,label,s.sound[key],value=>settingsManager.update({sound:{[key]:value}}))); y+=90; divider(); }); y += 30;
    section("진동", 560); ([['전체 진동','enabled'],['전투 타격','combatHit'],['궁극기','ultimate'],['발굴 결과','excavationResult'],['UI 입력','uiInput']] as const).forEach(([a,b]) => toggle(a,'vibration',b)); y += 28;
    section("알림", 820);
    // 권한 요청은 일반 토글과 분리된 이 명시적 확인 버튼에서만 시작한다.
    const permission = platformFeedback.getNotificationPermission();
    const activate = this.add.text(90, y, s.notifications.enabled ? "알림 활성화됨" : "알림 활성화 확인", textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setInteractive({ useHandCursor: true });
    activate.on("pointerup", async () => { const granted = await settingsManager.confirmNotifications(); activate.setText(granted ? "알림 활성화됨" : "알림 권한을 사용할 수 없음"); }); this.content.add(activate); y += 52;
    const support = platformFeedback.notificationScheduling === "persistent" ? "백그라운드 예약 지원" : platformFeedback.notificationScheduling === "foreground-only" ? "웹에서는 탭이 열려 있을 때만 예약 알림을 보장합니다." : "이 브라우저는 예약 알림을 지원하지 않습니다.";
    this.content.add(this.add.text(90, y, `${support} (현재 권한: ${permission})`, textStyle({ role: "body", size: 21, color: COLOR.inkDim }))); y += 70; divider();
    ([['스테미나 충전 완료','staminaFull'],['무료 모집','freeRecruit'],['일일 임무','dailyMission'],['이벤트','event'],['우편','mail'],['야간 알림 제한','quietHours']] as const).forEach(([a,b]) => toggle(a,'notifications',b)); y += 28;
    section("연출 · 게임", 920); ([['궁극기 컷인','ultimateCutIn'],['화면 흔들림','screenShake'],['피해 숫자','damageNumbers'],['발굴 연출 단축','shortenExcavation'],['저사양 모드','lowSpecMode']] as const).forEach(([a,b]) => toggle(a,'presentation',b)); this.content.add(new SettingsSelectRow(this,90,y,'전투 배속',s.game.battleSpeed,[1,1.5,2] as const,v=>settingsManager.update({game:{battleSpeed:v}}))); y+=90; toggle('자동 궁극기','game','autoUltimate'); this.content.add(new SettingsSelectRow(this,90,y,'텍스트 속도',s.game.textSpeed,[0.5,1,2] as const,v=>settingsManager.update({game:{textSpeed:v}}))); y+=90; this.content.add(new SettingsSelectRow(this,90,y,'언어',s.game.language,['ko','en','ja'] as const,v=>settingsManager.update({game:{language:v}}))); y+=125;
    section("계정", 430);
    const account = this.accountState;
    this.content.add(this.add.text(90, y, `상태  ${account.kind === "guest" ? "게스트" : "연동됨"}\n제공자  ${account.provider.toUpperCase()}\n식별 ID  ${account.maskedId}`, textStyle({ role: "body", size: 26, color: COLOR.inkDim, lineSpacing: 10 }))); y += 145;
    // 텍스트 버튼도 기존 홀로그램 강조색과 눌림 확대 규칙을 따른다.
    const accountButton = (x: number, label: string, action: () => void, destructive = false) => { const button = this.add.text(x, y, label, textStyle({ role: "emphasis", size: 25, color: destructive ? "#ff8c88" : COLOR.accentText })).setInteractive({ useHandCursor: true }); button.on("pointerdown", () => button.setScale(1.1)); button.on("pointerout", () => button.setScale(1)); button.on("pointerup", () => { if (!this.accountBusy) action(); }); this.content.add(button); };
    if (account.kind === "guest") {
      accountButton(90, "Google 연동", () => void this.login("google")); accountButton(350, "Apple 연동", () => void this.login("apple"));
    } else {
      accountButton(90, "로그아웃", () => this.confirmAccountAction("로그아웃", "이 기기의 계정 연결을 해제하시겠습니까?", () => accountApi.logout()), true);
      accountButton(350, "계정 탈퇴", () => this.confirmAccountAction("계정 탈퇴", "원격 진행과 계정 정보가 삭제될 수 있습니다. 계속하시겠습니까?", () => accountApi.requestWithdrawal()), true);
    }
    y += 130;
    section("고객지원", 250); this.content.add(this.add.text(90, y, "문의 · 이용약관 · 개인정보 처리방침", textStyle({ role: "body", size: 27, color: COLOR.inkDim }))); y += 150; this.content.setData("height", y);
  }
  /** 로그인은 플랫폼 경계만 호출하며 토큰이나 서버 DTO를 Session에 넣지 않는다. */
  private async login(provider: "google" | "apple"): Promise<void> { await this.runAccountAction(() => accountApi.login({ provider, mergeGuestProgress: true })); }

  /** 로그아웃/탈퇴는 반드시 공용 확인 팝업을 통과한다. */
  private confirmAccountAction(title: string, message: string, operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): void {
    this.popups.confirm({ title, message, confirmLabel: title, destructive: true }, () => void this.runAccountAction(operation));
  }

  /** 전환 중 전체 입력을 잠그고, 성공하면 부트의 저장 검증·마이그레이션 경계를 다시 탄다. */
  private async runAccountAction(operation: () => Promise<{ ok: boolean; code?: AccountFailureCode; message?: string }>): Promise<void> {
    this.accountBusy = true; this.input.enabled = false;
    const result = await operation();
    this.accountBusy = false; this.input.enabled = true;
    if (result.ok) { this.scene.start("boot"); return; }
    const labels: Record<AccountFailureCode, string> = { unsupported: "계정 연동 미지원", cancelled: "로그인이 취소되었습니다.", "network-error": "네트워크 연결을 확인해 주세요.", "guest-merge-unavailable": "게스트 진행을 기존 계정에 합칠 수 없습니다.", "conflict-cancelled": "저장 충돌 선택을 취소했습니다." };
    this.popups.confirm({ title: "계정 안내", message: labels[result.code ?? "network-error"], confirmLabel: "확인" }, () => undefined);
  }
  /** 콘텐츠만 마스크 안에서 움직이고 고정 헤더·뒤로가기는 그대로 둔다. */
  private scrollTo(value: number): void { const min = Math.min(0, 1480 - Number(this.content.getData("height"))); this.scrollY = Phaser.Math.Clamp(value, min, 0); this.content.y = 190 + this.scrollY; }
}
