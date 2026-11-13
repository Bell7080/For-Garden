import Phaser from "phaser";
import type { GameSettings } from "../state/session";
import { settingsManager, type SettingsManager } from "./SettingsManager";

/** 중앙 믹서가 구분하는 출력 버스다. */
export type AudioBus = "music" | "sfx" | "ui" | "voice";

/** 실제 에셋이 추가되기 전에도 호출부가 의미만 전달하도록 고정한 지원 사운드 목록이다. */
export type AudioCue = "research.crack" | UiCue | SfxCue;

/**
 * 화면 조작 밖에서 일어난 사건의 소리다(전투·연구 공개·발굴·이야기 연출). 씬이 `playSfx`로 의미만 넘긴다.
 */
export type SfxCue =
  | "battle.ultimate" | "battle.victory" | "battle.defeat" | "battle.hit" | "battle.hitMagic" | "battle.crit" | "battle.heal"
  | "battle.shield" | "battle.death" | "battle.cutin" | "battle.fever" | "battle.start" | "raid.summon"
  | "research.reveal.common" | "research.reveal.sr" | "research.reveal.ssr" | "research.omen" | "research.showcase"
  | "battle.ultimateReady" | "battle.shieldBreak" | "battle.stun" | "battle.sleep" | "battle.summon" | "battle.deathClock" | "battle.block"
  | "battle.wallThud" | "battle.wallTap" | "battle.boing"
  | "research.shatter" | "dig.hit" | "dig.treasure" | "sweep.scuffle" | "sweep.blastoff" | "sweep.hop"
  | "story.explosion" | "story.alarm" | "story.rumble" | "story.impact" | "story.titleCard" | "story.hop";

/** 버튼·팝업·탭처럼 화면 조작에 붙는 소리다. 씬이 고르지 않고 공용 UI 경계가 `playUi`로 부른다. */
export type UiCue =
  | "ui.click" | "ui.tap" | "ui.back" | "ui.toggle" | "ui.panel.open" | "ui.panel.close" | "ui.tab" | "ui.confirm" | "ui.deny"
  | "ui.reward" | "ui.levelup" | "ui.unlock" | "ui.purchase" | "ui.feed" | "ui.breakthrough" | "relic.poke"
  | "rune.success" | "rune.fail" | "rune.engrave" | "rune.synth" | "title.start"
  | "roulette.tick" | "roulette.win" | "attendance.stamp" | "success.fanfare" | "success.count" | "mission.claim"
  | "settle.lift" | "formation.place" | "formation.lift" | "equip.on" | "equip.off" | "stamina.refill" | "ui.danger" | "sell.coins" | "augment.lock";

/**
 * 효과음 에셋 목록이다. ElevenLabs(Starter, 상업 이용 가능)로 생성해 다듬은 출시용 음원이며 출처·프롬프트는
 * `public/audio/CREDITS.md`가 갖는다. 같은 이름의 파일을 바꿔 끼우면 코드는 그대로다.
 */
export const UI_SOUND_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  ...["ui-click", "ui-tap", "ui-back", "ui-toggle", "ui-panel-open", "ui-panel-close", "ui-tab", "ui-confirm", "ui-deny", "ui-reward", "ui-levelup",
    "ui-unlock", "ui-purchase", "ui-feed", "ui-breakthrough", "rune-success", "rune-fail", "rune-engrave", "rune-synth", "title-start", "relic-poke",
    "settle-lift", "formation-place", "formation-lift", "equip-on", "equip-off", "stamina-refill", "ui-danger", "sell-coins", "augment-lock"].map((key) => [key, `audio/ui/${key}.mp3`] as const),
  // 보상의 순간 — 룰렛·출석 도장·대성공·임무 수령.
  ...["roulette-tick", "roulette-win", "attendance-stamp", "success-fanfare", "success-count", "mission-claim"].map((key) => [key, `audio/reward/${key}.mp3`] as const),
];

