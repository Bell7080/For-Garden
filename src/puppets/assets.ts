import type Phaser from "phaser";
import { Puppet } from "puppetforge/phaser";
import type { PortraitAssetId } from "../core/types";
import {
  computeAnchoredPlacement,
  computeHeadCardFrame,
  resolveAnchors,
  type AnchorKind,
  type AnchorPoint,
  type CardFrame,
  type CardFrameOptions,
  type FocusOptions,
} from "./anchors";
import { ensureTexture, IndexedPuppetCreature } from "./IndexedPuppetCreature";

/** 기존 호출부가 렌더러 구현을 몰라도 되도록 인게임 Puppet 타입을 한 곳에서 공개한다. */
export type PuppetCreature = IndexedPuppetCreature;

/**
 * PuppetForge로 만든 임시 아트를 불러오고, 발바닥이 바닥에 닿도록 세운다.
 *
 * 렐릭 30종과 적 개체가 각자의 묶음을 갖기 전까지는 이 둘로 돌려 쓴다.
 * 캐릭터 구분은 색 필터(tint)로만 한다.
 */

/**
 * 묶음 하나에 대한 정보.
 *
 * `content`는 이미지에서 실제로 그림이 있는 영역(알파 > 16)이다. 이미지에는 투명한 여백이
 * 붙어 있어서, 이미지 테두리를 기준으로 세우면 캐릭터가 공중에 뜨거나 바닥에 파묻힌다.
 * 그래서 발끝(`content.bottom`)을 바닥선에 맞춘다.
 */
export interface PuppetAsset {
  url: string;
  imageWidth: number;
  imageHeight: number;
  content: { left: number; top: number; right: number; bottom: number };
  /**
   * 카드에서의 확대 보정. 1이 기준이다.
   *
   * 등신이 낮은(머리가 큰) 원화는 같은 배율로 넣으면 혼자만 얼굴이 커 보인다. 카드 규격을
   * 캐릭터마다 다르게 만들지 않고, 원화 쪽에 보정값을 달아 한 그리드에서 크기가 맞게 한다.
   */
  cardZoom?: number;
  /**
   * 정보창 전신 배율. 1이면 공용 높이 그대로다.
   *
   * 적 원화는 아군보다 캔버스 안의 그림 영역이 작아, 같은 높이로 세우면 화면 밖으로 넘칠 만큼
   * 확대된다. 화면이 개체마다 다른 높이를 정하지 않도록 보정값을 원화 쪽에 붙인다.
   */
  portraitZoom?: number;
  /**
   * 정보창 전신의 세로 보정(+는 아래). 0이 기준이다.
   *
   * 코어 관절을 화면의 한 점에 맞춰 세우지만, 관절을 어디에 박았는지는 원화마다 다르다.
   * 그래서 같은 점에 맞춰도 어떤 인물은 조금 내려앉아 보인다. 화면이 인물마다 다른 y를
   * 적지 않도록 그 차이를 원화 쪽에 적어 둔다.
   */
  portraitOffsetY?: number;
}

const base = import.meta.env.BASE_URL;

/** 1번 전신 일러스트: 토리카(트리케라톱스). 다른 둘보다 등신이 낮아 카드에서는 확대를 줄여 얼굴 크기를 맞춘다. */
export const TORIKA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_001.zip`,
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 95, top: 69, right: 894, bottom: 1419 },
  cardZoom: 0.62,
};

/** 2번 전신 일러스트: 렉시아(티라노사우루스). */
export const LEXIA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_002.zip`,
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 95, top: 69, right: 894, bottom: 1419 },
};

