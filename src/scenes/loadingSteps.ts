import type Phaser from "phaser";
import { CHEST_ART_ASSETS } from "../ui/chestArt";
import { preloadPuppetAssets, PUPPET_PRELOAD_GROUPS } from "../puppets/assets";
import { BACKGROUND_ASSETS, BACKGROUND_BOOT_KEYS } from "../ui/backgrounds";
import { CONTENT_ENTRY_ART_PATHS } from "../ui/backgroundAssets";
import { prefetchCachedFiles } from "../ui/cachedFilePrefetch";
import { loadGameFonts } from "../ui/fonts";
import { loadDataOverlay, loadTextCatalog } from "../i18n";
import { BATTLE_SOUND_ASSETS, RESEARCH_SOUND_ASSETS, SCENE_SOUND_ASSETS, UI_SOUND_ASSETS } from "../managers/AudioManager";
import { settingsManager } from "../managers/SettingsManager";
import { UI_ICON_ASSETS, UI_RASTER_ICON_ASSETS } from "../ui/icons";
import { AFFINITY_ICON_ASSETS } from "../ui/affinityIcons";
import { ENCOUNTER_ROLE_ICON_ASSETS } from "../ui/encounterRolePresentation";
import { CURRENCY_ICON_ASSETS } from "../ui/currencyIcons";
import { RUNE_ICON_ASSETS } from "../ui/runeIcons";
import { SKILL_ICON_ASSETS } from "../ui/skillIcons";
import { SKILL_ART_ASSETS } from "../ui/skillArt";
import { EXCAVATION_TRAIT_ICON_ASSETS } from "../ui/excavationIcons";
import { ITEM_ICON_ASSETS, ITEM_RASTER_ICON_ASSETS } from "../ui/itemIcons";
import { SQUAD_EMBLEM_ASSETS } from "../data/factions";
import { SHOP_PRODUCT_ICON_ASSETS } from "../data/shopCatalog";
import { PLAYABLE_RELICS } from "../data/relics";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { retryUrl } from "../core/retryUrl";
import { preloadResearchCinematic } from "../ui/ResearchCinematic";
import { preloadSsrOmen } from "../ui/SsrOmenCinematic";

/**
 * 타이틀 화면이 지불하는 로딩 비용의 전부.
 *
 * 부트는 저장 데이터만 보고 곧바로 타이틀을 띄운다. 무거운 원화·아이콘·Puppet 묶음은 여기서
 * 읽어, 기다리는 동안 사용자가 검은 화면 대신 제목과 진행 칸을 본다. 로딩할 것이 늘면 씬에
 * 직접 `load`를 부르지 말고 이 목록에 단계를 더한다 — 진행 칸 수가 목록 길이라서 저절로 맞는다.
 */
export interface LoadingStep {
  /**
   * 디버깅과 테스트에서 단계를 가리키는 이름. **화면에는 띄우지 않으므로 번역하지 않는다** —
   * 언어를 따라 바뀌면 E2E가 어느 단계인지 확인하는 기준이 언어마다 갈린다.
   */
  readonly label: string;
  run(scene: Phaser.Scene): Promise<void>;
}

/** 일시적인 네트워크 끊김으로 실패한 파일을 다시 받는 횟수. */
export const LOAD_RETRY_ROUNDS = 2;

/**
 * 다시 받을 파일 한 장. Phaser의 `File`은 로더가 끝나면 부서지므로 다시 줄 세울 값만 떼어 둔다.
 * 이미지·SVG·소리만 다루는 이유는 이 로딩 단계가 그 셋만 읽기 때문이다.
 */
interface RetryableFile {
  readonly type: string;
  readonly key: string;
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
}

function retryableOf(file: Phaser.Loader.File): RetryableFile | undefined {
  if (typeof file.url !== "string") return undefined;
  const config = file.config as { width?: number; height?: number } | undefined;
  return { type: file.type, key: file.key, url: file.url.replace(/[?&]retry=\d+$/, ""), width: config?.width, height: config?.height };
}

/**
 * 단계 안의 재시도로도 끝내 받지 못한 파일. **입장을 막지 않고** 게임에 들어간 뒤 뒤에서 다시 받는다
 * (`retryUnresolvedLater`). 텍스처·소리 캐시는 게임 전체가 함께 쓰므로 받는 순간 다음 화면부터 선다.
 */
const unresolvedFiles = new Map<string, RetryableFile>();