/** 전투 효과음의 에셋 목록이다. */
export const BATTLE_SOUND_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  ...["battle-ultimate", "battle-victory", "battle-defeat", "battle-hit", "battle-hit-magic", "battle-crit", "battle-heal", "battle-shield",
    "battle-death", "battle-cutin", "battle-fever", "battle-start", "raid-summon", "sweep-scuffle", "sweep-blastoff", "sweep-hop",
    "battle-ult-ready", "battle-shield-break", "battle-stun", "battle-sleep", "battle-summon", "battle-death-clock", "battle-block",
    "battle-wall-thud", "battle-wall-tap", "battle-boing"].map((key) => [key, `audio/battle/${key}.mp3`] as const),
];

/** 연구소 효과음의 에셋 목록이다(화석 균열·카드 공개·SSR 전조·새 렐릭 소개). */
export const RESEARCH_SOUND_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  ["sfx-research-crack", "audio/research/research-crack.mp3"],
  ...["reveal-common", "reveal-sr", "reveal-ssr", "research-omen", "research-showcase", "research-shatter"].map((key) => [key, `audio/research/${key}.mp3`] as const),
];

/** 이야기 연출(폭발·경보·진동·부딪힘)과 고고학 굴착의 효과음 목록이다. */
export const SCENE_SOUND_ASSETS: ReadonlyArray<readonly [key: string, path: string]> = [
  ...["story-explosion", "story-alarm", "story-rumble", "story-impact", "story-title-card"].map((key) => [key, `audio/story/${key}.mp3`] as const),
  ...["dig-hit", "dig-treasure"].map((key) => [key, `audio/archaeology/${key}.mp3`] as const),
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
  /** 디코드하지 않고 흘려 재생할 긴 곡을 키에 묶는다(배경음). 대역 백엔드는 없어도 된다. */
  registerStream?(key: string, url: string): void;
}

/** 씬이 중앙 사운드의 생성·정지를 직접 만지지 않도록 제공하는 수명 주기 핸들이다. */
export interface AudioScope {
  /** 살아 있는 씬에서만 의미 기반 효과음을 요청하며 없는 에셋은 조용히 건너뛴다. */
  play(cue: AudioCue): boolean;
  /** 씬 종료 시 이후 요청을 무효화하고 이 씬이 시작한 단발음을 정리한다. */
  release(): void;
}

/**
 * `gain`은 큐별 믹스 보정이다(버스 볼륨에 곱한다). 원본은 굽는 단계에서 활성 구간 RMS로 맞춰 두었으므로
 * 여기서는 **무게**만 고른다 — 손끝 소리(탭·클릭)가 가장 작고, 한 판에 몇 번 없는 순간(궁극기·승패·SSR)이 가장 크다.
 */
