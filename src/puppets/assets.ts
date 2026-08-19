import type Phaser from "phaser";
import { Puppet, PuppetCreature } from "puppetforge/phaser";

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
}

const base = import.meta.env.BASE_URL;

/** 정보창에 띄우는 전신 일러스트. 지금은 idle 하나만 들어 있다. */
export const CHAR_ASSET: PuppetAsset = {
  url: `${base}puppets/char_001.zip`,
  imageWidth: 1054,
  imageHeight: 1492,
  content: { left: 95, top: 69, right: 894, bottom: 1419 },
};

/** 전장에 세우는 SD 개체. idle · hit · stun · roar를 가지고 있다. */
export const ENTITY_ASSET: PuppetAsset = {
  url: `${base}puppets/entity_001.zip`,
  imageWidth: 1254,
  imageHeight: 1254,
  content: { left: 352, top: 155, right: 993, bottom: 1082 },
};

/**
 * 전장에서 쓰는 동작. 묶음마다 가진 동작이 달라서 쓸 이름을 순서대로 적어 둔다 —
 * 앞에서부터 있는 것을 쓰고, 하나도 없으면 그냥 넘어간다.
 */
export const MOTION = {
  idle: { names: ["idle"] },
  hit: { names: ["hit", "idle"], holdMs: 520 },
  /** 공격 동작이 따로 없어 포효로 대신한다. */
  attack: { names: ["attack", "roar", "idle"], holdMs: 900 },
} as const satisfies Record<string, { names: readonly string[]; holdMs?: number }>;

export type MotionName = keyof typeof MOTION;

/** 개체별 최신 동작 번호. 오래된 복귀 타이머가 새 동작을 idle로 끊지 못하게 한다. */
const motionGeneration = new WeakMap<PuppetCreature, number>();

/** 묶음은 파일당 한 번만 읽고 여러 마리가 나눠 쓴다. */
const loaded = new Map<string, Promise<Puppet>>();

function loadPuppet(asset: PuppetAsset): Promise<Puppet> {
  let pending = loaded.get(asset.url);
  if (!pending) {
    pending = Puppet.load(asset.url);
    loaded.set(asset.url, pending);
  }
  return pending;
}

/**
 * 게임 플레이 전에 공용 묶음을 한 번 해석해 둔다.
 * ZIP 다운로드와 파싱이 첫 idle 프레임 도중 일어나면 재생 문제처럼 보이는 긴 프레임이 생기므로
 * 부트 화면에서 비용을 지불하고, 전투와 팝업에서는 캐시된 Puppet만 복제한다.
 */
export async function preloadPuppetAssets(): Promise<void> {
  await Promise.all([loadPuppet(CHAR_ASSET), loadPuppet(ENTITY_ASSET)]);
}

export interface SpawnOptions {
  /** 발끝을 놓을 바닥 지점. */
  x: number;
  groundY: number;
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
export function computePlacement(asset: PuppetAsset, options: SpawnOptions): Placement {
  const contentHeight = asset.content.bottom - asset.content.top;
  const scale = options.height / contentHeight;

  const contentCenterX = (asset.content.left + asset.content.right) / 2;
  // 이미지 중앙에서 그림 중앙까지의 어긋남과, 중앙에서 발끝까지의 거리를 배율만큼 되돌린다.
  const offsetX = (contentCenterX - asset.imageWidth / 2) * scale;
  const offsetY = (asset.content.bottom - asset.imageHeight / 2) * scale;

  return { x: options.x - offsetX, y: options.groundY - offsetY, scale };
}

/** Mesh에는 tint가 없다. 정점 색을 직접 칠해 색 필터를 만든다. */
export function tintPuppet(creature: PuppetCreature, color: number): void {
  for (const vertex of creature.vertices) vertex.color = color;
}

/**
 * 묶음을 씬에 세운다. 발끝이 `groundY`에, 그림의 가로 중앙이 `x`에 오도록 놓는다.
 */
export async function spawnPuppet(
  scene: Phaser.Scene,
  asset: PuppetAsset,
  options: SpawnOptions,
): Promise<PuppetCreature> {
  const puppet = await loadPuppet(asset);
  const creature = await PuppetCreature.fromPuppet(scene, puppet);

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
  const { x, y, scale } = computePlacement(asset, options);
  creature.setScale(scale);
  creature.setPosition(x, y);
  // setScale이 좌우 반전을 지웠을 수 있어 다시 맞춘다.
  if (creature.flipX) creature.setFlipX(true);
}

/**
 * 있는 동작 중 첫 번째를 재생한다. 한 번만 재생하는 동작은 끝날 즈음 idle로 돌려놓는다
 * (그냥 두면 마지막 자세로 굳는다).
 */
export function playMotion(
  scene: Phaser.Scene,
  creature: PuppetCreature,
  motion: MotionName,
): void {
  const config = MOTION[motion];
  const played = config.names.some((name) => creature.play(name));
  if (!played) return;

  const generation = (motionGeneration.get(creature) ?? 0) + 1;
  motionGeneration.set(creature, generation);

  const holdMs = "holdMs" in config ? config.holdMs : undefined;
  if (holdMs === undefined) return;
  scene.time.delayedCall(holdMs, () => {
    // 공격 직후 피격처럼 동작이 겹쳐도 가장 최근 동작의 유지 시간은 온전히 보장한다.
    if (creature.active && motionGeneration.get(creature) === generation) creature.play("idle");
  });
}
