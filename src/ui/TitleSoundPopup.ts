import { t, type TextKey } from "../i18n";
import { settingsManager } from "../managers/SettingsManager";
import type { PopupLayer } from "./PopupLayer";
import { SettingsSlider } from "./SettingsSlider";
import { SettingsToggle } from "./SettingsToggle";
import { TITLE_SOUND_POPUP } from "./titleSoundPopupLayout";

type VolumeKey = "masterVolume" | "musicVolume" | "effectsVolume" | "voiceVolume";

const VOLUME_ROWS: ReadonlyArray<readonly [TextKey, VolumeKey]> = [
  ["settings.sound.master", "masterVolume"],
  ["settings.sound.music", "musicVolume"],
  ["settings.sound.effects", "effectsVolume"],
  ["settings.sound.voice", "voiceVolume"],
];

/**
 * 타이틀에서 여는 소리 조절 판.
 *
 * 로그인 전에도 처음 듣는 배경음을 줄일 수 있어야 해서 타이틀에 둔다. 값은 환경설정의 사운드 탭과
 * **같은 줄(`SettingsSlider`·`SettingsToggle`)·같은 저장 경로(`settingsManager.update`)** 를 지나므로
 * 여기서 바꾼 값이 그대로 환경설정에 서고, 다음 실행에도 남는다. 판 오른쪽 위 X는 두지 않는다 —
 * 닫는 길은 판 밖 우하단 뒤로가기와 판 밖 누르기다(`PopupLayer.open` 기본값).
 */
export function openTitleSoundPopup(scene: Phaser.Scene, popups: PopupLayer): void {
  const { width, height, rowLeft, firstRowY, step } = TITLE_SOUND_POPUP;
  const sound = settingsManager.get().sound;
  popups.open({ width, height, title: t("settings.tab.sound"), dim: true }, (body) => {
    let y = firstRowY;
    VOLUME_ROWS.forEach(([label, key]) => {
      body.add(new SettingsSlider(scene, rowLeft, y, t(label), sound[key], (value) => settingsManager.update({ sound: { [key]: value } })));
      y += step;
    });
    body.add(new SettingsToggle(scene, rowLeft, y, t("settings.sound.masterMuted"), sound.masterMuted, (value) => settingsManager.update({ sound: { masterMuted: value } })));
  });
}