const CUES: Record<AudioCue, { key: string; bus: AudioBus; gain?: number; minGapMs?: number }> = {
  // 연구소 획득 연구의 균열음이다. 배치형 자원 발굴과 분리하며, 에셋이 없을 때는 의도적으로 무음 폴백한다.
  "research.crack": { key: "sfx-research-crack", bus: "sfx", gain: 0.8 },
  "ui.click": { key: "ui-click", bus: "ui", gain: 0.55, minGapMs: 40 },
  // 아무것도 없는 자리를 누른 손에 답하는 가장 작은 소리 — 버튼 소리와 겹치지 않을 때만 울린다.
  "ui.tap": { key: "ui-tap", bus: "ui", gain: 0.3, minGapMs: 60 },
  "ui.back": { key: "ui-back", bus: "ui", gain: 0.6, minGapMs: 60 },
  "ui.toggle": { key: "ui-toggle", bus: "ui", gain: 0.6, minGapMs: 40 },
  "ui.panel.open": { key: "ui-panel-open", bus: "ui", gain: 0.5, minGapMs: 60 },
  "ui.panel.close": { key: "ui-panel-close", bus: "ui", gain: 0.45, minGapMs: 60 },
  "ui.tab": { key: "ui-tab", bus: "ui", gain: 0.55, minGapMs: 60 },
  "ui.confirm": { key: "ui-confirm", bus: "ui", gain: 0.7 },
  "ui.deny": { key: "ui-deny", bus: "ui", gain: 0.6, minGapMs: 120 },
  "ui.reward": { key: "ui-reward", bus: "ui", gain: 0.8 },
  "ui.levelup": { key: "ui-levelup", bus: "ui", gain: 0.85 },
  "ui.unlock": { key: "ui-unlock", bus: "ui", gain: 0.8 },
  "ui.purchase": { key: "ui-purchase", bus: "ui", gain: 0.75 },
  // 급여는 다다닥 두드리는 조작이라 간격을 짧게 두되 겹쳐 쌓이지 않게 한다.
  "ui.feed": { key: "ui-feed", bus: "ui", gain: 0.5, minGapMs: 70 },
  // 렐릭(로비 전신·정보창 원화)을 콕 누른 손맛 — 말랑한 보용.
  "relic.poke": { key: "relic-poke", bus: "ui", gain: 0.6, minGapMs: 110 },
  "ui.breakthrough": { key: "ui-breakthrough", bus: "ui", gain: 0.85 },
  "rune.success": { key: "rune-success", bus: "ui", gain: 0.75 },
  "rune.fail": { key: "rune-fail", bus: "ui", gain: 0.7 },
  "rune.engrave": { key: "rune-engrave", bus: "ui", gain: 0.85 },
  "rune.synth": { key: "rune-synth", bus: "ui", gain: 0.7 },
  // 룰렛 틱은 칸을 지날 때마다 울리므로 빨리 돌 때 겹쳐 뭉개지지 않게 간격을 둔다.
  "roulette.tick": { key: "roulette-tick", bus: "ui", gain: 0.45, minGapMs: 45 },
  "roulette.win": { key: "roulette-win", bus: "ui", gain: 0.8 },
  "attendance.stamp": { key: "attendance-stamp", bus: "ui", gain: 0.85 },
  "success.fanfare": { key: "success-fanfare", bus: "ui", gain: 0.85 },
  "success.count": { key: "success-count", bus: "ui", gain: 0.5, minGapMs: 60 },
  "mission.claim": { key: "mission-claim", bus: "ui", gain: 0.8 },
  "title.start": { key: "title-start", bus: "ui", gain: 0.8 },
  "settle.lift": { key: "settle-lift", bus: "ui", gain: 0.7 },
  // 편성 칸에 세우고 빼는 손맛 — 끌기·탭이 잦으므로 짧게 끊는다.
  "formation.place": { key: "formation-place", bus: "ui", gain: 0.6, minGapMs: 60 },
  "formation.lift": { key: "formation-lift", bus: "ui", gain: 0.5, minGapMs: 60 },
  "equip.on": { key: "equip-on", bus: "ui", gain: 0.7 },
  "equip.off": { key: "equip-off", bus: "ui", gain: 0.6 },
  "stamina.refill": { key: "stamina-refill", bus: "ui", gain: 0.75 },
  "ui.danger": { key: "ui-danger", bus: "ui", gain: 0.7 },
  "sell.coins": { key: "sell-coins", bus: "ui", gain: 0.7 },
  "augment.lock": { key: "augment-lock", bus: "ui", gain: 0.75 },
  "battle.ultimate": { key: "battle-ultimate", bus: "sfx", gain: 0.7, minGapMs: 120 },
  "battle.cutin": { key: "battle-cutin", bus: "sfx", gain: 0.7, minGapMs: 200 },
  "battle.victory": { key: "battle-victory", bus: "sfx", gain: 0.85 },
  "battle.defeat": { key: "battle-defeat", bus: "sfx", gain: 0.85 },
  "battle.start": { key: "battle-start", bus: "sfx", gain: 0.7 },
  // 난전에서는 초당 수십 번 터지므로 큐마다 최소 간격을 둔다 — 겹쳐 울리면 소리가 아니라 소음이 된다.
  "battle.hit": { key: "battle-hit", bus: "sfx", gain: 0.4, minGapMs: 90 },
  "battle.hitMagic": { key: "battle-hit-magic", bus: "sfx", gain: 0.35, minGapMs: 90 },
  "battle.crit": { key: "battle-crit", bus: "sfx", gain: 0.55, minGapMs: 140 },
  "battle.heal": { key: "battle-heal", bus: "sfx", gain: 0.35, minGapMs: 500 },
  "battle.shield": { key: "battle-shield", bus: "sfx", gain: 0.4, minGapMs: 400 },
  "battle.death": { key: "battle-death", bus: "sfx", gain: 0.6, minGapMs: 200 },
  "battle.fever": { key: "battle-fever", bus: "sfx", gain: 0.55, minGapMs: 800 },
  "raid.summon": { key: "raid-summon", bus: "sfx", gain: 0.85 },
  "battle.ultimateReady": { key: "battle-ult-ready", bus: "sfx", gain: 0.5, minGapMs: 250 },
  "battle.shieldBreak": { key: "battle-shield-break", bus: "sfx", gain: 0.5, minGapMs: 200 },
  "battle.stun": { key: "battle-stun", bus: "sfx", gain: 0.45, minGapMs: 200 },
  "battle.sleep": { key: "battle-sleep", bus: "sfx", gain: 0.45, minGapMs: 300 },
  "battle.summon": { key: "battle-summon", bus: "sfx", gain: 0.55, minGapMs: 300 },
  "battle.deathClock": { key: "battle-death-clock", bus: "sfx", gain: 0.75 },
  "battle.block": { key: "battle-block", bus: "sfx", gain: 0.4, minGapMs: 150 },
  // 날려버림·쓰러진 몸이 전장 벽에 튕길 때 — 첫 부딪힘은 퍽, 이어지는 튕김은 탁, 사이사이 띠용(`wallBounceCue`).
  "battle.wallThud": { key: "battle-wall-thud", bus: "sfx", gain: 0.55, minGapMs: 60 },
  "battle.wallTap": { key: "battle-wall-tap", bus: "sfx", gain: 0.45, minGapMs: 50 },
  "battle.boing": { key: "battle-boing", bus: "sfx", gain: 0.5, minGapMs: 120 },
  "research.shatter": { key: "research-shatter", bus: "sfx", gain: 0.55, minGapMs: 80 },
  "research.reveal.common": { key: "reveal-common", bus: "sfx", gain: 0.6, minGapMs: 50 },
  "research.reveal.sr": { key: "reveal-sr", bus: "sfx", gain: 0.75, minGapMs: 50 },
  "research.reveal.ssr": { key: "reveal-ssr", bus: "sfx", gain: 0.9, minGapMs: 50 },
  "research.omen": { key: "research-omen", bus: "sfx", gain: 0.9 },
  "research.showcase": { key: "research-showcase", bus: "sfx", gain: 0.8 },
  "dig.hit": { key: "dig-hit", bus: "sfx", gain: 0.7, minGapMs: 80 },
  "dig.treasure": { key: "dig-treasure", bus: "sfx", gain: 0.8, minGapMs: 120 },
  "sweep.scuffle": { key: "sweep-scuffle", bus: "sfx", gain: 0.6 },
  "sweep.blastoff": { key: "sweep-blastoff", bus: "sfx", gain: 0.7, minGapMs: 150 },
  "sweep.hop": { key: "sweep-hop", bus: "sfx", gain: 0.85, minGapMs: 120 },
  "story.explosion": { key: "story-explosion", bus: "sfx", gain: 0.8 },
  "story.alarm": { key: "story-alarm", bus: "sfx", gain: 0.6 },
  "story.rumble": { key: "story-rumble", bus: "sfx", gain: 0.75 },
  "story.impact": { key: "story-impact", bus: "sfx", gain: 0.75 },
  "story.titleCard": { key: "story-title-card", bus: "sfx", gain: 0.75 },
  // 대사 무대의 통통 몸짓 — 소탕의 뿅 소리를 작게 빌려 쓴다.
  "story.hop": { key: "sweep-hop", bus: "sfx", gain: 0.5, minGapMs: 120 },
};

