import Phaser from "phaser";
import type { PlayerProfileDisplay } from "../state/playerProfile";
import { HoloBar } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { setDebugPlayerProfileOpen } from "../debug";

/** 공개 프로필 정보만 공용 PopupLayer에 배치하는 작은 읽기 전용 정보창이다. */
export class PlayerProfilePopup {
  private opened = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: PopupLayer,
    private readonly profile: PlayerProfileDisplay,
    private readonly onClose: () => void,
  ) {}

  /** 중복 입력면을 만들지 않고 플레이어에게 의미 있는 공개 항목만 한 장에 그린다. */
  open(): void {
    if (this.opened || this.layer.isOpen) return;
    this.opened = true;
    setDebugPlayerProfileOpen(true);
    this.layer.open({ width: 820, height: 720, title: "플레이어 정보", dim: true, closeOnBackdrop: true, onClose: () => {
      this.opened = false;
      setDebugPlayerProfileOpen(false);
      this.onClose();
    } }, (body) => {
      const addValue = (y: number, label: string, value: string): void => {
        body.add(this.scene.add.text(-330, y, label, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(330, y, value, textStyle({ role: "emphasis", size: 26 })).setOrigin(1, 0.5));
      };
      body.add(this.scene.add.text(-330, -235, this.profile.displayName, textStyle({ role: "display", size: 44, color: COLOR.accentText })).setOrigin(0, 0.5));
      body.add(this.scene.add.text(330, -235, `LV.${this.profile.level}`, textStyle({ role: "emphasis", size: 30 })).setOrigin(1, 0.5));
      // 모든 진행 게이지는 공용 HoloBar를 사용해 전투·정보창과 같은 기울기 체계를 유지한다.
      const experience = new HoloBar(this.scene, 0, -155, 660, 18, { color: COLOR.accent, trackAlpha: 0.8, outline: true }).addTo(body);
      experience.setValue(this.profile.experience / Math.max(1, this.profile.experienceToNext));
      body.add(this.scene.add.text(330, -118, `${this.profile.experience.toLocaleString()} / ${this.profile.experienceToNext.toLocaleString()} EXP`, textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(1, 0.5));
      addValue(-35, "공개 ID", this.profile.displayId);
      addValue(55, "대표 렐릭", this.profile.representativeRelic);
      addValue(145, "프로필 장식", this.profile.profileFrameKey);
    });
  }

  /** 씬 종료나 외부 조작도 PopupLayer의 단일 닫기 경로를 사용하게 한다. */
  close(): void { if (this.opened) this.layer.closeTop(); }
}
