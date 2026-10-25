import Phaser from "phaser";
import type { GameSettings } from "../state/session";
import { settingsManager, type SettingsManager } from "./SettingsManager";

/** 중앙 믹서가 구분하는 출력 버스다. */
export type AudioBus = "music" | "sfx" | "ui" | "voice";

/** 실제 에셋이 추가되기 전에도 호출부가 의미만 전달하도록 고정한 지원 사운드 목록이다. */
export type AudioCue = "research.crack" | UiCue | SfxCue;

/** 전투의 굵직한 순간(궁극기·승패)에 붙는 효과음이다. 씬이 `playSfx`로 의미만 넘긴다. */
export type SfxCue = "battle.ultimate" | "battle.victory" | "battle.defeat";

/** 버튼·팝업·탭처럼 화면 조작에 붙는 소리다. 씬이 고르지 않고 공용 UI 경계가 `playUi`로 부른다. */
export type UiCue = "ui.click" | "ui.panel.open" | "ui.panel.close" | "ui.tab" | "ui.confirm" | "ui.deny";

/** UI 소리의 에셋 목록이다. **임시 시안**이며 같은 이름의 파일을 바꿔 끼우면 코드는 그대로다. */
export const UI_SOUND_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  ["ui-click", "audio/ui/ui-click.mp3"],
  ["ui-panel-open", "audio/ui/ui-panel-open.mp3"],
  ["ui-panel-close", "audio/ui/ui-panel-close.mp3"],
  ["ui-tab", "audio/ui/ui-tab.mp3"],
  ["ui-confirm", "audio/ui/ui-confirm.mp3"],
  ["ui-deny", "audio/ui/ui-deny.mp3"],
];

/** 전투 효과음의 에셋 목록이다. **임시 시안**(ElevenLabs 생성음)이며 같은 이름의 파일을 바꿔 끼우면 코드는 그대로다. */
export const BATTLE_SOUND_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  ["battle-ultimate", "audio/battle/battle-ultimate.mp3"],
  ["battle-victory", "audio/battle/battle-victory.mp3"],
  ["battle-defeat", "audio/battle/battle-defeat.mp3"],
];

/** Phaser 사운드를 테스트 대역으로 바꿀 수 있게 하는 최소 재생 인스턴스 계약이다. */
export interface ManagedSound {
  volume: number;
  isPlaying: boolean;
  play(): boolean;
  stop(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  setVolume(volume: number): this;
}

/** 사운드 생성과 페이드를 AudioManager 내부에 가두기 위한 런타임 어댑터 계약이다. */
export interface AudioBackend {
  has(key: string): boolean;
  create(key: string, loop: boolean): ManagedSound;
  fade(sound: ManagedSound, volume: number, durationMs: number, done?: () => void): void;
  cancelFade(sound: ManagedSound): void;
}

/** 씬이 중앙 사운드의 생성·정지를 직접 만지지 않도록 제공하는 수명 주기 핸들이다. */
export interface AudioScope {
  /** 살아 있는 씬에서만 의미 기반 효과음을 요청하며 없는 에셋은 조용히 건너뛴다. */
  play(cue: AudioCue): boolean;
  /** 씬 종료 시 이후 요청을 무효화하고 이 씬이 시작한 단발음을 정리한다. */
  release(): void;
}

/** `gain`은 시안마다 들쭉날쭉한 크기를 맞추는 큐별 보정이다(버스 볼륨에 곱한다). */
const CUES: Record<AudioCue, { key: string; bus: AudioBus; gain?: number }> = {
  // 연구소 획득 연구의 균열음이다. 배치형 자원 발굴과 분리하며, 에셋이 없을 때는 의도적으로 무음 폴백한다.
  "research.crack": { key: "sfx-research-crack", bus: "sfx" },
  "ui.click": { key: "ui-click", bus: "ui", gain: 0.6 },
  "ui.panel.open": { key: "ui-panel-open", bus: "ui", gain: 0.7 },
  "ui.panel.close": { key: "ui-panel-close", bus: "ui", gain: 0.6 },
  "ui.tab": { key: "ui-tab", bus: "ui", gain: 0.6 },
  "ui.confirm": { key: "ui-confirm", bus: "ui", gain: 0.8 },
  "ui.deny": { key: "ui-deny", bus: "ui", gain: 0.8 },
  "battle.ultimate": { key: "battle-ultimate", bus: "sfx", gain: 0.7 },
  "battle.victory": { key: "battle-victory", bus: "sfx", gain: 0.9 },
  "battle.defeat": { key: "battle-defeat", bus: "sfx", gain: 0.9 },
};

/** master × category × mute 공식을 유일하게 계산하고 Phaser Sound 수명을 소유한다. */
export class AudioManager {
  private readonly sounds = new Map<ManagedSound, AudioBus>();
  private music?: ManagedSound;
  private musicKey?: string;
  private musicGain = 1;
  /** 한 번 울리는 소리(UI·전투)는 큐마다 사운드 하나를 재사용한다 — 연타하면 앞 소리를 끊고 다시 울려 인스턴스가 쌓이지 않는다. */
  private readonly uiSounds = new Map<AudioCue, ManagedSound>();
  private hidden = false;
  private disposed = false;
  private readonly onSettings = (event: Event): void => this.applySettings((event as CustomEvent<GameSettings>).detail);
  private readonly onVisibility = (): void => this.setHidden(document.hidden);