/** 3번 전신 일러스트: 세이라(스피노사우루스). */
export const SEIRA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_003.zip`,
  imageWidth: 1085,
  imageHeight: 1450,
  content: { left: 0, top: 0, right: 1085, bottom: 1450 },
};

/** 4번 전신 일러스트: 루카(벨로키랍토르). 넓은 후드와 꼬리까지 포함한 전용 원화다. */
export const LUKA_ASSET: PuppetAsset = {
  url: `${base}puppets/char_004.zip`,
  imageWidth: 1728,
  imageHeight: 2446,
  // 원화의 후드·손·발·꼬리를 모두 포함한 가시 영역으로 발 높이와 화면 확대를 맞춘다.
  content: { left: 52, top: 44, right: 1683, bottom: 2404 },
  // 코어 관절이 다른 원화보다 아래에 박혀 있어 정보창에서 혼자 내려앉아 보인다.
  portraitOffsetY: -34,
};

/**
 * 1번 적 토비. 적 전용 Puppet 번호와 스테이지 고정 편성 번호를 일치시킨다.
 *
 * 적 셋은 캔버스 크기가 서로 다르다. 한때 셋이 같은 1254 정사각 규격을 쓴다고 적어 두었지만
 * 실제 묶음은 그렇지 않았고, 그래서 그림 영역이 실제보다 작게 잡혀 정보창에서 지나치게
 * 확대되었다. 값은 원본 알파(>16) 경계 그대로다 — 임의로 줄인 배율로 덮지 않는다.
 */
export const TOBY_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_001.zip`,
  imageWidth: 1448,
  imageHeight: 2048,
  content: { left: 24, top: 76, right: 1424, bottom: 1968 },
};

/** 2번 적 아모. */
export const AMO_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_002.zip`,
  imageWidth: 2172,
  imageHeight: 2898,
  content: { left: 201, top: 44, right: 1972, bottom: 2854 },
};

/** 3번 적 리파. 파일명의 기존 표기(enemy003)를 실제 공개 에셋 경로대로 연결한다. */
export const RIPA_ASSET: PuppetAsset = {
  url: `${base}puppets/enemy_003.zip`,
  imageWidth: 2892,
  imageHeight: 4096,
  content: { left: 44, top: 249, right: 2849, bottom: 3844 },
};

/**
 * 렐릭 데이터가 참조하는 원화 레지스트리. 새 원화는 여기에 한 번 등록한 뒤 데이터 키로 연결한다.
 * placeholder 키는 같은 임시 파일을 쓰되 화면에서 렐릭별 tint를 적용할 수 있게 별도로 둔다.
 */
const PORTRAIT_ASSETS = {
  torika: { asset: TORIKA_ASSET, usesRelicTint: false },
  lexia: { asset: LEXIA_ASSET, usesRelicTint: false },
  seira: { asset: SEIRA_ASSET, usesRelicTint: false },
  luka: { asset: LUKA_ASSET, usesRelicTint: false },
  // 적도 전용 전신을 가진다. 초상 레지스트리에 함께 두면 정보창이 아군·적을 가르지 않고
  // 같은 경로로 원화를 찾는다 — 화면마다 "적이면 다른 함수"를 두면 한 곳을 고칠 때 다른
  // 곳이 임시 원화로 남는다.
  toby: { asset: TOBY_ASSET, usesRelicTint: false },
  amo: { asset: AMO_ASSET, usesRelicTint: false },
  ripa: { asset: RIPA_ASSET, usesRelicTint: false },
  "torika-placeholder": { asset: TORIKA_ASSET, usesRelicTint: true },
} as const satisfies Record<PortraitAssetId, { asset: PuppetAsset; usesRelicTint: boolean }>;

/** 데이터 키로 전신 원화를 찾는다. 캐릭터 내부 id에 의존하지 않는다. */
export function portraitAssetFor(assetId: PortraitAssetId): PuppetAsset {
  return PORTRAIT_ASSETS[assetId].asset;
}

/** 임시 공유 원화인지 판별해 기존 렐릭 구분 tint를 유지한다. */
export function portraitUsesRelicTint(assetId: PortraitAssetId): boolean {
  return PORTRAIT_ASSETS[assetId].usesRelicTint;
}

/** 전투용 적 SD 1~3번은 정보창용 전신 원화와 파일을 섞지 않는다. */
export const ENEMY_SD_ASSETS: readonly [PuppetAsset, PuppetAsset, PuppetAsset] = ([1, 2, 3] as const).map((number) => ({
  url: `${base}puppets/enemySD_${String(number).padStart(3, "0")}.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 352, top: 155, right: 993, bottom: 1082 },
})) as unknown as readonly [PuppetAsset, PuppetAsset, PuppetAsset];

