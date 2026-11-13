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
  cancelFade(_sound: ManagedSound): void { /* 가짜 페이드는 즉시 끝나므로 취소할 예약 작업이 없다. */ }
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
    audio.createScope().play("research.crack");
    settings.update({ sound: { masterVolume: 0.5, effectsVolume: 0.2 } });
    expect(backend.sounds[0].volume).toBeCloseTo(0.1);
  });

  it("씬 범위 해제 후 사운드를 정리하고 오래된 요청을 거부한다", () => {
    const { audio, backend } = setup();
    const scope = audio.createScope();
    expect(scope.play("research.crack")).toBe(true);
    scope.release();
    expect(backend.sounds[0]).toMatchObject({ stopped: true, destroyed: true });
    expect(scope.play("research.crack")).toBe(false);
    expect(backend.sounds).toHaveLength(1);
  });

  it("없는 에셋은 무음 폴백하고 음소거 중 시작한 음악은 0을 유지한다", () => {
    const { audio, settings, backend } = setup();
    backend.available = false;
    expect(audio.createScope().play("research.crack")).toBe(false);
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
    // 떠난 곡은 버리지 않고 소리만 내린 채 멈춰 세워 둔다(돌아오면 이어 튼다).
    expect(first).toMatchObject({ isPlaying: false, destroyed: false, volume: 0 });
    const second = backend.sounds[1];
    audio.setHidden(true);
    expect(second.isPlaying).toBe(false);
    settings.update({ sound: { masterVolume: 0.25, musicVolume: 0.4 } });
    audio.setHidden(false);
    expect(second.isPlaying).toBe(true);
    expect(second.volume).toBeCloseTo(0.1);
    // 세워 둔 앞 곡은 복귀해도 다시 틀지 않는다.
    expect(first.isPlaying).toBe(false);
  });

  it("조금 전에 떠난 곡으로 돌아오면 새로 만들지 않고 멈춘 자리에서 이어 튼다", () => {
    const { audio, backend } = setup();
    audio.playMusic("bgm-a");
    audio.playMusic("bgm-b");
    audio.playMusic("bgm-a");
    expect(backend.sounds).toHaveLength(2);
    expect(backend.sounds[0]).toMatchObject({ isPlaying: true, stopped: false, destroyed: false });
    expect(backend.sounds[0].volume).toBeGreaterThan(0);
    expect(backend.sounds[1]).toMatchObject({ isPlaying: false, destroyed: false });
  });

  it("세워 두는 곡 수를 넘기면 가장 오래 떠난 곡부터 버린다", () => {
    const { audio, backend } = setup();
    for (const key of ["bgm-a", "bgm-b", "bgm-c", "bgm-d", "bgm-e"]) audio.playMusic(key);
    expect(backend.sounds[0].destroyed).toBe(true);
    expect(backend.sounds.slice(1).every((sound) => !sound.destroyed)).toBe(true);
  });

  it("앞 곡이 내려가는 동안 설정이 바뀌어도 앞 곡을 되살리지 않는다(두 곡 겹침)", () => {
    const settings = new SettingsManager(createDefaultSession(), { save: vi.fn() });
    const fades = new Map<ManagedSound, () => void>();
    const pending = { splice: () => { const runs = [...fades.values()]; fades.clear(); return runs; } };
    class SlowBackend extends FakeBackend {
      override fade(sound: ManagedSound, volume: number, _durationMs: number, done?: () => void): void {
        fades.set(sound, () => { sound.setVolume(volume); done?.(); });
      }
      override cancelFade(sound: ManagedSound): void { fades.delete(sound); }
    }
    const backend = new SlowBackend();
    const audio = new AudioManager(backend, settings, 250, false);
    audio.playMusic("bgm-a");
    pending.splice().forEach((run) => run());
    const first = backend.sounds[0];
    const before = first.volume;
    audio.playMusic("bgm-b");
    // 교차가 끝나기 전에 화면이 설정을 저장한다(뽑기 뒤 화면을 옮길 때 실제로 그랬다).
    settings.update({ sound: { musicVolume: 0.9 } });
    // 내려가는 앞 곡의 볼륨은 페이드만 만진다 — 설정 반영이 새 볼륨으로 되살리지 않는다.
    expect(first.volume).toBe(before);
    pending.splice().forEach((run) => run());
    expect(first).toMatchObject({ isPlaying: false, volume: 0 });
    expect(backend.sounds[1].volume).toBeCloseTo(audio.volume("music"));
  });
});