  constructor(private readonly backend: AudioBackend, private readonly settings: SettingsManager = settingsManager, private readonly fadeMs = 250, watchDocument = true) {
    this.settings.addEventListener("change", this.onSettings);
    if (watchDocument && typeof document !== "undefined") document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** 현재 설정에 따른 버스의 최종 출력값(master × category × mute)을 반환한다. */
  volume(bus: AudioBus, value: GameSettings = this.settings.get()): number {
    // ui 버스는 별도 슬라이더가 생기기 전까지 효과음 설정을 따른다. 버스는 분리돼 있어 나중에 설정 줄만 더하면 된다.
    const category = bus === "music" ? value.sound.musicVolume : bus === "sfx" || bus === "ui" ? value.sound.effectsVolume : value.sound.voiceVolume;
    const muted = value.sound.masterMuted || (bus === "music" ? value.sound.musicMuted : bus === "sfx" || bus === "ui" ? value.sound.effectsMuted : value.sound.voiceMuted);
    return muted ? 0 : value.sound.masterVolume * category;
  }

  /** 씬 종료 뒤 늦게 도착한 요청까지 차단하는 씬 전용 재생 범위를 만든다. */
  createScope(): AudioScope {
    let active = true;
    const owned = new Set<ManagedSound>();
    return {
      play: (cue) => active && this.playCue(cue, owned),
      release: () => {
        if (!active) return;
        active = false;
        for (const sound of owned) this.remove(sound);
        owned.clear();
      },
    };
  }

  /** 화면 조작 소리를 한 번 울린다. 씬 수명과 무관하며 에셋이 없거나 앱이 숨겨져 있으면 조용히 건너뛴다. */
  playUi(cue: UiCue): boolean { return this.playShared(cue); }

  /** 전투의 굵직한 순간 소리를 한 번 울린다. 규칙은 `playUi`와 같다. */
  playSfx(cue: SfxCue): boolean { return this.playShared(cue); }

  private playShared(cue: AudioCue): boolean {
    const definition = CUES[cue];
    if (this.disposed || this.hidden || !this.backend.has(definition.key)) return false;
    let sound = this.uiSounds.get(cue);
    if (!sound) {
      sound = this.backend.create(definition.key, false);
      this.uiSounds.set(cue, sound);
      this.sounds.set(sound, definition.bus);
    }
    sound.stop();
    sound.setVolume(this.volume(definition.bus) * (definition.gain ?? 1));
    return sound.play();
  }

  /** 지금 배경음으로 재생 중인(혹은 재생하려는) 트랙 키다. */
  get currentMusicKey(): string | undefined { return this.musicKey; }

  /**
   * 배경음을 짧게 교차 전환하며 음소거 중인 새 트랙도 0에서 시작시킨다. 같은 트랙을 다시 부르면
   * 처음부터 되감지 않고 그대로 둔다(화면이 바뀌어도 같은 곡이면 이어 흐른다). `gain`은 트랙별 크기 보정이다.
   */
  playMusic(key: string, gain = 1): boolean {
    if (this.disposed || !this.backend.has(key)) return false;
    if (this.music && this.musicKey === key) return true;
    const previous = this.music;
    const next = this.backend.create(key, true);
    this.music = next;
    this.musicKey = key;
    this.musicGain = gain;
    this.sounds.set(next, "music");
    const target = this.hidden ? 0 : this.volume("music") * gain;
    next.setVolume(0);
    next.play();
    if (this.hidden) next.pause(); else this.backend.fade(next, target, this.fadeMs);
    if (previous) this.backend.fade(previous, 0, this.fadeMs, () => this.remove(previous));
    return true;
  }

  /** 앱 숨김/복귀 상태를 반영하고 복귀 시 현재 사용자 설정으로만 출력을 복원한다. */
  setHidden(hidden: boolean): void {
    if (this.hidden === hidden || this.disposed) return;
    this.hidden = hidden;
    for (const sound of this.sounds.keys()) {
      if (hidden && sound.isPlaying) sound.pause();
      else if (!hidden && !sound.isPlaying) sound.resume();
    }
    this.applySettings(this.settings.get());
  }

  /** 전역 리스너와 모든 활성 사운드를 정리해 게임 인스턴스 교체 시 누수를 막는다. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.settings.removeEventListener("change", this.onSettings);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisibility);
    for (const sound of [...this.sounds.keys()]) this.remove(sound);
  }

  private playCue(cue: AudioCue, owned: Set<ManagedSound>): boolean {
    const definition = CUES[cue];
    if (this.disposed || this.hidden || !this.backend.has(definition.key)) return false;
    const sound = this.backend.create(definition.key, false);
    sound.setVolume(this.volume(definition.bus) * (definition.gain ?? 1));
    this.sounds.set(sound, definition.bus);
    owned.add(sound);
    return sound.play();
  }

  private applySettings(value: GameSettings): void {
    for (const [sound, bus] of this.sounds) {
      this.backend.cancelFade(sound);
      sound.setVolume(this.hidden ? 0 : this.volume(bus, value) * this.gainOf(sound));
    }
  }

  /** UI 소리는 큐별 보정이 있어 설정이 바뀌어도 그 비율을 지킨다. */
  private gainOf(sound: ManagedSound): number {
    if (sound === this.music) return this.musicGain;
    for (const [cue, ui] of this.uiSounds) if (ui === sound) return CUES[cue].gain ?? 1;
    return 1;
  }

  private remove(sound: ManagedSound): void {
    for (const [cue, ui] of this.uiSounds) if (ui === sound) this.uiSounds.delete(cue);
    this.backend.cancelFade(sound);
    sound.stop();
    sound.destroy();
    this.sounds.delete(sound);
    if (this.music === sound) { this.music = undefined; this.musicKey = undefined; }
  }
}

/** Phaser의 생성·Tween 세부 구현을 중앙 관리자가 쓰는 작은 계약으로 변환한다. */
export class PhaserAudioBackend implements AudioBackend {
  private readonly fades = new Map<ManagedSound, number>();
  constructor(private readonly game: Phaser.Game) {}

