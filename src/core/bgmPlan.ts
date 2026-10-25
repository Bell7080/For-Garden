/**
 * 어느 화면에서 어느 배경음이 흐르는지의 유일한 표다.
 *
 * 씬은 곡을 고르지 않는다 — `BgmDirector`가 씬이 시작·재개될 때 이 표를 읽을 뿐이다. 표에 없는 씬
 * (설정 겹침 화면·효과 겹침 층)은 **지금 흐르는 곡을 그대로 둔다**. 곡은 **임시 시안**이며 같은
 * 키의 파일을 바꿔 끼우면 코드는 그대로다. 같은 곡이 이어지는 화면 전환은 되감지 않는다.
 */

export type BgmTrackId = "glassCity" | "researchSpire" | "battle";

export interface BgmTrack {
  /** Phaser 오디오 캐시 키. */
  readonly key: string;
  /** 배포되는 파일 경로(`public` 기준). */
  readonly path: string;
  /** 트랙마다 들쭉날쭉한 크기를 맞추는 보정(음악 버스 볼륨에 곱한다). */
  readonly gain: number;
}

export const BGM_TRACKS: Readonly<Record<BgmTrackId, BgmTrack>> = {
  // 타이틀·로비·이야기·도감처럼 머무는 화면의 기본 곡.
  glassCity: { key: "bgm-glass-city", path: "audio/bgm/bgm-glass-city.mp3", gain: 1 },
  // 연구소·고고학·상점처럼 조용히 만지작거리는 화면의 곡.
  researchSpire: { key: "bgm-research-spire", path: "audio/bgm/bgm-research-spire.mp3", gain: 1 },
  // 전투 전용. 연구탑 곡을 1.15배 빠르게 구운 변주이며 효과음이 묻히지 않게 한 뼘 낮춘다.
  battle: { key: "bgm-battle", path: "audio/bgm/bgm-battle.mp3", gain: 0.75 },
};

const SCENE_TRACK: Readonly<Record<string, BgmTrackId>> = {
  TitleScene: "glassCity",
  OpeningScene: "glassCity",
  StageStoryScene: "glassCity",
  LobbyScene: "glassCity",
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
};

/** 그 씬이 서는 순간 흘러야 하는 곡. 표에 없으면 `undefined` — 지금 곡을 그대로 둔다. */
export function bgmTrackForScene(sceneKey: string): BgmTrack | undefined {
  const id = SCENE_TRACK[sceneKey];
  return id ? BGM_TRACKS[id] : undefined;
}
