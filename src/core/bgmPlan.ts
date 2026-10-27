/**
 * 어느 화면에서 어느 배경음이 흐르는지의 유일한 표다.
 *
 * 씬은 곡을 고르지 않는다 — `BgmDirector`가 씬이 시작·재개될 때 이 표를 읽을 뿐이다. 표에 없는 씬
 * (설정 겹침 화면·효과 겹침 층)은 **지금 흐르는 곡을 그대로 둔다**. 곡은 **임시 시안**이며 같은
 * 키의 파일을 바꿔 끼우면 코드는 그대로다. 같은 곡이 이어지는 화면 전환은 되감지 않는다.
 */

export type BgmTrackId = "title" | "glassCity" | "researchSpire" | "battle";

export interface BgmTrack {
  /** Phaser 오디오 캐시 키. */
  readonly key: string;
  /** 배포되는 파일 경로(`public` 기준). */
  readonly path: string;
  /** 트랙마다 들쭉날쭉한 크기를 맞추는 보정(음악 버스 볼륨에 곱한다). */
  readonly gain: number;
}

export const BGM_TRACKS: Readonly<Record<BgmTrackId, BgmTrack>> = {
  // 부팅(로딩)·타이틀·오프닝·로비의 곡. 로딩부터 로비까지 한 곡으로 이어진다.
  title: { key: "bgm-title", path: "audio/bgm/bgm-title.mp3", gain: 1 },
  // 이야기·지도·편성·도감·친구·길드·콘텐츠 입구처럼 로비에서 갈라져 나가 머무는 화면의 곡(기존 시안).
  glassCity: { key: "bgm-glass-city", path: "audio/bgm/bgm-glass-city.mp3", gain: 1 },
  // 연구소·고고학·상점처럼 조용히 만지작거리는 화면의 곡.
  researchSpire: { key: "bgm-research-spire", path: "audio/bgm/bgm-research-spire.mp3", gain: 1 },
  // 전투 전용(150BPM대). 효과음이 묻히지 않게 한 뼘 낮춘다.
  battle: { key: "bgm-battle", path: "audio/bgm/bgm-battle.mp3", gain: 0.8 },
};

const SCENE_TRACK: Readonly<Record<string, BgmTrackId>> = {
  // 부트는 타이틀 로딩이 시작되기 전에 서므로, 로딩 화면부터 곡이 흐르게 같은 곡을 건다.
  BootScene: "title",
  TitleScene: "title",
  OpeningScene: "title",
  StageStoryScene: "glassCity",
  LobbyScene: "title",
  StageMapScene: "glassCity",
  SortiePreviewScene: "glassCity",
  RelicsScene: "glassCity",
  PartyScene: "glassCity",
  FriendsScene: "glassCity",
  GuildScene: "glassCity",
  EventScene: "glassCity",
  BountyScene: "glassCity",
  CakeOperationScene: "glassCity",
  RaidScene: "glassCity",
  ExpeditionScene: "glassCity",
  DuelScene: "glassCity",
  ArenaScene: "glassCity",
  ArenaRoomScene: "glassCity",
  ArenaNoticeScene: "glassCity",
  PvpPreviewScene: "glassCity",
  LabScene: "researchSpire",
  ArchaeologyScene: "researchSpire",
  AncientStrataScene: "researchSpire",
  InteractionScene: "researchSpire",
  ShopScene: "researchSpire",
  PremiumScene: "researchSpire",
  BattleScene: "battle",
  ArenaMatchScene: "battle",
};

/** 표에 올라 있는 모든 곡(받아 두기 순서: 기본 곡이 맨 앞). */
export function allBgmTracks(): BgmTrack[] {
  return [BGM_TRACKS.title, BGM_TRACKS.glassCity, BGM_TRACKS.battle, BGM_TRACKS.researchSpire];
}

/**
 * 지금 흐르는 곡(`keepKey`)을 뺀 나머지 곡. 디코드된 PCM은 곡당 30~50MB라 이 목록은 메모리에서 놓아야 하는
 * 곡이다(같은 파일을 쓰는 곡이 있어도 키가 다르면 따로 디코드된다).
 */
export function bgmTracksToEvict(keepKey: string): BgmTrack[] {
  return allBgmTracks().filter((track) => track.key !== keepKey);
}

/** 그 씬이 서는 순간 흘러야 하는 곡. 표에 없으면 `undefined` — 지금 곡을 그대로 둔다. */
export function bgmTrackForScene(sceneKey: string): BgmTrack | undefined {
  const id = SCENE_TRACK[sceneKey];
  return id ? BGM_TRACKS[id] : undefined;
}
