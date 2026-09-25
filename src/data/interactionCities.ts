import type { Wallet } from "../core/gacha";
import { registerDataText } from "../i18n";
import type { Element, Role } from "../core/types";
import type { SquadId } from "./factions";

/**
 * 교류 보상의 한 줄 — **셋이 특화 없이 갔을 때** 돌아오는 범위다.
 *
 * 한 번의 수확이 줄 하나를 뽑던 때는 무엇이 올지가 운이라, 편성을 잘 짜도 돌아오는 것이 달라지지
 * 않았다. 지금은 **모든 줄이 함께** 오고 편성이 그 양을 움직인다(`interactionYieldFactor`).
 * `min`이 0인 줄은 안 올 수도 있는 귀한 것이다.
 */
export interface InteractionRewardRange { readonly currency: keyof Wallet; readonly min: number; readonly max: number; }

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
  /**
   * 해금은 **스토리 진행이 연다**(`docs/interaction-cities.md` §3).
   *
   * 플레이어 레벨로 열던 때는 레벨이 스토리를 앞질러, 아직 만나지도 않은 도시의 창구가 먼저
   * 열렸다. 지금은 그 도시를 알게 되는 관문을 지나야 열린다.
   *
   * **비워 두면 처음부터 열려 있다.** 교류에 처음 들어온 손이 빈 목록을 보지 않도록 앞의 세
   * 곳은 조건을 두지 않는다 — 눌러 볼 것이 하나도 없는 화면은 콘텐츠가 없는 것으로 읽힌다.
   */
  readonly unlock: { readonly stageId?: string };
  /**
   * 파견에 드는 시간(분).
   *
   * **초반에는 10분짜리가 있다.** 하루 한 번만 걷는 콘텐츠면 자주 들어올 이유가 없고, 반대로
   * 짧은 것만 있으면 하루 뒤에 돌아와 쓸어 담는 맛이 없다 — 짧은 것과 긴 것을 함께 연다.
   */
  readonly durationMinutes: number;
  readonly partySize: { readonly min: 1; readonly max: 3 };
  /**
   * 그 도시의 특화 — 속성·직군·스쿼드. 한 명이 여기 맞는 칸마다 수확이 늘어난다
   * (`interactionYieldFactor`). 자동 배치도 맞는 칸이 많은 이부터 세운다.
   */
  readonly specialty: { readonly elements: readonly Element[]; readonly roles: readonly Role[]; readonly squads: readonly SquadId[] };
  /**
   * 뽑기표. 한 번의 수확이 이 중 한 줄만 뽑는다.
   *
   * **고고학의 원석이 가끔 섞인다.** 교류 전용 표본을 따로 만들어 교환소에서 재화로 바꾸게
   * 하던 때는, 그 표본을 주는 곳이 게임 안에 한 군데도 없어 교환소가 늘 빈 줄 하나로 서 있었다 —
   * 파밍 재화를 하나 더 만드는 대신 이미 쓰임이 뚜렷한 원석(룬 특성 재해석)을 낮은 가중치로 섞는다.
   *
   * 수량은 눈대중이 아니라 **그 도시의 골드 줄과 같은 값**이다. 시세표(`TRADE_GEM_RATE`)로
   * 환산하면 짧은 창구(`exchange`)가 분당 0.1젬, 긴 창구(`council`)가 분당 0.037젬이라,
   * 원석 40개/젬을 곱해 분당 4개·1.5개로 잡고 파견 시간을 곱했다. 시간을 고치면 이 값도 함께 다시 잡는다.
   */
  readonly rewards: readonly InteractionRewardRange[]; readonly clueJournalId: string;
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
    // 사다리의 첫 칸이다(`docs/interaction-cities.md` §2). **도플이 먼저인 이유**는 주인공과
    // 가장 가까운 도시이기 때문이다 — 이터널의 전임 연구원 전원이 도플의 복제체였고, 주인공은
    // 그들의 빈자리에 앉은 사람이다. 응접실은 그 사실을 아직 말하지 않고 "전임자들"이라는 실만
    // 흘린다.
    id: "doppel-parlor", displayName: "도플 · 중앙 연구소 응접실", department: "exchange",
    description: "도플의 중앙 연구소 한쪽에 딸린 응접실. 손님을 앉혀 두고 연구 일지를 한 장씩 내어 준다.",
    unlock: {}, durationMinutes: 10, partySize: { min: 1, max: 3 },
    specialty: { elements: ["water"], roles: ["support"], squads: ["rune"] },
    rewards: [{ currency: "gold", min: 300, max: 800 }, { currency: "cheesecake", min: 0, max: 2 }, { currency: "rawStone", min: 0, max: 30 }],
    clueJournalId: "interaction-doppel-01", illustration: "background-interaction-doppel-parlor",
  },
  {
    // 첫 창구(응접실)보다 **안쪽으로 한 걸음** 들어간 자리다. 응접실이 손님을 앉혀 두고 일지를
    // 내어 주는 곳이라면, 여기는 그 일지를 실제로 쓰는 자리라 결재가 한 단계 더 걸린다.
    id: "doppel-lab", displayName: "도플 · 중앙 연구소 외곽 연구실", department: "council",
    description: "중앙 연구소 안쪽의 외곽 연구실. 복원 계획서에 결재가 한 번 더 필요해 오래 기다려야 한다.",
    unlock: {}, durationMinutes: 240, partySize: { min: 1, max: 3 },
    specialty: { elements: ["water", "grass"], roles: ["support"], squads: ["rune"] },
    rewards: [{ currency: "gold", min: 2_000, max: 5_000 }, { currency: "gems", min: 0, max: 8 }, { currency: "rawStone", min: 0, max: 300 }],
    clueJournalId: "interaction-doppel-lab-01", illustration: "background-interaction-doppel-lab",
  },
  {
    id: "night-ward", displayName: "나이트 시티", department: "exchange",
    description: "밤에도 구조 신호가 끊이지 않는 침수 외곽 의료 구역. 손이 모자라 오래 붙잡지 않는다.",
    unlock: {}, durationMinutes: 30, partySize: { min: 1, max: 3 },
    specialty: { elements: ["wind"], roles: ["assassin"], squads: ["gear"] },
    rewards: [{ currency: "gold", min: 800, max: 1_800 }, { currency: "fossil", min: 0, max: 1 }, { currency: "rawStone", min: 0, max: 100 }],
    clueJournalId: "interaction-night-01", illustration: "background-expedition-ranking",
  },
  {
    id: "night-council", displayName: "나이트 시티", department: "council",
    description: "구조 기록을 넘겨받는 야간 관제탑. 협정 한 줄에 밤이 통째로 든다.",
    unlock: { stageId: "1-4" }, durationMinutes: 480, partySize: { min: 1, max: 3 },
    specialty: { elements: ["wind", "fire"], roles: ["tank"], squads: ["gear"] },
    rewards: [{ currency: "gold", min: 4_500, max: 10_000 }, { currency: "gems", min: 0, max: 16 }, { currency: "rawStone", min: 0, max: 600 }],
    clueJournalId: "interaction-night-02", illustration: "background-expedition-field",
  },
  {
    id: "abyss-port", displayName: "심해 항만구", department: "exchange",
    description: "도시 끝의 인양조가 고대 화물과 잃어버린 기록을 건져 올린다.",
    unlock: { stageId: "1-7" }, durationMinutes: 60, partySize: { min: 1, max: 3 },
    specialty: { elements: ["water", "wind"], roles: ["warrior"], squads: ["gear"] },
    rewards: [{ currency: "fossil", min: 1, max: 2 }, { currency: "gold", min: 800, max: 2_600 }, { currency: "rawStone", min: 0, max: 200 }],
    clueJournalId: "interaction-abyss-01", illustration: "background-excavation",
  },
  {
    id: "abyss-council", displayName: "심해 항만구", department: "council",
    description: "인양권을 나누는 항만 위원회. 하루를 통째로 비워 두고 다녀와야 한다.",
    unlock: { stageId: "1-10" }, durationMinutes: 1440, partySize: { min: 1, max: 3 },
    specialty: { elements: ["water"], roles: ["tank"], squads: ["gear", "fang"] },
    rewards: [{ currency: "fossil", min: 4, max: 9 }, { currency: "amber", min: 0, max: 1 }, { currency: "rawStone", min: 0, max: 1_800 }],
    clueJournalId: "interaction-abyss-02", illustration: "background-archaeology",
  },
  {
    id: "ember-market", displayName: "잿불 시장구", department: "exchange",
    description: "무너진 화력 발전소 아래 선 노천 시장. 재고가 도는 동안만 문이 열린다.",
    unlock: { stageId: "2-5" }, durationMinutes: 120, partySize: { min: 1, max: 3 },
    specialty: { elements: ["fire"], roles: ["assassin"], squads: ["fang"] },
    rewards: [{ currency: "gold", min: 2_600, max: 6_000 }, { currency: "cheesecake", min: 2, max: 6 }, { currency: "rawStone", min: 0, max: 400 }],
    clueJournalId: "interaction-ember-01", illustration: "background-shop",
  },
  {
    id: "ember-council", displayName: "잿불 시장구", department: "council",
    description: "상단주들이 모이는 잿불 회합. 값을 정하는 자리라 밤을 넘긴다.",
    unlock: { stageId: "2-10" }, durationMinutes: 720, partySize: { min: 1, max: 3 },
    specialty: { elements: ["fire", "earth"], roles: ["warrior"], squads: ["fang"] },
    rewards: [{ currency: "gold", min: 7_000, max: 15_000 }, { currency: "amber", min: 0, max: 2 }, { currency: "rawStone", min: 0, max: 900 }],
    clueJournalId: "interaction-ember-02", illustration: "background-sortie-cake",
  },
] as const;

/** 외부 입력은 언제나 이 조회를 거쳐 알려진 도시만 사용한다. */
export function findInteractionCity(id: string): InteractionCity | undefined { return INTERACTION_CITIES.find(city => city.id === id); }

/** 교류 도시의 이름과 설명을 언어별로 덮어쓸 수 있게 등록한다. */
for (const city of INTERACTION_CITIES) {
  registerDataText(city, "name", `city.${city.id}.name`);
  registerDataText(city, "description", `city.${city.id}.description`);
}
for (const [department, label] of Object.entries(INTERACTION_DEPARTMENT_LABEL)) {
  void label;
  registerDataText(INTERACTION_DEPARTMENT_LABEL as unknown as Record<string, unknown>, department, `city.department.${department}`);
}

/** 도시의 표시 이름은 창구마다 따로 서므로 도시 ID로 등록한다. */
for (const city of INTERACTION_CITIES) registerDataText(city, "displayName", `city.${city.id}.displayName`);
