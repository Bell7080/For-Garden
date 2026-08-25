import Phaser from "phaser";
import { session } from "../state/session";
import { drawHairline } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 연구소 탭 위에서만 열리는 임시 DNA/마일리지 전용 안내 팝업이다. */
export class MileagePopup {
  private body?: Phaser.GameObjects.Container;
  private closeAction?: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly onClosed?: () => void) {}

  /** 같은 인스턴스가 이미 열려 있으면 두 번째 입력 차단막을 만들지 않는다. */
  open(): void {
    if (this.body) return;
    this.body = this.popups.open({ width: 820, height: 620, title: "마일리지 상점", dim: true, closeOnBackdrop: false, onClose: () => this.dispose() }, (body, close) => {
      this.closeAction = close;
      // 임시 화면도 실제 보유량과 앞으로 쓰일 화면 경계만 보여 주고 가짜 교환은 제공하지 않는다.
      body.add(this.scene.add.text(0, -130, `보유 DNA  ${session.wallet.dnaFragments.toLocaleString()}`, textStyle({ role: "display", size: 38, color: "#ffe9a3" })).setOrigin(0.5));
      body.add(drawHairline(this.scene, 0, -65, 650, { color: COLOR.accent, alpha: 0.35 }));
      body.add(this.scene.add.text(0, 55, "교환 목록 준비 중", textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    });
  }

  /** 향후 연구소 뒤로가기 연결을 위한 단일 종료 진입점이다. */
  close(): void { this.closeAction?.(); }

  /** 닫힌 참조를 버려 다음 탭에서 입력이 정상 복구되게 한다. */
  private dispose(): void {
    this.body = undefined; this.closeAction = undefined; this.onClosed?.();
  }
}