/** 1번 SD: 토리카. 실제 투명 영역을 제외한 범위로 발 위치와 크기를 잡는다. */
export const TORIKA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_001.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 245, top: 120, right: 1010, bottom: 1135 },
};

/** 2번 SD: 렉시아. */
export const LEXIA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_002.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 185, top: 105, right: 1080, bottom: 1140 },
};

/** 3번 SD: 세이라. 알파가 있는 실제 그림 영역으로 발끝을 잡아 투명 여백만큼 뜨지 않게 한다. */
export const SEIRA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_003.zip`,
  imageWidth: 1122,
  imageHeight: 1402,
  // 원본 PNG에서 alpha > 16인 경계다. 특히 아래 74px은 투명하므로 이미지 끝을 바닥에 맞추면 발이 뜬다.
  content: { left: 218, top: 112, right: 987, bottom: 1328 },
};

/** 4번 SD: 루카. 전용 SD의 1254 정사각 캔버스와 가시 영역을 사용한다. */
export const LUKA_SD_ASSET: PuppetAsset = {
  url: `${base}puppets/charSD_004.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  // 투명 여백을 제외하고 후드 끝부터 발끝까지를 잡아 다른 SD와 같은 바닥선에 세운다.
  content: { left: 202, top: 76, right: 1098, bottom: 1197 },
};

/** 적은 번호별 전용 묶음을 쓰고, 전용 SD가 없는 아군은 요청대로 아군 1번 SD를 공유한다. */
export function battleAssetFor(relicId: string): PuppetAsset {
  if (relicId === "husk-raptor") return ENEMY_SD_ASSETS[0];
  if (relicId === "husk-shell") return ENEMY_SD_ASSETS[1];
  if (relicId === "husk-wing") return ENEMY_SD_ASSETS[2];
  if (relicId === "anky") return TORIKA_SD_ASSET;
  if (relicId === "rex") return LEXIA_SD_ASSET;
  if (relicId === "spino") return SEIRA_SD_ASSET;
  if (relicId === "luka") return LUKA_SD_ASSET;
  return TORIKA_SD_ASSET;
}

/**
 * 전장에서 쓰는 동작. 묶음마다 가진 동작이 달라서 쓸 이름을 순서대로 적어 둔다 —
 * 앞에서부터 있는 것을 쓰고, 하나도 없으면 그냥 넘어간다.
 */
/** 동작 하나의 재생 규칙. 우선순위가 높을수록 다른 동작에 끊기지 않는다. */
export interface MotionConfig {
  names: readonly string[];
  returnsToIdle?: boolean;
  priority: number;
  /** 내보낸 속도를 덮어쓴다. 크면 빨리 지나간다. */
  speed?: number;
  /** 움직임 크기 배율. 작으면 얕게 꺾인다. */
  strength?: number;
}

export const MOTION = {
  idle: { names: ["idle"], priority: 0 },
  /**
   * 피격. 얕고 빠르게 지나간다.
   *
   * 우선순위가 공격보다 낮아서 휘두르는 중에는 끼어들지 않는다. 맞을 때마다 크게 꺾이면
   * 주고받는 동안 캐릭터가 계속 튀어 보이고, 무엇보다 자기 공격 모션이 매번 잘린다.
   */
  hit: { names: ["hit", "idle"], returnsToIdle: true, priority: 1, speed: 2.2, strength: 0.4 },
  /** 포효. 지금은 궁극기가 쓰지 않지만 동작 자체는 묶음에 남아 있어 연출용으로 부를 수 있다. */
  roar: { names: ["roar", "shout", "attack", "idle"], returnsToIdle: true, priority: 3 },
  /** 공격 동작이 따로 없어 포효로 대신한다. 재생 중에는 어떤 동작도 이걸 끊지 못한다. */
  attack: { names: ["attack", "slam", "roar", "idle"], returnsToIdle: true, priority: 2 },
} as const satisfies Record<string, MotionConfig>;

