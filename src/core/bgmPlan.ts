/**
 * 어느 화면에서 어느 배경음이 흐르는지의 유일한 표다.
 *
 * 씬은 곡을 고르지 않는다 — `BgmDirector`가 씬이 시작·재개될 때 이 표를 읽을 뿐이다. 표에 없는 씬
 * (설정 겹침 화면·효과 겹침 층)은 **지금 흐르는 곡을 그대로 둔다**. 같은 키의 파일을 바꿔 끼우면 코드는
 * 그대로다. 같은 곡이 이어지는 화면 전환은 되감지 않는다.
 *
 * 유리 도시·연구 탑은 사용자가 직접 넣은 곡이고, 나머지(타이틀·로비·전투·보스·상점)는 ElevenLabs(Starter, 상업 이용
 * 가능)로 만든 출시용 곡이다 — 출처는 `public/audio/CREDITS.md`. 새 곡은 −14 LUFS로 구웠고 사용자 곡은 그보다
 * 2.5dB쯤 커서 `gain`으로 맞춘다(파일은 건드리지 않는다).
 */

export type BgmTrackId = "title" | "lobby" | "glassCity" | "researchSpire" | "battle" | "boss" | "shop";

export interface BgmTrack {
  /** Phaser 오디오 캐시 키. */
  readonly key: string;
  /** 배포되는 파일 경로(`public` 기준). */
  readonly path: string;
  /** 트랙마다 들쭉날쭉한 크기를 맞추는 보정(음악 버스 볼륨에 곱한다). */
  readonly gain: number;
}

export const BGM_TRACKS: Readonly<Record<BgmTrackId, BgmTrack>> = {
  // 부팅(로딩)·타이틀·오프닝의 곡. 로딩부터 첫 이야기까지 한 곡으로 이어진다.
  title: { key: "bgm-title", path: "audio/bgm/bgm-title.mp3", gain: 1 },
  // 로비 전용 — 캐릭터를 오래 바라보는 화면이라 잔잔하고 따뜻한 곡을 따로 둔다(타이틀 곡과 가른다).
  lobby: { key: "bgm-lobby", path: "audio/bgm/bgm-lobby.mp3", gain: 0.9 },
  // 이야기·지도·편성·도감·친구·길드·콘텐츠 입구처럼 로비에서 갈라져 나가 머무는 화면의 곡(기존 시안).
  glassCity: { key: "bgm-glass-city", path: "audio/bgm/bgm-glass-city.mp3", gain: 0.75 },
  // 연구소·고고학·상점처럼 조용히 만지작거리는 화면의 곡.
  researchSpire: { key: "bgm-research-spire", path: "audio/bgm/bgm-research-spire.mp3", gain: 0.75 },
  // 전투 전용(150BPM대). 효과음이 묻히지 않게 한 뼘 낮춘다.
  battle: { key: "bgm-battle", path: "audio/bgm/bgm-battle.mp3", gain: 0.8 },
  // 레이드·원정 보스처럼 혼자 서는 거대한 적과의 판(160BPM, 관현악·합창).
  boss: { key: "bgm-boss", path: "audio/bgm/bgm-boss.mp3", gain: 0.8 },
  // 상점·프리미엄 — 값을 고르는 동안 가볍게 흐르는 곡.
  shop: { key: "bgm-shop", path: "audio/bgm/bgm-shop.mp3", gain: 0.9 },
};

/**
 * **씬 키**(Phaser `super("key")`)로 찾는다 — 클래스 이름이 아니다. 한때 클래스 이름으로 적어 두어 어느 씬도 맞지
 * 않았고, 부트에서 건 타이틀 곡 하나가 게임 내내 흘렀다(`bgmPlan.test`가 실제 씬 키와 대조한다).
 * 아레나 안내(`arenaNotice`)는 늘 켜져 있는 겹이라 표에 두지 않는다.
 */
const SCENE_TRACK: Readonly<Record<string, BgmTrackId>> = {
  // 부트는 타이틀 로딩이 시작되기 전에 서므로, 로딩 화면부터 곡이 흐르게 같은 곡을 건다.
  boot: "title",
  title: "title",
  opening: "title",
  lobby: "lobby",
  stageStory: "glassCity",
  stageMap: "glassCity",
  sortiePreview: "glassCity",
  relics: "glassCity",
  party: "glassCity",
  friends: "glassCity",
  guild: "glassCity",
  event: "glassCity",
  bounty: "glassCity",
  cakeOperation: "glassCity",
  raid: "glassCity",
  expedition: "glassCity",
  duel: "glassCity",
  arena: "glassCity",
  arenaRoom: "glassCity",
  pvpPreview: "glassCity",
  lab: "researchSpire",
  archaeology: "researchSpire",
  ancientStrata: "researchSpire",
  interaction: "researchSpire",
  shop: "shop",
  premium: "shop",
  battle: "battle",
  arenaMatch: "battle",
};

/** 전투 씬 하나가 여러 콘텐츠를 맡으므로, 보스 판은 씬 키가 아니라 진입 데이터의 `mode`로 가른다. */
const BOSS_BATTLE_MODES: ReadonlySet<string> = new Set(["raid", "expeditionBoss"]);

/**
 * 그 씬이 서는 순간 흘러야 하는 곡. 표에 없으면 `undefined` — 지금 곡을 그대로 둔다.
 * `data`는 그 씬이 받은 진입 데이터다(전투만 읽는다).
 */
export function bgmTrackForScene(sceneKey: string, data?: unknown): BgmTrack | undefined {
  const id = SCENE_TRACK[sceneKey];
  if (sceneKey === "battle" && typeof data === "object" && data !== null) {
    const mode = (data as { mode?: unknown }).mode;
    if (typeof mode === "string" && BOSS_BATTLE_MODES.has(mode)) return BGM_TRACKS.boss;
  }
  return id ? BGM_TRACKS[id] : undefined;
}
