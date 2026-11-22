import Phaser from "phaser";
import { SKILL_ART_ASSETS, SKILL_ART_SLOTS, skillArtFor } from "./skillArt";

/**
 * 스킬 일러스트를 **쓸 때** GPU에 올린다.
 *
 * 타이틀에서 214장을 다 올리던 때는 한 장 256×256이라도 합쳐 56MB가 끝까지 붙잡혔다(v0.514.0 실측). 한 번에
 * 보는 것은 렐릭 몇 명 몫이라, 파일은 타이틀이 캐시에만 받아 두고(`prefetchCachedFiles`) 여기서 그 액자가 설 때
 * 읽는다. 한 번 올린 그림은 내리지 않는다 — 한 실행에 실제로 보는 개체 수만큼만 남는다.
 */
const PATHS: ReadonlyMap<string, string> = new Map(SKILL_ART_ASSETS.map(([key, path]) => [key, path]));
const pending = new Map<string, Promise<boolean>>();

export function ensureSkillArt(scene: Phaser.Scene, key: string): Promise<boolean> {
  if (scene.textures.exists(key)) return Promise.resolve(true);
  const path = PATHS.get(key);
  if (!path) return Promise.resolve(false);
  const existing = pending.get(key);
  if (existing) return existing;
  const job = new Promise<boolean>((resolve) => {
    const done = (ok: boolean): void => {
      scene.load.off(`filecomplete-image-${key}`, onComplete);
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
      resolve(ok);
    };
    const onComplete = (): void => done(true);
    const onError = (file: Phaser.Loader.File): void => { if (file.key === key) done(false); };
    // 씬이 먼저 닫히면 완료 신호가 오지 않는다 — 기다리던 쪽을 반드시 풀어 준다.
    const onShutdown = (): void => done(scene.textures.exists(key));
    scene.load.once(`filecomplete-image-${key}`, onComplete);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.load.image(key, path);
    scene.load.start();
  });
  pending.set(key, job);
  void job.then(() => pending.delete(key));
  return job;
}

/** 전투처럼 그 자리에서 곧바로 그려야 하는 화면이 들어설 때, 그 개체들의 네 칸을 미리 올려 둔다. */
export function ensureSkillArtFor(scene: Phaser.Scene, relicIds: Iterable<string>): Promise<void> {
  const keys = new Set<string>();
  for (const id of relicIds) for (const slot of SKILL_ART_SLOTS) {
    const key = skillArtFor(id, slot);
    if (key) keys.add(key);
  }
  return Promise.all([...keys].map((key) => ensureSkillArt(scene, key))).then(() => undefined);
}

/** 아직 올라오지 않았지만 늦게 올릴 수 있는 스킬 일러스트인가. */
export function isLazySkillArt(scene: Phaser.Scene, key: string | undefined): key is string {
  return key !== undefined && !scene.textures.exists(key) && PATHS.has(key);
}