/** 배경음 교차 시간. 하단 탭을 오가며 곡이 툭 갈리지 않을 만큼 길고, 다음 화면의 첫 소리를 덮지 않을 만큼 짧다. */
export const MUSIC_FADE_MS = 650;
/** 떠난 뒤에도 이어 틀 수 있게 세워 두는 곡 수(지금 곡 제외). 흘려 재생하는 곡이라 하나에 몇 MB뿐이다. */
export const PARKED_MUSIC_LIMIT = 3;
/** 이보다 오래 떠나 있던 곡은 버리고 다음엔 처음부터 튼다. */
export const PARKED_MUSIC_TTL_MS = 5 * 60_000;

/** master × category × mute 공식을 유일하게 계산하고 Phaser Sound 수명을 소유한다. */
export class AudioManager {
  private readonly sounds = new Map<ManagedSound, AudioBus>();
  private music?: ManagedSound;
  private musicKey?: string;
  private musicGain = 1;
  /**
   * 떠난 배경음은 곧바로 버리지 않고 소리만 내린 채 **세워 둔다**(키마다 하나, 최근 `PARKED_MUSIC_LIMIT`곡).
   * 하단 탭을 오가면 고고학·도감·로비·연구소·상점이 저마다 다른 곡이라, 버리면 돌아올 때마다 처음부터 다시 받아
   * 틀어 "같은 곡인데 끊겼다가 다시 나오는" 것으로 들렸다. 세워 둔 곡은 멈춘 자리에서 이어 흐른다.
   * 여기 든 소리는 지금 곡이 아니므로 설정 변경·앱 복귀가 볼륨을 되살리지 않는다 — 되살리면 내려가던 앞 곡이
   * 그대로 남아 두 곡이 겹쳐 흘렀다(뽑기 뒤 화면을 옮길 때 설정이 저장되며 그랬다).
   */
  private readonly parked = new Map<string, { sound: ManagedSound; gain: number; at: number }>();
  /** 한 번 울리는 소리(UI·전투)는 큐마다 사운드 하나를 재사용한다 — 연타하면 앞 소리를 끊고 다시 울려 인스턴스가 쌓이지 않는다. */
  private readonly uiSounds = new Map<AudioCue, ManagedSound>();
  private readonly lastPlayedAt = new Map<AudioCue, number>();
  /** 마지막으로 UI·효과음이 실제로 울린 시각 — 빈 자리 탭이 버튼 소리와 겹치지 않게 가른다. */
  private lastSoundAt = -Infinity;
  private hidden = false;
  private disposed = false;
  private readonly onSettings = (event: Event): void => this.applySettings((event as CustomEvent<GameSettings>).detail);
  private readonly onVisibility = (): void => this.setHidden(document.hidden);

