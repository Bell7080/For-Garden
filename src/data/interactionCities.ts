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
    // 2단계: 이터널에 파견됐던 도플갱어 연구원들이 남긴 일기. 도시 ID는 외곽 연구실 시절의
    // 것을 그대로 두어 저장(진행 중 파견·읽은 일지)이 깨지지 않는다.
    id: "doppel-lab", displayName: "도플 · 내부 연구기관", department: "exchange",
    description: "도플 연구소 안쪽의 내부 연구기관. 이터널에 파견됐던 연구원들이 남긴 일기가 이곳에 모인다.",
    unlock: {}, durationMinutes: 30, partySize: { min: 1, max: 3 },
    specialty: { elements: ["water", "grass"], roles: ["support"], squads: ["rune"] },
    rewards: [{ currency: "gold", min: 800, max: 1_800 }, { currency: "fossil", min: 0, max: 1 }, { currency: "rawStone", min: 0, max: 100 }],
    clueJournalId: "interaction-doppel-lab-01", illustration: "background-interaction-doppel-lab",
  },
  {
    // 3단계부터는 스토리 관문이 연다(§3). 렐릭의 사용처와 연구 성과, 연구 **목적**.
    id: "doppel-office", displayName: "도플 · 관리부", department: "council",
    description: "연구 성과와 렐릭의 사용처를 집계하는 도플의 관리부. 결재가 여러 단을 거쳐 오래 기다려야 한다.",
    unlock: { stageId: "1-4" }, durationMinutes: 240, partySize: { min: 1, max: 3 },
    specialty: { elements: ["water", "grass"], roles: ["support", "tank"], squads: ["rune", "eye"] },
    rewards: [{ currency: "gold", min: 2_000, max: 5_000 }, { currency: "gems", min: 0, max: 8 }, { currency: "rawStone", min: 0, max: 300 }],
    clueJournalId: "interaction-doppel-office-01", illustration: "background-expedition-ranking",
  },
  {
    // 4단계: 러스트는 무거운 이야기 사이의 숨 고르기다. 세계관보다 짧은 해프닝을 맡는다.
    id: "rust-garage", displayName: "러스트 · 정비창", department: "exchange",
    description: "러스트의 정비창. 부서진 연구 장비를 고쳐 달라는 의뢰가 쉴 새 없이 들어온다.",
    unlock: { stageId: "1-10" }, durationMinutes: 60, partySize: { min: 1, max: 3 },
    specialty: { elements: ["earth", "fire"], roles: ["warrior"], squads: ["gear"] },
    rewards: [{ currency: "fossil", min: 1, max: 2 }, { currency: "gold", min: 800, max: 2_600 }, { currency: "rawStone", min: 0, max: 200 }],
    clueJournalId: "interaction-rust-garage-01", illustration: "background-expedition-field",
  },
  {
    // 5단계: 고성능 장비의 대여 기간 연장 협상. 간간이 도플 이야기가 섞여 든다.
    id: "rust-lease", displayName: "러스트 · 대여 관리부", department: "council",
    description: "고성능 장비를 빌려 주는 러스트의 대여 관리부. 연장 한 건에도 긴 협상이 붙는다.",
    unlock: { stageId: "2-5" }, durationMinutes: 720, partySize: { min: 1, max: 3 },
    specialty: { elements: ["earth", "fire"], roles: ["tank", "warrior"], squads: ["gear"] },
    rewards: [{ currency: "gold", min: 7_000, max: 15_000 }, { currency: "amber", min: 0, max: 2 }, { currency: "rawStone", min: 0, max: 900 }],
    clueJournalId: "interaction-rust-lease-01", illustration: "background-excavation",
  },
  {
    // 6단계: 3단계가 받아 둔 연구 **목적**을 이어 받아, 그 연구로 얻으려던 것과 상층부의 암시를
    // 비춘다. 상층부의 정체·목적은 단정하지 않는다(`docs/lore.md` §1.2).
    id: "doppel-upper", displayName: "도플 · 상층부", department: "council",
    description: "도플 연구소의 가장 높은 층. 연구의 목적을 정하는 사람들이 이곳에 앉는다.",
    unlock: { stageId: "2-10" }, durationMinutes: 1440, partySize: { min: 1, max: 3 },
    specialty: { elements: ["water"], roles: ["support", "tank"], squads: ["rune", "eye"] },
    rewards: [{ currency: "fossil", min: 4, max: 9 }, { currency: "amber", min: 0, max: 1 }, { currency: "rawStone", min: 0, max: 1_800 }],
    clueJournalId: "interaction-doppel-upper-01", illustration: "background-archaeology",
  },
  {
    // 7단계: 러스트의 중심지. 이터널의 연구 장비가 설계되고 고쳐지는 본거지다. 오디디가 쓰는
    // 나노칩 기술의 출처가 이 도시라는 사실은 스치기만 한다.
    id: "rust-works", displayName: "러스트 · 중앙 공방", department: "council",
    description: "러스트의 중심에 선 거대한 공방. 연구 장비의 설계와 수리가 한곳에 모인다.",
    unlock: { stageId: "3-5" }, durationMinutes: 1440, partySize: { min: 1, max: 3 },
    specialty: { elements: ["earth", "fire"], roles: ["tank", "warrior"], squads: ["gear"] },
    rewards: [{ currency: "gold", min: 9_000, max: 20_000 }, { currency: "amber", min: 0, max: 2 }, { currency: "rawStone", min: 0, max: 1_800 }],
    clueJournalId: "interaction-rust-works-01", illustration: "background-shop",
  },
  {
    // 8단계: 오디디는 교류가 아니라 협상이다(`docs/interaction-cities.md` §5의 (b)). 오디디가
    // 먼저 "실패 개체를 더 넘겨라"고 손을 내밀고, 거절하는 자리에서 정보를 캐 온다.
    id: "odidi-embassy", displayName: "오디디 · 외교 접견실", department: "council",
    description: "꿈을 연구하는 도시 오디디가 외부 손님을 맞는 접견실. 제안은 늘 그들이 먼저 꺼낸다.",
    unlock: { stageId: "3-10" }, durationMinutes: 1440, partySize: { min: 1, max: 3 },
    specialty: { elements: ["wind", "water"], roles: ["assassin", "support"], squads: ["eye", "rogue"] },
    rewards: [{ currency: "fossil", min: 5, max: 10 }, { currency: "amber", min: 0, max: 2 }, { currency: "rawStone", min: 0, max: 1_800 }],
    clueJournalId: "interaction-odidi-embassy-01", illustration: "background-sortie-cake",
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
