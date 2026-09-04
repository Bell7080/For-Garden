import type { Wallet } from "../core/gacha";
import type { Element } from "../core/types";
import type { SquadId } from "./factions";

/** 교류 보상의 한 행이다. weight는 확률이 아니라 같은 표 안에서의 상대 가중치다. */
export interface InteractionRewardEntry { readonly currency: keyof Wallet; readonly amount: number; readonly weight: number; readonly tags?: readonly string[]; }

/**
 * 도시에서 상대하는 창구.
 *
 * **교류부는 자주, 수뇌부는 오래.** 창구가 다르면 기다리는 시간과 돌아오는 재화의 결이 다르다 —
 * 같은 도시라도 물자를 받아 오는 실무 창구와 협정을 맺고 오는 윗선은 같은 일이 아니다.
 */
export type InteractionDepartment = "exchange" | "council";

/** 창구의 이름. 화면이 제 문구를 만들지 않고 이 표만 읽는다. */
export const INTERACTION_DEPARTMENT_LABEL: Readonly<Record<InteractionDepartment, string>> = {
  exchange: "교류부",
  council: "수뇌부",
};

/** 종료 시각은 포함하지 않는 운영 정적 정의다. 실제 시각은 출발 API가 서버 시계로 확정한다. */
export interface InteractionCity {
  readonly id: string; readonly displayName: string; readonly department: InteractionDepartment; readonly description: string;
  /** 해금은 **플레이어 레벨**이 연다. 도시가 늘어나는 순서가 곧 성장 순서다. */
  readonly unlock: { readonly researchLevel: number };
  /**
   * 파견에 드는 시간(분).
   *
   * **초반에는 10분짜리가 있다.** 하루 한 번만 걷는 콘텐츠면 자주 들어올 이유가 없고, 반대로
   * 짧은 것만 있으면 하루 뒤에 돌아와 쓸어 담는 맛이 없다 — 짧은 것과 긴 것을 함께 연다.
   */
  readonly durationMinutes: number;
  readonly partySize: { readonly min: 1; readonly max: 3 };
  readonly recommended: { readonly elements: readonly Element[]; readonly squads: readonly SquadId[]; readonly tags: readonly string[] };
  readonly rewards: readonly InteractionRewardEntry[]; readonly clueJournalId: string;
  /**
   * 팝업 상단에 세우는 원화의 배경 키.
   *
   * `src/ui/backgrounds.ts`의 `BACKGROUND` 값과 같은 문자열이지만 **여기서 그 표를 import하지
   * 않는다** — 정적 정의가 Phaser를 끌어오면 순수 규칙과 테스트가 브라우저 없이 읽히지 않는다.
   * 두 곳이 어긋나지 않는지는 `tests/unit/interactionCities.test.ts`가 지킨다.
   */
  readonly illustration: string;
}