/** 실패한 파일을 같은 종류로 다시 줄 세운다. 키가 같아 이미 올라온 것은 건너뛴다. */
function requeueFailed(scene: Phaser.Scene, failed: readonly RetryableFile[], round: number): number {
  let queued = 0;
  for (const file of failed) {
    if (scene.textures.exists(file.key) || scene.cache.audio.exists(file.key)) continue;
    const url = retryUrl(file.url, round);
    if (file.type === "image") scene.load.image(file.key, url);
    else if (file.type === "svg") scene.load.svg(file.key, url, { width: file.width, height: file.height });
    else if (file.type === "audio") scene.load.audio(file.key, url);
    else continue;
    queued += 1;
  }
  return queued;
}

/**
 * Phaser 로더는 콜백식이라 단계 하나를 기다릴 수 있게 감싼다.
 *
 * 파일 하나가 실패해도 `complete`는 온다. 예전에는 그대로 넘어가 그 아이콘·원화가 **그 접속이 끝날 때까지
 * 영영 없었다** — 부팅 순간의 짧은 끊김 하나가 "가끔 일러스트가 안 뜬다"가 된 것이다. 실패한 파일은
 * 단계를 끝내기 전에 두 번 더 받아 본다.
 */
function loadWithPhaser(scene: Phaser.Scene, queue: () => void): Promise<void> {
  return new Promise((resolve) => {
    queue();
    if (scene.load.list.size === 0) {
      resolve();
      return;
    }
    let failed: RetryableFile[] = [];
    let round = 0;
    const onError = (file: Phaser.Loader.File): void => {
      const retryable = retryableOf(file);
      if (retryable) failed.push(retryable);
    };
    const onComplete = (): void => {
      if (failed.length > 0 && round < LOAD_RETRY_ROUNDS && scene.scene.isActive()) {
        round += 1;
        const batch = failed;
        failed = [];
        if (requeueFailed(scene, batch, round) > 0) {
          scene.load.once("complete", onComplete);
          scene.load.start();
          return;
        }
      }
      scene.load.off("loaderror", onError);
      failed.forEach((file) => unresolvedFiles.set(file.key, file));
      resolve();
    };
    scene.load.on("loaderror", onError);
    scene.load.once("complete", onComplete);
    scene.load.start();
  });
}

/**
 * SVG를 몇 픽셀로 구울지.
 *
 * 스킬 아이콘은 정보창(74px)보다 팝업(82px)에서 더 크게 서고, 앞으로 들어올 SVG 일러스트는
 * 더 클 수 있다. 넉넉히 굽고 줄여 쓰는 편이 확대해서 뭉개는 것보다 낫다.
 */
const SVG_BAKE = { skill: 256, uiScale: 2 } as const;

/**
 * 타이틀이 GPU까지 올리는 콘텐츠 원화 — 보물상자 둘뿐이다(굽는 함수가 원본을 곧바로 읽는다).
 *
 * 출격·결투 칸과 관찰 일지의 원화는 여기서 올리지 않는다 — 배경과 같은 거주 규칙으로 그 칸이 설 때 올린다
 * (`CONTENT_ENTRY_ART`). 파일만 캐시에 받아 둔다(아래 「배경 원화」 단계).
 */
const CONTENT_ART_ASSETS = [...CHEST_ART_ASSETS] as const;

/**
 * **입장 문구가 서기 전에 타이틀이 다 받는다** — 들어간 뒤에 받으면 로비·전투에서 원화가 늦게 서거나 그 순간 끊긴다.
 * 대신 **순서를 가른다**: 타이틀 자신의 원화·로고·영상이 먼저 망을 쓰고(`TitleScene.create`), 글꼴 단계 뒤의 무거운
 * 단계는 제목이 열린 뒤(영상이 흐르기 시작하거나 대체 시한이 지난 뒤 — `runLoadingSteps`의 `holdHeavy`)에 시작한다.
 * 예전에는 첫 단계부터 스킬 일러스트 214장까지 한꺼번에 망을 나눠 먹어 첫 실행의 영상이 서지 않았다.
 * 단계마다 시한(`LOADING_STEP_DEADLINE_MS`)이 있어 하나가 멎어도 입장은 막지 않고, 끝내 못 받은 파일은 입장 뒤에
 * 살아 있는 겹의 로더로 다시 받는다(`retryUnresolvedLater`).
 *
 * **출시 전에 채울 자리** — Puppet 미리 읽기 목록(`PUPPET_PRELOAD_GROUPS`)은 일부러 좁다. 전신 25종 중 여섯과 아군 SD
 * 19종 중 다섯만 들어 있고 나머지는 정보창·전투에 들어가는 순간 처음 읽는다. 넓히려면 **전부 읽으면 안 된다** — 디코드된
 * 그림이 첫 스폰까지 남으므로(한 장 6.5MB) 보유 렐릭·현재 편성만 골라 이 단계에 넣는다.
 */
