import Phaser from "phaser";
import { BASE_WIDTH } from "../config/gameConfig";
import { drawGlyph } from "./glyphs";
import { pressIn, pressOut } from "./pressFeedback";
import { registerSettingsAccess } from "./settingsAccess";

/**
 * 설정 톱니 한 장 — 상단 줄 오른쪽 끝과 같은 자리·같은 모양.
 *
 * 상단 줄(`TopBar`)이 세우는 그 톱니와, 상단 줄 없이 화면 전체를 쓰는 대사 화면이 같은 함수를 지난다.
 * 화면마다 제 톱니를 그리면 같은 "설정"이 어디서는 우상단, 어디서는 대사판 칩으로 갈린다.
 */
export const SETTINGS_GEAR = { x: BASE_WIDTH - 58, size: 42, hit: 84, color: 0xc9ccd2 } as const;

/** 상단 줄이 `y`에 설 때 톱니가 서는 높이 — 상단 줄 없는 화면도 같은 높이를 쓴다. */
export function settingsGearY(barY = 40): number { return barY + 46; }

export interface SettingsGear { icon: Phaser.GameObjects.Container; hit: Phaser.GameObjects.Rectangle }

export function addSettingsGear(scene: Phaser.Scene, y: number, onClick: () => void): SettingsGear {
  const icon = scene.add.container(SETTINGS_GEAR.x, y);
  icon.add(drawGlyph(scene, "settings", 0, 0, SETTINGS_GEAR.size, SETTINGS_GEAR.color));
  const hit = scene.add.rectangle(SETTINGS_GEAR.x, y, SETTINGS_GEAR.hit, SETTINGS_GEAR.hit, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(icon));
  hit.on("pointerout", () => pressOut(icon, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(icon); onClick(); });
  // 튜토리얼 막이 화면을 덮어도 설정만은 열리게 막 위로 올라갈 수 있게 적어 둔다(`settingsAccess`).
  registerSettingsAccess(scene, [icon], hit);
  return { icon, hit };
}