export type MotionName = keyof typeof MOTION;

/** 개체별 최신 동작 번호. 오래된 복귀 타이머가 새 동작을 idle로 끊지 못하게 한다. */
const motionGeneration = new WeakMap<PuppetCreature, number>();
/** 지금 재생 중인 일회성 동작의 우선순위와 끝나는 시각. 낮은 동작이 끼어들지 못하게 막는다. */
const motionHold = new WeakMap<PuppetCreature, { priority: number; until: number }>();
/** 이전 일회성 동작의 idle 복귀 예약. 새 동작이 오면 즉시 해제한다. */
const motionTimers = new WeakMap<PuppetCreature, Phaser.Time.TimerEvent>();

/** 묶음의 정적 프로젝트와 텍스처는 파일당 한 번만 읽어 재사용한다. */
const loaded = new Map<string, Promise<Puppet>>();

function loadPuppet(asset: PuppetAsset): Promise<Puppet> {
  let pending = loaded.get(asset.url);
  if (!pending) {
    // ZIP의 원본 격자와 모든 deform 가중치를 그대로 캐시한다. 인게임용 재샘플링은 하지 않는다.
    pending = Puppet.load(asset.url);
    loaded.set(asset.url, pending);
  }
  return pending;
}

/**
 * 타이틀 로딩이 진행 칸을 나눠 보여줄 수 있도록 묶음을 두 무리로 갈라 둔다.
 * 전신 스탠딩이 먼저 필요하고(로비·발굴 연출), SD와 적은 전투에 들어가야 쓰인다.
 */
export const PUPPET_PRELOAD_GROUPS: ReadonlyArray<readonly PuppetAsset[]> = [
  [TORIKA_ASSET, LEXIA_ASSET, SEIRA_ASSET, LUKA_ASSET],
  [TORIKA_SD_ASSET, LEXIA_SD_ASSET, SEIRA_SD_ASSET, LUKA_SD_ASSET, ...ENEMY_SD_ASSETS, TOBY_ASSET, AMO_ASSET, RIPA_ASSET],
];

/**
 * 게임 플레이 전에 공용 묶음을 한 번 해석해 둔다.
 * ZIP 다운로드와 파싱이 첫 idle 프레임 도중 일어나면 재생 문제처럼 보이는 긴 프레임이 생기므로
 * 타이틀 로딩 화면에서 비용을 지불하고, 전투와 팝업에서는 캐시된 Puppet만 복제한다.
 *
 * 무리를 주면 그 무리만 읽는다. 이미 읽은 묶음은 캐시라 두 번 내려받지 않는다.
 */
export async function preloadPuppetAssets(
  group: readonly PuppetAsset[] = PUPPET_PRELOAD_GROUPS.flat(),
): Promise<void> {
  await Promise.all(group.map(loadPuppet));
}

export interface SpawnOptions {
  /** 발끝을 놓을 바닥 지점. `focus`를 주면 쓰이지 않는다. */
  x?: number;
  groundY?: number;
  /**
   * 코어(`중심1`)나 머리(`머리1`) 관절을 화면의 한 점에 맞추는 배치.
   * 화면 밖으로 잘려도 되는 큰 연출은 발끝 대신 이쪽을 쓴다.
   */
  focus?: { anchor: AnchorKind; x: number; y: number };
  /** 바닥 높이는 유지하면서 지정 관절의 가로 위치만 맞춘다. 로비 전신처럼 발을 세운 화면에 쓴다. */
  focusX?: { anchor: AnchorKind; x: number };
  /** 그림(투명 여백 제외)의 화면상 높이. 이 값에 맞춰 배율이 정해진다. */
  height: number;
  tint?: number;
  depth?: number;
  flipX?: boolean;
}

