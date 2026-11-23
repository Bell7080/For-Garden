import Phaser from "phaser";

type Rect = { x: number; y: number; width: number; height: number };
type Raisable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth;

/**
 * 튜토리얼이 화면을 덮는 동안에도 설정만은 열 수 있게 하는 경계.
 *
 * 튜토리얼 막(`TutorialSpotlight`)은 구멍 밖의 입력을 모두 삼키므로, 막 아래에 선 상단 줄의 설정 아이콘·전투의 정지 버튼도
 * 함께 눌리지 않았다. 화면마다 깊이를 손으로 맞추면 막의 깊이가 바뀔 때 어긋나므로, 설정을 여는 조각을 씬마다 여기에
 * 적어 두고 막이 서는 동안만 막 위로 올렸다가 걷히면 원래 깊이로 되돌린다. 막이 여럿 겹치면 가장 높은 막 위에 선다.
 */
interface SceneAccess {
  objects: Raisable[];
  /** 누르는 면 — 건너뛰기 칩이 이 자리를 피해 선다. */
  hits: Raisable[];
  /** 지금 걸린 올림 요청의 깊이들. 비면 원래 깊이로 돌아간다. */
  raises: Map<number, number>;
  saved: Map<Raisable, number>;
  nextId: number;
}

const ACCESS = new WeakMap<Phaser.Scene, SceneAccess>();

function accessOf(scene: Phaser.Scene): SceneAccess {
  let access = ACCESS.get(scene);
  if (!access) {
    access = { objects: [], hits: [], raises: new Map(), saved: new Map(), nextId: 1 };
    ACCESS.set(scene, access);
    // 씬이 다시 서면 조각도 새로 생기므로 지난 목록을 들고 있지 않는다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ACCESS.delete(scene));
  }
  return access;
}

function apply(access: SceneAccess): void {
  const live = access.objects.filter((object) => object.scene);
  if (access.raises.size === 0) {
    for (const object of live) {
      const depth = access.saved.get(object);
      if (depth !== undefined) object.setDepth(depth);
    }
    access.saved.clear();
    return;
  }
  const top = Math.max(...access.raises.values());
  for (const object of live) {
    if (!access.saved.has(object)) access.saved.set(object, object.depth);
    object.setDepth(top + 3);
  }
  // 누르는 면은 그림보다 한 뼘 위다 — 같은 깊이면 먼저 더한 그림이 손을 먼저 받을 수 있다.
  for (const hit of access.hits) if (hit.scene) hit.setDepth(top + 3.1);
}

/** 설정을 여는 조각(그림과 누르는 면)을 적는다. 누르는 면은 `hit`으로 넘긴다. */
export function registerSettingsAccess(scene: Phaser.Scene, objects: readonly Raisable[], hit?: Raisable): void {
  const access = accessOf(scene);
  access.objects.push(...objects);
  if (hit) { access.objects.push(hit); access.hits.push(hit); }
  // 막이 이미 서 있는 동안 세워진 조각도 곧바로 올라간다.
  if (access.raises.size > 0) apply(access);
}

/** 이 깊이의 막 위로 설정 조각을 올린다. 돌려받은 함수로 내린다(여러 번 불러도 한 번만 내린다). */
export function raiseSettingsAccess(scene: Phaser.Scene, depth: number): () => void {
  const access = accessOf(scene);
  const id = access.nextId++;
  access.raises.set(id, depth);
  apply(access);
  return () => {
    if (!access.raises.delete(id)) return;
    apply(access);
  };
}

/** 설정 조각이 누르는 자리. 튜토리얼 건너뛰기 칩이 그 위에 겹쳐 서지 않게 피할 때 쓴다. */
export function settingsAccessRects(scene: Phaser.Scene): Rect[] {
  const access = ACCESS.get(scene);
  if (!access) return [];
  return access.hits.filter((hit) => hit.scene).map((hit) => {
    const bounds = (hit as unknown as { getBounds(): Phaser.Geom.Rectangle }).getBounds();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
}