  /** Phaser 오디오 캐시에 실제 키가 준비됐는지 확인한다. */
  has(key: string): boolean { return this.game.cache.audio.exists(key); }

  /** Phaser Sound 인스턴스 생성은 이 어댑터를 통해서만 수행한다. */
  create(key: string, loop: boolean): ManagedSound { return this.game.sound.add(key, { loop }) as unknown as ManagedSound; }

  /** 씬과 독립된 애니메이션 프레임으로 볼륨을 전환하고 완료 콜백을 한 번 전달한다. */
  fade(sound: ManagedSound, volume: number, durationMs: number, done?: () => void): void {
    this.cancelFade(sound);
    const initial = sound.volume;
    const startedAt = performance.now();
    // 특정 씬의 TweenManager에 기대지 않아 배경음이 씬 전환 중에도 끊김 없이 교차한다.
    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      sound.setVolume(initial + (volume - initial) * progress);
      if (progress < 1) this.fades.set(sound, requestAnimationFrame(step));
      else { this.fades.delete(sound); done?.(); }
    };
    this.fades.set(sound, requestAnimationFrame(step));
  }

  /** 설정 변경이나 정지 시 진행 중인 페이드가 새 볼륨을 덮어쓰지 않도록 취소한다. */
  cancelFade(sound: ManagedSound): void {
    const frame = this.fades.get(sound);
    if (frame !== undefined) cancelAnimationFrame(frame);
    this.fades.delete(sound);
  }
}

/** 앱 전체가 공유하며 main에서 Phaser 백엔드를 연결하는 오디오 진입점이다. */
export let audioManager: AudioManager | undefined;

/** Phaser 게임 생성 직후 중앙 오디오 관리자를 한 번 구성한다. */
export function initializeAudioManager(game: Phaser.Game): AudioManager {
  audioManager?.dispose();
  audioManager = new AudioManager(new PhaserAudioBackend(game));
  return audioManager;
}
