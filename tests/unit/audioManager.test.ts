import { describe, expect, it, vi } from "vitest";
import { AudioManager, type AudioBackend, type ManagedSound } from "../../src/managers/AudioManager";
import { SettingsManager } from "../../src/managers/SettingsManager";
import { createDefaultSession } from "../../src/state/session";

/** 중앙 관리자가 Phaser에 의존하지 않고 수명과 볼륨을 검증하도록 하는 가짜 사운드다. */
class FakeSound implements ManagedSound {
  volume = -1;
  isPlaying = false;
  stopped = false;
  destroyed = false;
  play(): boolean { this.isPlaying = true; return true; }
  stop(): void { this.stopped = true; this.isPlaying = false; }
  pause(): void { this.isPlaying = false; }
  resume(): void { this.isPlaying = true; }
  destroy(): void { this.destroyed = true; }
  setVolume(volume: number): this { this.volume = volume; return this; }
}

/** 에셋 존재 여부와 페이드 결과를 결정적으로 기록하는 테스트 백엔드다. */
class FakeBackend implements AudioBackend {
  sounds: FakeSound[] = [];
  fades: Array<{ sound: FakeSound; volume: number }> = [];
  constructor(public available = true) {}
  has(): boolean { return this.available; }
  create(): FakeSound { const sound = new FakeSound(); this.sounds.push(sound); return sound; }
  fade(sound: ManagedSound, volume: number, _durationMs: number, done?: () => void): void {
    sound.setVolume(volume); this.fades.push({ sound: sound as FakeSound, volume }); done?.();
  }
  cancelFade(): void { /* 가짜 페이드는 즉시 끝나므로 취소할 예약 작업이 없다. */ }
}

/** 저장 부작용 없이 실제 SettingsManager 변경 이벤트를 사용하는 테스트 조립 함수다. */
function setup(): { audio: AudioManager; settings: SettingsManager; backend: FakeBackend } {
  const settings = new SettingsManager(createDefaultSession(), { save: vi.fn() });
  const backend = new FakeBackend();
  return { audio: new AudioManager(backend, settings, 250, false), settings, backend };
}

describe("AudioManager", () => {
  it("master와 category를 한 번만 곱하고 어느 mute든 0으로 만든다", () => {
    const { audio, settings } = setup();
    settings.update({ sound: { masterVolume: 0.5, effectsVolume: 0.4 } });
    expect(audio.volume("sfx")).toBeCloseTo(0.2);
    settings.update({ sound: { effectsMuted: true } });
    expect(audio.volume("sfx")).toBe(0);
    settings.update({ sound: { effectsMuted: false, masterMuted: true } });
    expect(audio.volume("sfx")).toBe(0);
  });

  it("설정 변경 이벤트를 활성 사운드에 즉시 반영한다", () => {
    const { audio, settings, backend } = setup();
    audio.createScope().play("excavation.crack");
    settings.update({ sound: { masterVolume: 0.5, effectsVolume: 0.2 } });
    expect(backend.sounds[0].volume).toBeCloseTo(0.1);
  });

  it("씬 범위 해제 후 사운드를 정리하고 오래된 요청을 거부한다", () => {
    const { audio, backend } = setup();
    const scope = audio.createScope();
    expect(scope.play("excavation.crack")).toBe(true);
    scope.release();
    expect(backend.sounds[0]).toMatchObject({ stopped: true, destroyed: true });
    expect(scope.play("excavation.crack")).toBe(false);
    expect(backend.sounds).toHaveLength(1);
  });

  it("없는 에셋은 무음 폴백하고 음소거 중 시작한 음악은 0을 유지한다", () => {
    const { audio, settings, backend } = setup();
    backend.available = false;
    expect(audio.createScope().play("excavation.crack")).toBe(false);
    expect(backend.sounds).toHaveLength(0);
    backend.available = true;
    settings.update({ sound: { musicMuted: true } });
    expect(audio.playMusic("bgm-lobby")).toBe(true);
    expect(backend.sounds[0].volume).toBe(0);
  });

  it("배경음을 크로스페이드하고 숨김/복귀 때 현재 설정으로 재개한다", () => {
    const { audio, settings, backend } = setup();
    audio.playMusic("bgm-a");
    const first = backend.sounds[0];
    audio.playMusic("bgm-b");
    expect(first).toMatchObject({ stopped: true, destroyed: true });
    const second = backend.sounds[1];
    audio.setHidden(true);
    expect(second.isPlaying).toBe(false);
    settings.update({ sound: { masterVolume: 0.25, musicVolume: 0.4 } });
    audio.setHidden(false);
    expect(second.isPlaying).toBe(true);
    expect(second.volume).toBeCloseTo(0.1);
  });
});
