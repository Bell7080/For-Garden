/**
 * 연구 시네마틱이 받는 카드 한 벌.
 *
 * 화면(`ResearchCinematic`)과 3D 에셋(`public/cinematic/researchCinematic.js`) 사이의 계약이며,
 * Phaser도 DOM도 읽지 않는 순수 규칙이라 테스트가 같은 값을 읽는다. 카드에 서는 글자는 전부
 * 바깥에서 주입한다 — 여기서 문장을 짓지 않아야 언어가 늘어도 이 표가 그대로 남는다.
 */

import type { ResearchSlotView } from "../core/researchPresentation";
import type { ResearchGrade } from "../core/gacha";
import type { PortraitAssetId } from "../core/types";

/** 에셋이 검증하는 카드 한 장. `quantity`는 회색 카드에만 있고 1 이상의 정수여야 한다. */
export interface CinematicReward {
  id: string;
  name: string;
  /** 이름 위에 서는 라틴 한 줄. 렐릭은 복원 프로젝트 코드네임이다. */
  title: string;
  rarity: ResearchGrade;
  /** 에셋 계약이 문자열을 요구한다. 지금 화면에는 서지 않으므로 비워 둔다. */
  description: string;
  quantity?: number;
}

/** 칸 하나를 카드로 옮길 때 바깥에서 받아야 하는 글자들. */
export interface CinematicRewardText {
  /** 렐릭의 표시 이름과 코드네임. */
  relic: (relicId: string) => { name: string; project: string };
  /** `{name} 파편`처럼 그 개체의 파편임을 말하는 한 줄. */
  fragment: (relicName: string) => string;
  /** 재화·DNA 조각의 표시 이름. */
  currency: (kind: "gold" | "cheesecake" | "dnaFragments") => string;
  /** 회색 카드의 라틴 한 줄. 재화라는 것만 말한다. */
  resourceTitle: string;
}

/**
 * 결과판 계약을 시네마틱 카드로 옮긴다.
 *
 * 등급은 칸이 이미 정한 것을 그대로 쓴다 — 여기서 다시 추첨하거나 렐릭 정의를 읽지 않는다.
 * 중복 파편은 그 개체의 등급을 지킨다: SSR 중복은 SSR 연출로 서야 "무엇이 나왔나"가 맞다.
 */
export function cinematicRewards(
  views: readonly ResearchSlotView[],
  text: CinematicRewardText,
): CinematicReward[] {
  return views.map((view, index) => {
    if (view.kind === "relic") {
      const relic = text.relic(view.relicId);
      return { id: `${index}-${view.relicId}`, name: relic.name, title: relic.project, rarity: view.grade, description: "" };
    }
    if (view.kind === "fragment") {
      const relic = text.relic(view.relicId);
      return {
        id: `${index}-${view.relicId}-fragment`,
        name: text.fragment(relic.name),
        title: relic.project,
        rarity: view.grade,
        description: "",
      };
    }
    const kind = view.kind === "dna" ? "dnaFragments" : view.currency;
    return {
      id: `${index}-${kind}`,
      name: text.currency(kind),
      title: text.resourceTitle,
      rarity: "GRAY",
      description: "",
      // 회색 카드만 수량을 든다. 에셋이 1 이상의 정수를 요구하므로 바닥을 1로 올린다.
      quantity: Math.max(1, Math.floor(view.amount)),
    };
  });
}

/**
 * 에셋이 받아들이는 장수인지 본다.
 *
 * 계약은 1장 또는 10장뿐이다. 배너가 다른 장수를 열면 시네마틱을 열지 않고 기존 Phaser
 * 연출로 되돌아가야 한다 — 검증에서 던지게 두면 뽑기 자체가 실패한 것처럼 보인다.
 */
export function isCinematicCount(count: number): boolean {
  return count === 1 || count === 10;
}


/**
 * 카드 하나가 무엇을 보여 주는가.
 *
 * 결과판(`ResearchSlotTile`)이 칸에 세우는 것과 **같은 규칙**이다 — 새로 만난 렐릭만 실제
 * 원화가 카드를 채우고, 중복 파편과 재화는 액자 한 장에 수량이 겹친다. 그림을 굽는 일은
 * 화면이 하고, 여기서는 "어느 그림을 어느 액자에" 까지만 정한다.
 */
export type CinematicCardArt =
  | { frame: "portrait"; portraitAssetId: PortraitAssetId }
  | { frame: "face"; portraitAssetId: PortraitAssetId; amount: string }
  | { frame: "icon"; iconKey: string; amount: string };

/** 칸을 카드 그림 계약으로 옮길 때 바깥에서 받아야 하는 것들. */
export interface CinematicCardArtSource {
  /** 렐릭 id로 그 개체의 전신 원화 id를 찾는다. */
  portrait: (relicId: string) => PortraitAssetId;
  /** 재화·DNA 조각의 아이콘 텍스처 키. */
  icon: (kind: "gold" | "cheesecake" | "dnaFragments") => string;
  /** 수량 표기. 화면과 같은 축약 규칙(`formatCurrency`)을 그대로 넘긴다. */
  amount: (value: number) => string;
}

/** 칸 목록을 카드 그림 목록으로 옮긴다. 순서는 카드 순서 그대로다. */
export function cinematicCardArt(
  views: readonly ResearchSlotView[],
  source: CinematicCardArtSource,
): CinematicCardArt[] {
  return views.map((view) => {
    if (view.kind === "relic") {
      return { frame: "portrait", portraitAssetId: source.portrait(view.relicId) } as const;
    }
    if (view.kind === "fragment") {
      // 중복은 그 개체의 얼굴을 꽉 채운 액자다 — 결과판과 같은 그림, 같은 수량 자리.
      return { frame: "face", portraitAssetId: source.portrait(view.relicId), amount: source.amount(view.amount) } as const;
    }
    const kind = view.kind === "dna" ? "dnaFragments" : view.currency;
    return { frame: "icon", iconKey: source.icon(kind), amount: source.amount(view.amount) } as const;
  });
}