  constructor(private readonly backend: AudioBackend, private readonly settings: SettingsManager = settingsManager, private readonly fadeMs = MUSIC_FADE_MS, watchDocument = true) {
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

  /** `since`(performance.now 기준) 이후에 단발음이 하나라도 실제로 울렸는가. */
  heardSince(since: number): boolean { return this.lastSoundAt >= since; }

  private playShared(cue: AudioCue): boolean {
    const definition = CUES[cue];
    if (this.disposed || this.hidden || !this.backend.has(definition.key)) return false;
    if (definition.minGapMs) {
      const now = performance.now();
      if (now - (this.lastPlayedAt.get(cue) ?? -Infinity) < definition.minGapMs) return false;
      this.lastPlayedAt.set(cue, now);
    }
    let sound = this.uiSounds.get(cue);
    if (!sound) {
      sound = this.backend.create(definition.key, false);
      this.uiSounds.set(cue, sound);
      this.sounds.set(sound, definition.bus);
    }
    sound.stop();
    sound.setVolume(this.volume(definition.bus) * (definition.gain ?? 1));
    this.lastSoundAt = performance.now();
    return sound.play();
  }

  /** 긴 곡을 디코드 없이 흘려 재생하도록 키에 묶는다 — 그 뒤 `playMusic(key)`가 곧바로 튼다. */
  registerStream(key: string, url: string): void { this.backend.registerStream?.(key, url); }

  /** 지금 배경음으로 재생 중인(혹은 재생하려는) 트랙 키다. */
  get currentMusicKey(): string | undefined { return this.musicKey; }

  /**
   * 배경음을 교차 전환하며 음소거 중인 새 트랙도 0에서 시작시킨다. 같은 트랙을 다시 부르면
   * 처음부터 되감지 않고 그대로 둔다(화면이 바뀌어도 같은 곡이면 이어 흐른다). 조금 전에 떠난 곡으로 돌아오면
   * 세워 둔 그 곡을 멈춘 자리에서 다시 올린다. `gain`은 트랙별 크기 보정이다.
   */
  playMusic(key: string, gain = 1): boolean {
    if (this.disposed || !this.backend.has(key)) return false;
    if (this.music && this.musicKey === key) return true;
    const previous = this.music;
    const previousKey = this.musicKey;
    const previousGain = this.musicGain;
    this.pruneParked(performance.now());
    const resumed = this.parked.get(key);
    let next: ManagedSound;
    if (resumed) {
      this.parked.delete(key);
      next = resumed.sound;
      this.backend.cancelFade(next);
    } else {
      next = this.backend.create(key, true);
      next.setVolume(0);
      this.sounds.set(next, "music");
    }
    this.music = next;
    this.musicKey = key;
    this.musicGain = gain;
    const target = this.hidden ? 0 : this.volume("music") * gain;
    if (this.hidden) {
      next.setVolume(0);
      if (!resumed) { next.play(); next.pause(); }
    } else {
      if (!resumed) next.play();
      else if (!next.isPlaying) next.resume();
      this.backend.fade(next, target, this.fadeMs);
    }
    if (previous && previousKey) this.park(previousKey, previous, previousGain);
    return true;
  }

  /** 떠나는 곡을 내리며 세워 둔다. 다 내려가면 멈추기만 하고(자리는 지킨다), 넘치는 오래된 곡은 버린다. */
  private park(key: string, sound: ManagedSound, gain: number): void {
    const stale = this.parked.get(key);
    if (stale && stale.sound !== sound) this.remove(stale.sound);
    this.parked.set(key, { sound, gain, at: performance.now() });
    const settle = (): void => {
      const entry = this.parked.get(key);
      if (entry?.sound !== sound) return;
      sound.setVolume(0);
      sound.pause();
    };
    if (this.hidden) { this.backend.cancelFade(sound); settle(); }
    else this.backend.fade(sound, 0, this.fadeMs, settle);
    while (this.parked.size > PARKED_MUSIC_LIMIT) {
      const oldest = this.parked.keys().next().value as string;
      this.remove(this.parked.get(oldest)!.sound);
    }
  }

  /** 오래 떠나 있던 곡은 이어 트는 맛보다 붙잡는 값이 크다 — 버리고 다음엔 처음부터 튼다. */
  private pruneParked(now: number): void {
    for (const entry of [...this.parked.values()]) if (now - entry.at > PARKED_MUSIC_TTL_MS) this.remove(entry.sound);
  }

  private isParked(sound: ManagedSound): boolean {
    for (const entry of this.parked.values()) if (entry.sound === sound) return true;
    return false;
  }

  /** 앱 숨김/복귀 상태를 반영하고 복귀 시 현재 사용자 설정으로만 출력을 복원한다. */
  setHidden(hidden: boolean): void {
    if (this.hidden === hidden || this.disposed) return;
    this.hidden = hidden;
    // 세워 둔 곡은 숨는 순간 내리기를 끝내 두고, 돌아와도 다시 틀지 않는다 — 지금 곡만 되살린다.
    if (hidden) for (const { sound } of this.parked.values()) { this.backend.cancelFade(sound); sound.setVolume(0); sound.pause(); }
    for (const sound of this.sounds.keys()) {
      if (this.isParked(sound)) continue;
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
      // 내려가는(세워 둔) 앞 곡의 페이드를 끊으면 그 곡이 제 볼륨으로 되살아나 두 곡이 겹친다.
      if (this.isParked(sound)) continue;
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
    for (const [key, entry] of this.parked) if (entry.sound === sound) this.parked.delete(key);
    this.backend.cancelFade(sound);
    sound.stop();
    sound.destroy();
    this.sounds.delete(sound);
    if (this.music === sound) { this.music = undefined; this.musicKey = undefined; }
  }
}

/** Phaser의 생성·Tween 세부 구현을 중앙 관리자가 쓰는 작은 계약으로 변환한다. */
export class PhaserAudioBackend implements AudioBackend {
  private readonly fades = new Map<ManagedSound, { frame: number; timer: ReturnType<typeof setTimeout> }>();
  private readonly streams = new Map<string, string>();
  constructor(private readonly game: Phaser.Game) {}

  /** Phaser 오디오 캐시에 실제 키가 준비됐는지 확인한다. 흘려 재생하는 곡은 묶어 둔 순간부터 있다. */
  has(key: string): boolean { return this.streams.has(key) || this.game.cache.audio.exists(key); }

  /** Phaser Sound 인스턴스 생성은 이 어댑터를 통해서만 수행한다. */
  create(key: string, loop: boolean): ManagedSound {
    const url = this.streams.get(key);
    if (url) {
      const manager = this.game.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext; destination?: AudioNode };
      return new StreamedSound(url, loop, manager.context, manager.destination);
    }
    return this.game.sound.add(key, { loop }) as unknown as ManagedSound;
  }

  registerStream(key: string, url: string): void { this.streams.set(key, url); }

  /**
   * 씬과 독립된 애니메이션 프레임으로 볼륨을 전환하고 완료 콜백을 한 번 전달한다. 프레임이 멎어도(앱이 숨었거나
   * 3D 연출이 메인 스레드를 붙잡았을 때) 끝은 시계가 보장한다 — 끝나지 않으면 내리던 앞 곡이 남아 겹친다.
   */
  fade(sound: ManagedSound, volume: number, durationMs: number, done?: () => void): void {
    this.cancelFade(sound);
    const initial = sound.volume;
    const startedAt = performance.now();
    const finish = (): void => {
      const pending = this.fades.get(sound);
      if (!pending) return;
      cancelAnimationFrame(pending.frame);
      clearTimeout(pending.timer);
      this.fades.delete(sound);
      sound.setVolume(volume);
      done?.();
    };
    // 특정 씬의 TweenManager에 기대지 않아 배경음이 씬 전환 중에도 끊김 없이 교차한다.
    const step = (now: number): void => {
      const pending = this.fades.get(sound);
      if (!pending) return;
      const progress = Math.min(1, (now - startedAt) / durationMs);
      if (progress >= 1) { finish(); return; }
      // 같은 힘(equal-power) 곡선 — 들어오는 곡은 sin, 나가는 곡은 cos로 움직여 교차하는 동안 합친 크기가 꺼지지 않는다.
      // 직선으로 섞으면 한가운데에서 두 곡이 함께 작아져 "끊겼다가 다시 나오는" 구멍이 들린다.
      const moved = volume > initial ? Math.sin((progress * Math.PI) / 2) : 1 - Math.cos((progress * Math.PI) / 2);
      sound.setVolume(initial + (volume - initial) * moved);
      pending.frame = requestAnimationFrame(step);
    };
    this.fades.set(sound, { frame: requestAnimationFrame(step), timer: setTimeout(finish, durationMs + 120) });
  }

  /** 설정 변경이나 정지 시 진행 중인 페이드가 새 볼륨을 덮어쓰지 않도록 취소한다. */
  cancelFade(sound: ManagedSound): void {
    const pending = this.fades.get(sound);
    if (!pending) return;
    cancelAnimationFrame(pending.frame);
    clearTimeout(pending.timer);
    this.fades.delete(sound);
  }
}

/**
 * 배경음은 디코드하지 않고 `<audio>`로 흘려 재생한다. 3분짜리 곡을 `decodeAudioData`로 풀면 PCM이 50~60MB이고
 * 그 디코드가 데스크톱에서도 1초, 메인 스레드를 300ms 붙잡았다 — 화면이 바뀔 때마다 그 값을 치르면 모바일은
 * 진입이 멎고, 앞 곡과 새 곡이 잠깐 함께 올라 탭이 죽는다. 흘려 재생하면 몇 MB만 든다.
 * 소리는 `MediaElementAudioSourceNode` → 이득 노드로 Phaser 그래프에 붙인다 — iOS는 요소의 `volume`을 무시하므로
 * 페이드·음량은 이득 노드가 맡는다. 자동 재생이 막히면 첫 입력에서 다시 튼다.
 */
class StreamedSound implements ManagedSound {
  volume = 0;
  isPlaying = false;
  private readonly element: HTMLAudioElement;
  private readonly gain?: GainNode;
  private source?: MediaElementAudioSourceNode;
  private destroyed = false;
  private retry?: () => void;