export const LOADING_STEPS: ReadonlyArray<LoadingStep> = [
  {
    label: "글꼴",
    // 그 언어가 실제로 쓰는 글꼴과 문구 표만 내려받는다 — 전부 올리면 한국어만 쓰는 사람도
    // 열한 언어를 함께 받는다. 둘은 같은 시점에 있어야 하므로 한 단계로 묶는다.
    run: () => {
      const language = settingsManager.get().game.language;
      return Promise.all([loadGameFonts(language), loadTextCatalog(language), loadDataOverlay(language)]).then(() => undefined);
    },
  },
  {
    label: "화면 조작음",
    // 아주 작은 파일들이다(UI·전투·연구소 — 모두 합쳐 수백 KB). 실패해도 소리만 없고 게임은 그대로 진행한다(없는 에셋은 조용히 건너뛴다).
    run: (scene) => loadWithPhaser(scene, () => [...UI_SOUND_ASSETS, ...BATTLE_SOUND_ASSETS, ...RESEARCH_SOUND_ASSETS, ...SCENE_SOUND_ASSETS].forEach(([key, path]) => scene.load.audio(key, path))),
  },
  {
    label: "배경 원화",
    run: (scene) =>
      loadWithPhaser(scene, () => {
        // **전부 읽지 않는다.** 한 장이 디코드되면 25MB라 열여덟 장이면 로비에 닿기도 전에
        // 텍스처만 434MB가 된다. 나머지는 그 화면에 들어갈 때 읽고 나올 때 내린다 —
        // 규칙은 backgrounds.ts와 backgroundResidency.ts가 갖는다.
        const paths = new Map<string, string>(BACKGROUND_ASSETS.map(([key, path]) => [key, path]));
        BACKGROUND_BOOT_KEYS.forEach((key) => {
          const path = paths.get(key);
          if (path) scene.load.image(key, path);
        });
        CONTENT_ART_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
      }),
  },
  {
    label: "조작·스킬 아이콘",
    run: (scene) =>
      loadWithPhaser(scene, () => {
        // SVG를 그대로 이미지로 받으면 파일에 적힌 크기 그대로 구워져 확대할 때 뭉갠다.
        // 화면에서 쓰는 크기보다 넉넉히 크게 래스터화해 두고 줄여 쓴다.
        SKILL_ICON_ASSETS.forEach(([key, path]) => scene.load.svg(key, path, { width: SVG_BAKE.skill, height: SVG_BAKE.skill }));
        // 속성·직군은 이미 구워 둔 WebP라 그대로 읽는다.
        AFFINITY_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 적 정보창의 역할 아이콘도 스킬 일러스트와 같은 흰 실루엣 WebP다.
        ENCOUNTER_ROLE_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        CURRENCY_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 상품 key는 현재 임시 원화를 가리키며, 최종 그림 교체 위치는 shopCatalog 한곳이다.
        SHOP_PRODUCT_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 스쿼드 엠블럼도 이미 구워 둔 WebP다. 색은 파일에 들어 있고 화면은 어둠만 덧댄다.
        SQUAD_EMBLEM_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        RUNE_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 임시 item SVG도 개별 가방 씬이 아니라 공용 단계에서 크게 구운 뒤 축소해 사용한다.
        ITEM_ICON_ASSETS.forEach(([key, path]) => scene.load.svg(key, path, { width: SVG_BAKE.skill, height: SVG_BAKE.skill }));
        // 구운 WebP는 SVG 파서에 넣지 않는다 — 루트를 못 찾으면 Phaser가 예외를 던져 로더가 거기서 멎는다.
        ITEM_RASTER_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        UI_ICON_ASSETS.forEach(([key, path, size]) => scene.load.svg(key, path, { width: size * SVG_BAKE.uiScale, height: size * SVG_BAKE.uiScale }));
        // 원화로 온 UI 아이콘은 벡터가 아니라 그림 한 장이라 그대로 읽는다.
        UI_RASTER_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 발굴 특화는 카드 보조 정보 크기의 단색 SVG라 UI 아이콘과 같은 배율로 미리 굽는다.
        EXCAVATION_TRAIT_ICON_ASSETS.forEach(([key, path]) => scene.load.svg(key, path, { width: 64, height: 64 }));
        // 전용 스킬 일러스트(흰 실루엣 WebP)는 **캐시에만** 받는다 — 214장을 다 올리면 56MB인데 한 번에 보는 것은
        // 렐릭 몇 명 몫이다. 그 액자가 설 때 올린다(`skillArtLoader.ts`). 캐시 받기는 아래 단계가 한다.
      }),
  },
  { label: "렐릭 스탠딩", run: () => preloadPuppetAssets(PUPPET_PRELOAD_GROUPS[0]) },
  { label: "SD·적 묶음", run: () => preloadPuppetAssets(PUPPET_PRELOAD_GROUPS[1]) },
  {
    label: "뽑기 연출",
    // 뽑기의 3D 시네마틱과 SSR 전조 무대는 합쳐 1MB 남짓한 스크립트라, 첫 뽑기에서 받으면 그 자리에서 화면이 멎는다.
    // 새로 만난 렐릭의 소개 원화(35MB 남짓)는 여기서 받지 않는다 — 연구소에 들어갈 때 건다(`prefetchGachaPuppetFiles`).
    run: () => Promise.all([preloadResearchCinematic(), preloadSsrOmen()?.then(() => undefined, () => undefined)]).then(() => undefined),
  },
  {
    label: "출격 원화·스킬 일러스트",
    // 캐시에만 받는다(올리는 것은 그 그림이 설 때 — 거주 규칙).
    run: () => prefetchCachedFiles([...CONTENT_ENTRY_ART_PATHS, ...SKILL_ART_ASSETS.map(([, path]) => path)]),
  },
];
/** 끝내 못 받은 필수 파일을 다시 받아 보는 시각(입장 뒤 ms). 망이 돌아오는 순간을 몇 번에 걸쳐 노린다. */
export const UNRESOLVED_RETRY_DELAYS_MS = [4000, 15000, 45000] as const;