describe("AudioManager UI 소리", () => {
  it("ui 버스는 효과음 설정을 따르고 큐 보정을 곱한다", () => {
    const { audio, settings, backend } = setup();
    settings.update({ sound: { masterVolume: 0.5, effectsVolume: 0.4 } });
    expect(audio.volume("ui")).toBeCloseTo(0.2);
    audio.playUi("ui.click");
    expect(backend.sounds[0].volume).toBeCloseTo(0.2 * 0.55);
    settings.update({ sound: { effectsMuted: true } });
    expect(backend.sounds[0].volume).toBe(0);
  });

  it("같은 큐를 연타해도 사운드 인스턴스를 늘리지 않고 앞 소리를 끊고 다시 울린다", () => {
    const { audio, backend } = setup();
    audio.playUi("ui.click");
    audio.playUi("ui.click");
    audio.playUi("ui.click");
    expect(backend.sounds).toHaveLength(1);
    audio.playUi("ui.tab");
    expect(backend.sounds).toHaveLength(2);
  });

  it("에셋이 없으면 조용히 건너뛴다", () => {
    const { audio, backend } = setup();
    backend.available = false;
    expect(audio.playUi("ui.click")).toBe(false);
    expect(backend.sounds).toHaveLength(0);
  });
});

describe("AudioManager 배경음 이어 흐르기", () => {
  it("같은 트랙을 다시 부르면 되감지 않고, 다른 트랙은 트랙별 보정으로 교차한다", () => {
    const { audio, backend } = setup();
    expect(audio.playMusic("bgm-a", 0.5)).toBe(true);
    expect(audio.playMusic("bgm-a", 0.5)).toBe(true);
    expect(backend.sounds).toHaveLength(1);
    expect(audio.currentMusicKey).toBe("bgm-a");
    expect(backend.sounds[0].volume).toBeCloseTo(0.8 * 0.5 * 1);
    audio.playMusic("bgm-b");
    expect(backend.sounds).toHaveLength(2);
    expect(audio.currentMusicKey).toBe("bgm-b");
  });

  it("전투 효과음도 큐마다 하나를 재사용한다", () => {
    const { audio, backend } = setup();
    audio.playSfx("battle.ultimate");
    audio.playSfx("battle.ultimate");
    expect(backend.sounds).toHaveLength(1);
  });
});

describe("AudioManager 난전 효과음 간격", () => {
  it("같은 큐가 최소 간격 안에 다시 오면 울리지 않는다", () => {
    const { audio, backend } = setup();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValue(1000);
    expect(audio.playSfx("battle.hit")).toBe(true);
    now.mockReturnValue(1030);
    expect(audio.playSfx("battle.hit")).toBe(false);
    now.mockReturnValue(1100);
    expect(audio.playSfx("battle.hit")).toBe(true);
    expect(backend.sounds).toHaveLength(1);
    now.mockRestore();
  });

  it("허공 클릭음이 겹치지 않도록 이번 누름 뒤에 다른 소리가 났는지 안다", () => {
    const { audio } = setup();
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    expect(audio.heardSince(1_000)).toBe(false);
    audio.playUi("ui.click");
    expect(audio.heardSince(1_000)).toBe(true);
    expect(audio.heardSince(1_001)).toBe(false);
    now.mockRestore();
  });
});