/** 화면이 시간을 제 방식으로 적지 않도록 분을 사람이 읽는 길이로 바꾼다. */
export function interactionDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}시간` : `${Math.floor(hours)}시간 ${minutes % 60}분`;
}

/**
 * 위에서 아래로 쌓이는 교류 도시 카탈로그.
 *
 * 목록의 **순서가 곧 화면의 층 순서**다. 레벨이 오를수록 아래에 층이 더 열리고, 열린 층이
 * 많아질수록 하루 뒤에 돌아와 여러 곳을 한꺼번에 걷게 된다.
 */
export const INTERACTION_CITIES: readonly InteractionCity[] = [
  {
    id: "central-garden", displayName: "중앙 정원구", department: "exchange",
    description: "복원 개체와 시민이 처음 인사를 나누는 푸른 온실 회랑. 짧게 다녀와도 손에 무언가 남는다.",
    unlock: { researchLevel: 1 }, durationMinutes: 10, partySize: { min: 1, max: 3 },
    recommended: { elements: ["water"], squads: ["rune"], tags: ["garden"] },
    rewards: [{ currency: "gold", amount: 600, weight: 6 }, { currency: "cheesecake", amount: 1, weight: 2 }],
    clueJournalId: "interaction-central-01", illustration: "background-lobby",
  },
  {
    id: "central-council", displayName: "중앙 정원구", department: "council",
    description: "온실 위층의 원탁. 시민 대표들이 복원 계획서를 검토하는 동안 오래 기다려야 한다.",
    unlock: { researchLevel: 2 }, durationMinutes: 240, partySize: { min: 1, max: 3 },
    recommended: { elements: ["water", "grass"], squads: ["rune"], tags: ["garden"] },
    rewards: [{ currency: "gold", amount: 4200, weight: 5 }, { currency: "gems", amount: 8, weight: 1 }],
    clueJournalId: "interaction-central-02", illustration: "background-relics",
  },
  {
    id: "night-ward", displayName: "나이트 시티", department: "exchange",
    description: "밤에도 구조 신호가 끊이지 않는 침수 외곽 의료 구역. 손이 모자라 오래 붙잡지 않는다.",
    unlock: { researchLevel: 3 }, durationMinutes: 30, partySize: { min: 1, max: 3 },
    recommended: { elements: ["wind"], squads: ["gear"], tags: ["night-gear"] },
    rewards: [{ currency: "gold", amount: 1500, weight: 5, tags: ["night-gear"] }, { currency: "fossil", amount: 90, weight: 2 }],
    clueJournalId: "interaction-night-01", illustration: "background-expedition-ranking",
  },
  {
    id: "night-council", displayName: "나이트 시티", department: "council",
    description: "구조 기록을 넘겨받는 야간 관제탑. 협정 한 줄에 밤이 통째로 든다.",
    unlock: { researchLevel: 5 }, durationMinutes: 480, partySize: { min: 1, max: 3 },
    recommended: { elements: ["wind", "fire"], squads: ["gear"], tags: ["night-gear"] },
    rewards: [{ currency: "gold", amount: 9000, weight: 5 }, { currency: "gems", amount: 16, weight: 1, tags: ["wind"] }],
    clueJournalId: "interaction-night-02", illustration: "background-expedition-field",
  },
  {
    id: "abyss-port", displayName: "심해 항만구", department: "exchange",
    description: "도시 끝의 인양조가 고대 화물과 잃어버린 기록을 건져 올린다.",
    unlock: { researchLevel: 6 }, durationMinutes: 60, partySize: { min: 1, max: 3 },
    recommended: { elements: ["water", "wind"], squads: ["gear"], tags: ["salvage"] },
    rewards: [{ currency: "fossil", amount: 220, weight: 5 }, { currency: "gold", amount: 2600, weight: 2 }],
    clueJournalId: "interaction-abyss-01", illustration: "background-excavation",
  },
  {
    id: "abyss-council", displayName: "심해 항만구", department: "council",
    description: "인양권을 나누는 항만 위원회. 하루를 통째로 비워 두고 다녀와야 한다.",
    unlock: { researchLevel: 9 }, durationMinutes: 1440, partySize: { min: 1, max: 3 },
    recommended: { elements: ["water"], squads: ["gear", "fang"], tags: ["salvage"] },
    rewards: [{ currency: "fossil", amount: 900, weight: 5 }, { currency: "amber", amount: 2, weight: 1 }],
    clueJournalId: "interaction-abyss-02", illustration: "background-archaeology",
  },
  {
    id: "ember-market", displayName: "잿불 시장구", department: "exchange",
    description: "무너진 화력 발전소 아래 선 노천 시장. 재고가 도는 동안만 문이 열린다.",
    unlock: { researchLevel: 12 }, durationMinutes: 120, partySize: { min: 1, max: 3 },
    recommended: { elements: ["fire"], squads: ["fang"], tags: ["market"] },
    rewards: [{ currency: "gold", amount: 5200, weight: 6 }, { currency: "cheesecake", amount: 6, weight: 2 }],
    clueJournalId: "interaction-ember-01", illustration: "background-shop",
  },
  {
    id: "ember-council", displayName: "잿불 시장구", department: "council",
    description: "상단주들이 모이는 잿불 회합. 값을 정하는 자리라 밤을 넘긴다.",
    unlock: { researchLevel: 15 }, durationMinutes: 720, partySize: { min: 1, max: 3 },
    recommended: { elements: ["fire", "earth"], squads: ["fang"], tags: ["market"] },
    rewards: [{ currency: "gold", amount: 14_000, weight: 5 }, { currency: "amber", amount: 3, weight: 1 }],
    clueJournalId: "interaction-ember-02", illustration: "background-sortie-cake",
  },
] as const;

/** 외부 입력은 언제나 이 조회를 거쳐 알려진 도시만 사용한다. */
export function findInteractionCity(id: string): InteractionCity | undefined { return INTERACTION_CITIES.find(city => city.id === id); }