export interface Placement {
  /** Mesh에 그대로 넣을 좌표. 이미지 한가운데 기준이다. */
  x: number;
  y: number;
  scale: number;
}

/**
 * 발끝이 `groundY`에, 그림의 가로 중앙이 `x`에 오는 Mesh 좌표를 구한다.
 *
 * PuppetCreature는 Phaser Mesh라 원점이 **이미지 한가운데**다. 원하는 위치를 그대로
 * 넣으면 안 되고, 그림이 이미지 안에서 치우친 만큼 되돌려 놓아야 한다.
 */
export function computePlacement(
  asset: PuppetAsset,
  options: SpawnOptions & { x: number; groundY: number },
): Placement {
  const contentHeight = asset.content.bottom - asset.content.top;
  const scale = options.height / contentHeight;

  const contentCenterX = (asset.content.left + asset.content.right) / 2;
  // 이미지 중앙에서 그림 중앙까지의 어긋남과, 중앙에서 발끝까지의 거리를 배율만큼 되돌린다.
  // 좌우를 뒤집으면 가로 어긋남의 방향도 함께 뒤집힌다.
  const offsetX = (contentCenterX - asset.imageWidth / 2) * scale * (options.flipX ? -1 : 1);
  const offsetY = (asset.content.bottom - asset.imageHeight / 2) * scale;

  return { x: options.x - offsetX, y: options.groundY - offsetY, scale };
}

/** 묶음의 관절에서 해석한 코어·머리 기준점. 같은 파일은 한 번만 계산한다. */
const anchorCache = new Map<string, Record<AnchorKind, AnchorPoint>>();

/**
 * 묶음의 `중심1`·`머리1` 위치를 텍스처 좌표로 돌려준다.
 * ZIP은 이미 캐시되어 있으므로 두 번째 호출부터는 파싱 비용이 없다.
 */
export async function loadPuppetAnchors(asset: PuppetAsset): Promise<Record<AnchorKind, AnchorPoint>> {
  const cached = anchorCache.get(asset.url);
  if (cached) return cached;
  const template = await loadPuppet(asset);
  const anchors = resolveAnchors(template.project.bones, asset);
  anchorCache.set(asset.url, anchors);
  return anchors;
}

/** 카드 섬네일이 쓰는 정지 이미지. Mesh를 만들지 않고 원본 텍스처만 Phaser에 올린다. */
export interface PortraitTexture {
  key: string;
  anchors: Record<AnchorKind, AnchorPoint>;
}

/**
 * 섬네일용 텍스처 키와 기준점을 준비한다.
 *
 * 도감·편성 그리드처럼 여러 장이 동시에 필요한 곳에서 Mesh를 30개 만들면 GPU draw call이
 * 그만큼 늘어난다. 카드에는 같은 텍스처를 공유하는 정지 이미지만 쓴다.
 */
export async function loadPortraitTexture(scene: Phaser.Scene, asset: PuppetAsset): Promise<PortraitTexture> {
  const template = await loadPuppet(asset);
  const [key, anchors] = await Promise.all([ensureTexture(scene, template), loadPuppetAnchors(asset)]);
  return { key, anchors };
}

/** 카드 한 장의 잘라내기 상자를 묶음 기준점으로 계산한다. */
export function headCardFrame(asset: PuppetAsset, anchors: Record<AnchorKind, AnchorPoint>, options: CardFrameOptions): CardFrame {
  return computeHeadCardFrame(asset, anchors.head, options);
}

/** indexed renderer는 단일 GPU uniform으로 색 필터를 적용한다. */
export function tintPuppet(creature: PuppetCreature, color: number): void {
  creature.setTint(color);
}

