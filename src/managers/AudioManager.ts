import Phaser from "phaser";
import type { GameSettings } from "../state/session";
import { settingsManager, type SettingsManager } from "./SettingsManager";

/** 중앙 믹서가 구분하는 출력 버스다. */
export type AudioBus = "music" | "sfx" | "voice";

/** 실제 에셋이 추가되기 전에도 호출부가 의미만 전달하도록 고정한 지원 사운드 목록이다. */
export type AudioCue = "excavation.crack";

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

const CUES: Record<AudioCue, { key: string; bus: AudioBus }> = {
  // 실제 파일이 들어오면 로딩 목록에 이 키를 등록한다. 지금은 has=false일 때 의도적으로 무음 폴백한다.
  "excavation.crack": { key: "sfx-excavation-crack", bus: "sfx" },
};

/** master × category × mute 공식을 유일하게 계산하고 Phaser Sound 수명을 소유한다. */
export class AudioManager {
  private readonly sounds = new Map<ManagedSound, AudioBus>();
  private music?: ManagedSound;
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
    const category = bus === "music" ? value.sound.musicVolume : bus === "sfx" ? value.sound.effectsVolume : value.sound.voiceVolume;
    const muted = value.sound.masterMuted || (bus === "music" ? value.sound.musicMuted : bus === "sfx" ? value.sound.effectsMuted : value.sound.voiceMuted);
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

  /** 배경음을 짧게 교차 전환하며 음소거 중인 새 트랙도 0에서 시작시킨다. */
  playMusic(key: string): boolean {
    if (this.disposed || !this.backend.has(key)) return false;
    const previous = this.music;
    const next = this.backend.create(key, true);
    this.music = next;
    this.sounds.set(next, "music");
    const target = this.hidden ? 0 : this.volume("music");
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
    sound.setVolume(this.volume(definition.bus));
    this.sounds.set(sound, definition.bus);
    owned.add(sound);
    return sound.play();
  }

  private applySettings(value: GameSettings): void {
    for (const [sound, bus] of this.sounds) {
      this.backend.cancelFade(sound);
      sound.setVolume(this.hidden ? 0 : this.volume(bus, value));
    }
  }

  private remove(sound: ManagedSound): void {
    this.backend.cancelFade(sound);
    sound.stop();
    sound.destroy();
    this.sounds.delete(sound);
    if (this.music === sound) this.music = undefined;
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
