import type Phaser from "phaser";
import { preloadPuppetAssets, PUPPET_PRELOAD_GROUPS } from "../puppets/assets";
import { BACKGROUND_ASSETS } from "../ui/backgrounds";
import { loadGameFonts } from "../ui/fonts";
import { UI_ICON_ASSETS } from "../ui/icons";
import { AFFINITY_ICON_ASSETS } from "../ui/affinityIcons";
import { CURRENCY_ICON_ASSETS } from "../ui/currencyIcons";
import { SKILL_ICON_ASSETS } from "../ui/skillIcons";

/**
 * 타이틀 화면이 지불하는 로딩 비용의 전부.
 *
 * 부트는 저장 데이터만 보고 곧바로 타이틀을 띄운다. 무거운 원화·아이콘·Puppet 묶음은 여기서
 * 읽어, 기다리는 동안 사용자가 검은 화면 대신 제목과 진행 칸을 본다. 로딩할 것이 늘면 씬에
 * 직접 `load`를 부르지 말고 이 목록에 단계를 더한다 — 진행 칸 수가 목록 길이라서 저절로 맞는다.
 */
export interface LoadingStep {
  /** 디버깅과 테스트에서 단계를 가리키는 이름. 화면에는 띄우지 않는다. */
  readonly label: string;
  run(scene: Phaser.Scene): Promise<void>;
}

/** Phaser 로더는 콜백식이라 단계 하나를 기다릴 수 있게 감싼다. */
function loadWithPhaser(scene: Phaser.Scene, queue: () => void): Promise<void> {
  return new Promise((resolve) => {
    queue();
    if (scene.load.list.size === 0) {
      resolve();
      return;
    }
    // 파일 하나가 실패해도 complete는 온다. 여기서 멈추지 않고 다음 단계로 넘어간다.
    scene.load.once("complete", () => resolve());
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

export const LOADING_STEPS: ReadonlyArray<LoadingStep> = [
  {
    label: "글꼴",
    run: () => loadGameFonts(),
  },
  {
    label: "배경 원화",
    run: (scene) =>
      loadWithPhaser(scene, () => BACKGROUND_ASSETS.forEach(([key, path]) => scene.load.image(key, path))),
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
        CURRENCY_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        UI_ICON_ASSETS.forEach(([key, path, size]) => scene.load.svg(key, path, { width: size * SVG_BAKE.uiScale, height: size * SVG_BAKE.uiScale }));
      }),
  },
  {
    label: "렐릭 스탠딩",
    run: () => preloadPuppetAssets(PUPPET_PRELOAD_GROUPS[0]),
  },
  {
    label: "SD·적 묶음",
    run: () => preloadPuppetAssets(PUPPET_PRELOAD_GROUPS[1]),
  },
];

/**
 * 단계를 순서대로 밟으며 끝난 개수를 알린다.
 *
 * 한 단계가 실패해도 다음으로 넘어간다 — 아트 파일 하나가 UI와 전투 규칙까지 막지 않는다.
 * 병렬로 몰아 받지 않는 이유는 진행 칸이 실제로 하나씩 차야 기다림이 읽히기 때문이다.
 */
export async function runLoadingSteps(
  scene: Phaser.Scene,
  onStepDone: (done: number, total: number) => void,
  steps: ReadonlyArray<LoadingStep> = LOADING_STEPS,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    try {
      await steps[i].run(scene);
    } catch {
      // 실패한 단계도 칸은 채운다. 진행이 멈춘 것처럼 보이는 편이 더 나쁘다.
    }
    if (!scene.scene.isActive()) return;
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