/**
 * 요청한 방식(발끝 · 기준 관절)에 맞는 최종 좌표를 고른다.
 *
 * 관절 해석은 실제로 필요할 때만 한다. 실시간 전투는 매 프레임 여섯 명을 다시 놓기 때문에
 * 발끝 배치에서까지 관절 목록을 훑으면 그만큼이 그대로 프레임 비용이 된다.
 */
function resolvePlacement(
  asset: PuppetAsset,
  anchorsOf: () => Record<AnchorKind, AnchorPoint>,
  options: SpawnOptions,
): Placement {
  if (options.focus) {
    const focus: FocusOptions = {
      x: options.focus.x,
      y: options.focus.y,
      height: options.height,
      flipX: options.flipX,
    };
    return computeAnchoredPlacement(asset, anchorsOf()[options.focus.anchor], focus);
  }
  const grounded = computePlacement(asset, {
    ...options,
    x: options.x ?? 0,
    groundY: options.groundY ?? 0,
  });
  if (!options.focusX) return grounded;

  // 발끝의 세로 배치는 그대로 두고, 꼬리·날개 면적과 무관하게 중심 관절만 목표 x에 맞춘다.
  const anchor = anchorsOf()[options.focusX.anchor];
  const signedOffsetX = (anchor.x - asset.imageWidth / 2) * grounded.scale * (options.flipX ? -1 : 1);
  return { ...grounded, x: options.focusX.x - signedOffsetX };
}

/**
 * 묶음을 씬에 세운다. 기본은 발끝과 그림 중앙을 맞추고, `focusX`는 발을 둔 채 관절만 가로 정렬한다.
 * `focus`를 주면 그 대신 지정한 관절이 화면의 한 점에 오도록 놓는다.
 */
export async function spawnPuppet(
  scene: Phaser.Scene,
  asset: PuppetAsset,
  options: SpawnOptions,
): Promise<PuppetCreature> {
  const template = await loadPuppet(asset);
  // Puppet은 재생 시각·속도·강도를 내부에 보관한다. 같은 인스턴스를 여러 Mesh가 공유하면 한
  // 캐릭터의 play가 다른 캐릭터를 덮으므로, 정적 프로젝트만 공유하고 재생기는 개체마다 만든다.
  const puppet = Puppet.fromProject(template.project, template.texture);
  const creature = await IndexedPuppetCreature.fromPuppet(scene, puppet);

  placePuppet(creature, asset, options);
  if (options.tint !== undefined) tintPuppet(creature, options.tint);
  if (options.depth !== undefined) creature.setDepth(options.depth);
  if (options.flipX) creature.setFlipX(true);
  creature.play("idle");
  return creature;
}

/** 이미 세운 개체의 자리와 크기를 다시 잡는다. */
export function placePuppet(
  creature: PuppetCreature,
  asset: PuppetAsset,
  options: SpawnOptions,
): void {
  const { x, y, scale } = resolvePlacement(asset, () => resolveAnchors(creature.core.project.bones, asset), options);
  creature.setScale(scale);
  creature.setPosition(x, y);
  // 매 프레임 다시 놓는 전투에서는 여기가 방향 전환도 함께 맡는다. 요청이 없으면 지금 방향을 지킨다.
  creature.setFlipX(options.flipX ?? creature.flipX);
}

/**
 * 있는 동작 중 첫 번째를 재생한다. 한 번만 재생하는 동작은 끝날 즈음 idle로 돌려놓는다
 * (그냥 두면 마지막 자세로 굳는다).
 */
/** 실제로 선택된 원본 이름과 재생 시간을 노출해 씬이 추측 타이머 없이 다음 연출을 이을 수 있다. */
export interface MotionPlayback {
  readonly playedName: string | null;
  readonly durationMs: number;
  /** idle 복귀까지 기다린다. 씬 종료로 타이머가 폐기된 경우에도 즉시 풀린다. */
  readonly completed: Promise<void>;
}