let retryScheduled = false;

/**
 * 타이틀에서 끝내 못 받은 파일을 입장 뒤에 다시 받아 보도록 건다. 한 실행에 한 번만 걸린다.
 *
 * `loaderScene`은 로더를 빌려 줄 씬이다 — 화면이 바뀌어도 살아 있는 겹(`effect-overlay`)을 준다. 타이틀의 로더를 쓰면
 * 입장과 함께 타이틀이 닫히며 받던 것이 끊긴다.
 */
export function retryUnresolvedLater(loaderScene: () => Phaser.Scene | undefined): void {
  if (retryScheduled) return;
  retryScheduled = true;
  UNRESOLVED_RETRY_DELAYS_MS.forEach((delay, index) => setTimeout(() => retryUnresolved(loaderScene(), LOAD_RETRY_ROUNDS + index + 1), delay));
}

function retryUnresolved(scene: Phaser.Scene | undefined, round: number): void {
  if (unresolvedFiles.size === 0 || !scene?.sys.isActive()) return;
  // 그사이 다른 길로 올라온 것은 지운다.
  for (const [key] of unresolvedFiles) if (scene.textures.exists(key) || scene.cache.audio.exists(key)) unresolvedFiles.delete(key);
  const batch = [...unresolvedFiles.values()];
  if (batch.length === 0) return;
  // 겹의 로더가 다른 일로 돌고 있으면 이번 차례는 건너뛴다(같은 로더에 끼우면 그 일의 완료 신호가 섞인다).
  if (scene.load.isLoading()) return;
  const onLoaded = (key: string): void => { unresolvedFiles.delete(key); };
  scene.load.on("filecomplete", onLoaded);
  scene.load.once("complete", () => scene.load.off("filecomplete", onLoaded));
  if (requeueFailed(scene, batch, round) > 0) scene.load.start();
  else scene.load.off("filecomplete", onLoaded);
}

let gachaPuppetFilesRequested = false;

/**
 * 뽑을 수 있는 개체의 전신·SD ZIP을 내려받아 캐시에만 둔다. 한 번에 두 개씩, 뒤에서. 연구소가 들어설 때 부르며
 * 한 실행에 한 번만 건다. 받아 둔 것은 브라우저 캐시에 남아 소개 장면이 일꾼에게 넘길 때 네트워크를 건너뛴다.
 * 파싱·디코드는 하지 않는다(GPU·메모리를 쓰는 것은 세울 때뿐이어야 한다 — 거주 규칙).
 */