  constructor(url: string, loop: boolean, context?: AudioContext, destination?: AudioNode) {
    this.element = new Audio(url);
    this.element.loop = loop;
    this.element.preload = "auto";
    if (context) {
      try {
        this.source = context.createMediaElementSource(this.element);
        this.gain = context.createGain();
        this.gain.gain.value = 0;
        this.source.connect(this.gain).connect(destination ?? context.destination);
      } catch {
        this.source = undefined;
      }
    }
    this.apply();
  }

  play(): boolean {
    if (this.destroyed) return false;
    this.isPlaying = true;
    this.start();
    return true;
  }

  stop(): void {
    this.pause();
    this.element.currentTime = 0;
  }

  pause(): void {
    this.isPlaying = false;
    this.clearRetry();
    this.element.pause();
  }

  resume(): void { this.play(); }

  setVolume(volume: number): this {
    this.volume = volume;
    this.apply();
    return this;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.pause();
    this.destroyed = true;
    this.source?.disconnect();
    this.gain?.disconnect();
    // 주소를 비워야 브라우저가 받아 둔 조각과 디코더를 놓는다.
    this.element.removeAttribute("src");
    this.element.load();
  }

  private apply(): void {
    const value = Math.max(0, Math.min(1, this.volume));
    if (this.gain) this.gain.gain.value = value;
    else this.element.volume = value;
  }

  private start(): void {
    void this.element.play().catch(() => {
      // 아직 손이 닿지 않아 막혔다 — 첫 입력에서 다시 튼다(그때도 틀 생각일 때만).
      if (this.retry || this.destroyed) return;
      this.retry = (): void => {
        this.clearRetry();
        if (this.isPlaying && !this.destroyed) this.start();
      };
      for (const type of ["pointerdown", "touchend", "keydown"]) window.addEventListener(type, this.retry, { once: true });
    });
  }

  private clearRetry(): void {
    if (!this.retry) return;
    for (const type of ["pointerdown", "touchend", "keydown"]) window.removeEventListener(type, this.retry);
    this.retry = undefined;
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
