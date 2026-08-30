import type Phaser from "phaser";
import { preloadPuppetAssets, PUPPET_PRELOAD_GROUPS } from "../puppets/assets";
import { BACKGROUND_ASSETS } from "../ui/backgrounds";
import { loadGameFonts } from "../ui/fonts";
import { UI_ICON_ASSETS } from "../ui/icons";
import { AFFINITY_ICON_ASSETS } from "../ui/affinityIcons";
import { CURRENCY_ICON_ASSETS } from "../ui/currencyIcons";
import { RUNE_ICON_ASSETS } from "../ui/runeIcons";
import { SKILL_ICON_ASSETS } from "../ui/skillIcons";
import { SKILL_ART_ASSETS } from "../ui/skillArt";
import { EXCAVATION_TRAIT_ICON_ASSETS } from "../ui/excavationIcons";
import { ITEM_ICON_ASSETS } from "../ui/itemIcons";

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

/** 배경이 아닌 콘텐츠 원화의 중앙 로딩 표. 진입 액자와 관찰 일지가 이 표만 사용한다. */
const CONTENT_ART_ASSETS = [
  // Content1_001은 출격 선택판의 스토리 입구 안에서만 보이는 작전 일러스트다.
  ["content-story-entry", "sprites/content/Content1_001.webp"],
  // Content2_001은 로비 출격 메뉴에서 원정 진입점을 구별하는 버튼 일러스트다.
  ["content-expedition-entry", "sprites/content/Content2_001.webp"],
  // Content3_001·Content4_001은 같은 출격 선택판의 두 일일 던전을 구별하는 버튼 일러스트다.
  ["content-cake-entry", "sprites/content/Content3_001.webp"],
  ["content-bounty-entry", "sprites/content/Content4_001.webp"],
  // journal_001은 관찰 일지 판 안에서 원본 크기를 유지한 채 잘라 쓰는 종이 질감 원화다.
  ["content-observation-journal", "sprites/content/journal_001.webp"],
] as const;

export const LOADING_STEPS: ReadonlyArray<LoadingStep> = [
  {
    label: "글꼴",
    run: () => loadGameFonts(),
  },
  {
    label: "배경 원화",
    run: (scene) =>
      loadWithPhaser(scene, () => {
        // 지도(Content2_001map)와 전투 필드(Content2_001field)는 backgrounds.ts의 화면 배경 표가 소유한다.
        BACKGROUND_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 진입 버튼(Content2_001)은 화면 배경이 아니므로 이 중앙 콘텐츠 표에서 함께 적재한다.
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
        // 전용 스킬 일러스트는 흰 실루엣 WebP다. 색은 화면이 tint로 입힌다.
        SKILL_ART_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 속성·직군은 이미 구워 둔 WebP라 그대로 읽는다.
        AFFINITY_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        CURRENCY_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        RUNE_ICON_ASSETS.forEach(([key, path]) => scene.load.image(key, path));
        // 임시 item SVG도 개별 가방 씬이 아니라 공용 단계에서 크게 구운 뒤 축소해 사용한다.
        ITEM_ICON_ASSETS.forEach(([key, path]) => scene.load.svg(key, path, { width: SVG_BAKE.skill, height: SVG_BAKE.skill }));
        UI_ICON_ASSETS.forEach(([key, path, size]) => scene.load.svg(key, path, { width: size * SVG_BAKE.uiScale, height: size * SVG_BAKE.uiScale }));
        // 발굴 특화는 카드 보조 정보 크기의 단색 SVG라 UI 아이콘과 같은 배율로 미리 굽는다.
        EXCAVATION_TRAIT_ICON_ASSETS.forEach(([key, path]) => scene.load.svg(key, path, { width: 64, height: 64 }));
      }),
  },
  {
    label: "렐릭 스탠딩",
    run: () => preloadPuppetAssets(PUPPET_PRELOAD_GROUPS[0]),
  },
  {
    // 궁극기 컷인은 portraitAssetFor가 가리키는 같은 캐시를 재사용한다. 단계로 등록해 두면
    // 첫 발동 도중 ZIP 파싱이 일어나 연출이 끊기는 일이 없다.
    label: "궁극기 컷인 원화",
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