export function prefetchGachaPuppetFiles(): void {
  if (gachaPuppetFilesRequested) return;
  gachaPuppetFilesRequested = true;
  const urls = [...new Set(PLAYABLE_RELICS.flatMap((relic) => [
    relicAppearanceManager.portraitAssetFor(relic.id).url,
    relicAppearanceManager.battleAssetFor(relic.id).url,
  ]))];
  const next = (): void => {
    const url = urls.shift();
    if (!url) return;
    void fetch(url, { priority: "low" } as RequestInit).then((response) => response.arrayBuffer()).catch(() => undefined).finally(next);
  };
  next();
  next();
}

/**
 * 단계를 순서대로 밟으며 끝난 개수를 알린다.
 *
 * 한 단계가 실패해도 다음으로 넘어간다 — 아트 파일 하나가 UI와 전투 규칙까지 막지 않는다.
 * 병렬로 몰아 받지 않는 이유는 진행 칸이 실제로 하나씩 차야 기다림이 읽히기 때문이다.
 */
/**
 * 한 단계가 멎어도 입장은 막지 않는다. 망이 끊겨 파일 하나의 응답이 오지 않으면 `complete`가 영영 오지
 * 않아 진행 칸이 그 자리에서 멈추고 플레이어는 타이틀에서 나갈 수 없었다. 시한이 지나면 그 단계는 실패와
 * 같이 넘기고(위 catch와 같은 규칙), 늦게 도착한 파일은 그대로 쓰인다.
 */
export const LOADING_STEP_DEADLINE_MS = 30000;
/** 무거운 단계가 제목이 열리기를 기다리는 상한. 타이틀의 대체 시한(2.6초)보다 넉넉하다. */
export const HEAVY_HOLD_LIMIT_MS = 5000;
function withStepDeadline(run: Promise<unknown> | undefined): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => { timer = setTimeout(resolve, LOADING_STEP_DEADLINE_MS); });
  return Promise.race([Promise.resolve(run), deadline]).finally(() => { if (timer) clearTimeout(timer); });
}

export async function runLoadingSteps(
  scene: Phaser.Scene,
  onStepDone: (done: number, total: number) => void,
  steps: ReadonlyArray<LoadingStep> = LOADING_STEPS,
  /**
   * 0~1로 흐르는 진행률. 칸은 끝난 단계만 세지만 아래 숫자는 그 사이도 말해야 한다.
   *
   * 파일을 읽는 단계는 Phaser 로더가 알려 주는 몫까지 실어 보내고, 글꼴·Puppet처럼 진행을
   * 알려 주지 않는 단계는 끝나는 순간에만 오른다 — 없는 진행을 지어내지 않는다.
   */
  onProgress?: (ratio: number) => void,
  /**
   * 첫 단계(글꼴) 뒤의 무거운 단계를 붙잡는 문. 타이틀은 제목이 열릴 때(영상이 흐르거나 대체 시한) 연다 — 그동안
   * 망은 타이틀 자신의 영상이 쓴다. 문이 끝내 열리지 않아도 `HEAVY_HOLD_LIMIT_MS` 뒤에는 넘어간다.
   */
  holdHeavy?: Promise<void>,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    if (i === 1 && holdHeavy) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([holdHeavy, new Promise<void>((resolve) => { timer = setTimeout(resolve, HEAVY_HOLD_LIMIT_MS); })]);
      if (timer) clearTimeout(timer);
      if (!scene.scene.isActive()) return;
    }
    // 상수 대신 문자열을 쓰는 것은 이 모듈이 Phaser를 값으로 들이지 않기 때문이다
    // (`Phaser.Loader.Events.PROGRESS`와 같은 값이다).
    const onLoaderProgress = (value: number): void => onProgress?.((i + value) / steps.length);
    scene.load.on("progress", onLoaderProgress);
    try {
      await withStepDeadline(steps[i].run(scene));
    } catch {
      // 실패한 단계도 칸은 채운다. 진행이 멈춘 것처럼 보이는 편이 더 나쁘다.
    }
    scene.load.off("progress", onLoaderProgress);
    if (!scene.scene.isActive()) return;
    onProgress?.((i + 1) / steps.length);
    onStepDone(i + 1, steps.length);
  }
}

/**
 * 이미 그려 둔 글자를 다시 굳힌다.
 *
 * Phaser Text는 그린 순간의 글꼴로 텍스처를 굳히기 때문에, 로딩 화면 자체의 제목은 글꼴이
 * 도착하기 전에 그려진다. 글꼴 단계가 끝나면 한 번 다시 그려 대체 글꼴 상태로 남지 않게 한다.
 */
export function refreshTextTextures(scene: Phaser.Scene): void {
  scene.children.each((child) => {
    const text = child as Phaser.GameObjects.Text;
    if (typeof text.updateText === "function") text.updateText();
  });
}