export function playMotion(
  scene: Phaser.Scene,
  creature: PuppetCreature,
  motion: MotionName,
): MotionPlayback {
  const config: MotionConfig = MOTION[motion];
  // 더 중요한 동작이 아직 재생 중이면 그대로 둔다. 공격은 끝까지 휘두르고, 피격이 자른다.
  const held = motionHold.get(creature);
  if (held && held.until > scene.time.now && held.priority >= config.priority) {
    return { playedName: null, durationMs: 0, completed: Promise.resolve() };
  }

  const options = { speed: config.speed, strength: config.strength };
  const playedName = config.names.find((name) => creature.play(name, options));
  if (!playedName) return { playedName: null, durationMs: 0, completed: Promise.resolve() };

  const generation = (motionGeneration.get(creature) ?? 0) + 1;
  motionGeneration.set(creature, generation);
  motionTimers.get(creature)?.remove(false);
  motionTimers.delete(creature);
  motionHold.delete(creature);

  if (!config.returnsToIdle || playedName === "idle") {
    return { playedName, durationMs: 0, completed: Promise.resolve() };
  }

  // PuppetForge의 내보내기 speed/strength/secondary는 play()가 그대로 적용한다. 복귀 시각도
  // 고정 숫자가 아니라 내보낸 duration과 실제 재생 속도로 계산해 동작이 중간에 잘리지 않게 한다.
  const exportedMotion = creature.core.project.animations[playedName];
  const speed = Math.max((config.speed ?? exportedMotion.speed) ?? 1, 0.01);
  const holdMs = (exportedMotion.duration / speed) * 1000;
  motionHold.set(creature, { priority: config.priority, until: scene.time.now + holdMs });
  let resolveCompletion!: () => void;
  const completed = new Promise<void>((resolve) => { resolveCompletion = resolve; });
  const finish = () => {
    // 공격 직후 피격처럼 동작이 겹쳐도 가장 최근 동작의 유지 시간은 온전히 보장한다.
    if (motionGeneration.get(creature) !== generation) { resolveCompletion(); return; }
    motionTimers.delete(creature);
    motionHold.delete(creature);
    if (creature.active) creature.play("idle");
    resolveCompletion();
  };
  const timer = scene.time.delayedCall(holdMs, finish);
  motionTimers.set(creature, timer);
  // shutdown은 Phaser 타이머를 조용히 폐기하므로 Promise도 함께 해제해 비동기 시퀀스를 남기지 않는다.
  scene.events.once("shutdown", resolveCompletion);
  completed.finally(() => scene.events.off("shutdown", resolveCompletion));
  return { playedName, durationMs: holdMs, completed };
}

/** 맞은 순간 붉게 물드는 시간(ms)과 색. 동작을 크게 흔들지 않아도 피격이 눈에 띄게 한다. */
const HIT_FLASH_MS = 120;
const HIT_FLASH_TINT = 0xff8a7a;
const flashTimers = new WeakMap<PuppetCreature, Phaser.Time.TimerEvent>();

/**
 * 피격 표시. 잠깐 붉게 덮었다가 원래 색으로 돌아온다.
 *
 * 연달아 맞아도 마지막 한 번만 색을 되돌리도록 이전 예약을 지운다. 그러지 않으면 먼저 걸린
 * 타이머가 아직 붉어야 할 캐릭터의 색을 지운다.
 */
export function flashHit(scene: Phaser.Scene, creature: PuppetCreature, baseTint = 0xffffff): void {
  flashTimers.get(creature)?.remove(false);
  tintPuppet(creature, HIT_FLASH_TINT);
  flashTimers.set(
    creature,
    scene.time.delayedCall(HIT_FLASH_MS, () => {
      flashTimers.delete(creature);
      if (creature.active) tintPuppet(creature, baseTint);
    }),
  );
}

/** 전신 일러스트를 누르면 현재 동작을 새 hit 동작으로 교체한다. */
export function enableHitOnClick(scene: Phaser.Scene, creature: PuppetCreature): void {
  creature.setInteractive({ useHandCursor: true });
  creature.on("pointerup", () => playMotion(scene, creature, "hit"));
}
