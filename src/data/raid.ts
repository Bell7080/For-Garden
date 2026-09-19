import { registerDataText } from "../i18n";

/**
 * 레이드 — **경쟁이 아니라 함께 미는 보스전**이다.
 *
 * 원정의 폰토스가 "내 한 판이 몇 점인가"를 겨루는 자리라면, 레이드는 시즌 하나가 **보스 한
 * 마리의 공유 체력**을 갖고 참가자 전원의 피해가 그 한 줄을 깎는다. 그래서 화면이 먼저 말하는
 * 것은 내 순위가 아니라 **얼마나 남았나**이고, 목록은 순위표가 아니라 기여 목록이다.
 *
 * 보스는 **코마**다. 폰토스는 원정에서 이미 불사 보스로 서 있어 두 콘텐츠가 같은 얼굴을 쓰면
 * 무엇이 다른 자리인지 읽히지 않는다. 코마는 전신·SD 원화와 스킬 계약을 모두 가진 유일한
 * 다른 보스급 개체이고, 1장 마지막 관문에서 이미 "혼자 셋을 상대하는" 자리를 맡고 있다.
 */

/**
 * 시즌 보스의 성장 스냅샷.
 *
 * **스테이지와 같은 문법을 쓴다** — 태생 능력치에 손대지 않고 레벨과 야성 단계만 적는다
 * (`effectiveEnemyLevel`). 레이드 전용 배율이나 숨은 보정을 만들지 않는 이유는 관문을 조일
 * 손잡이가 둘이 되는 순간 화면에 선 `LV.n`과 실제로 맞는 수치가 갈리기 때문이다.
 *
 * 정예(`elite`)로 세우므로 야성 한 단계가 다섯 레벨만큼 얹힌다 — 실효 레벨은 40 + 6×5 = 70이다.
 */
export const RAID_SEASON_BOSS = {
  relicId: "koma",
  level: 40,
  breakthrough: 2,
  ferocityLevel: 6,
  /** 몸집만 키우고 수치는 건드리지 않는다. 원정 보스와 같은 값이다. */
  bodyScale: 1.25,
} as const;

/**
 * 서버 검증이 허용하는 전투 길이와 입력량 상한이다.
 *
 * 마지막 단계의 처형 피해는 **제한 시간을 전멸로 바꾸는 장치**이지 난이도가 아니다 — 보스는
 * 판 안에서 죽지 않고(공유 체력은 서버가 갖는다) 90초가 지나면 판이 끝나야 하는데, 재현이
 * 인정하는 종료는 전멸 하나뿐이기 때문이다. 원정 보스와 같은 방식이다.
 */
export const RAID_BOSS_BALANCE = {
  maximumDurationMs: 100_000,
  maximumActions: 2_000,
  maximumAcceptedScore: 100_000_000,
  phases: [
    { startsAtMs: 0, attackPerSecond: 0, label: "교전" },
    { startsAtMs: 30_000, attackPerSecond: 0, label: "격화" },
    { startsAtMs: 60_000, attackPerSecond: 0, label: "최후" },
    { startsAtMs: 90_000, attackPerSecond: 1_000_000_000, label: "철수" },
  ],
} as const;

/**
 * 시즌 하나가 갖는 공유 체력.
 *
 * **눈대중이 아니라 주 단위 총량에서 거꾸로 구한다.** 참가자 한 명이 하루 세 판(`DAILY_ATTEMPTS`)을
 * 돌고 한 판이 평균 2만 피해라면 하루 6만, 이레면 42만이다. 모의 참가자 스물넷이 같은 속도로
 * 밀면 주당 약 1,000만이므로, 그 언저리에 두면 **주 후반에 처치되는 무게**가 된다.
 *
 * 너무 낮으면 화요일에 끝나 남은 닷새가 빈 화면이 되고, 너무 높으면 끝내 못 잡아 처치 보상이
 * 한 번도 나가지 않는다. 실제 평균 피해가 쌓이면 이 값 하나만 다시 조정한다.
 */
export const RAID_SEASON_TOTAL_HP = 10_000_000;

/** 하루에 도전할 수 있는 횟수다. UTC 날짜 경계로 초기화한다. */
export const RAID_DAILY_ATTEMPTS = 3;

/**
 * 개인 누적 기여 보상.
 *
 * 순위가 아니라 **누적 피해**가 문턱을 넘긴다 — 협력전이라 늦게 들어온 사람도 같은 길을 걷게
 * 하려는 것이고, 등수로 끊으면 상위권이 굳은 뒤에는 밀 이유가 사라진다. 단계 ID가 서버의
 * 중복 수령 키다.
 */
export const RAID_CONTRIBUTION_REWARD_STAGES = [
  { id: "raid-contrib-50k", threshold: 50_000, reward: { itemId: "raid-sigil", amount: 20 } },
  { id: "raid-contrib-150k", threshold: 150_000, reward: { itemId: "raid-sigil", amount: 40 } },
  { id: "raid-contrib-300k", threshold: 300_000, reward: { itemId: "raid-sigil", amount: 60 } },
  { id: "raid-contrib-600k", threshold: 600_000, reward: { itemId: "raid-sigil", amount: 120 } },
] as const;

/** 시즌 보스를 실제로 눕혔을 때 참가자 전원에게 한 번 나가는 몫이다. */
export const RAID_DEFEAT_REWARD = { itemId: "raid-sigil", amount: 200 } as const;

/**
 * 모의 참가자 명단.
 *
 * 백엔드가 없어 지금은 이 표가 함께 미는 사람들을 대신한다 — **추후 길드원과 친구로 교체한다.**
 * 이름은 계정 이름이라 번역하지 않고(친구 표본과 같은 규칙), `favoriteRelicId`만 줄 왼쪽의
 * 얼굴이 된다. `pace`는 그 사람이 하루에 내는 피해의 상대 배율이라 목록이 늘 같은 순서로
 * 굳지 않는다.
 */
export const RAID_MOCK_PARTICIPANTS = [
  { id: "raider-haneul", displayName: "하늘정원", favoriteRelicId: "rex", pace: 1.32 },
  { id: "raider-moss", displayName: "이끼연구소", favoriteRelicId: "anky", pace: 0.71 },
  { id: "raider-viola", displayName: "비올라", favoriteRelicId: "spino", pace: 1.18 },
  { id: "raider-kettle", displayName: "주전자", favoriteRelicId: "luka", pace: 0.94 },
  { id: "raider-noon", displayName: "정오의표본", favoriteRelicId: "dodo", pace: 1.07 },
  { id: "raider-dust", displayName: "먼지떨이", favoriteRelicId: "tia", pace: 0.62 },
  { id: "raider-ember", displayName: "잔불", favoriteRelicId: "stella", pace: 1.24 },
  { id: "raider-quartz", displayName: "석영", favoriteRelicId: "meron", pace: 0.88 },
  { id: "raider-tidal", displayName: "밀물", favoriteRelicId: "pachi", pace: 1.02 },
  { id: "raider-orchid", displayName: "난초", favoriteRelicId: "maki", pace: 0.79 },
  { id: "raider-cinder", displayName: "재", favoriteRelicId: "keris", pace: 1.15 },
  { id: "raider-fern", displayName: "고사리", favoriteRelicId: "delopi", pace: 0.68 },
  { id: "raider-halo", displayName: "달무리", favoriteRelicId: "nodonia", pace: 1.29 },
  { id: "raider-pebble", displayName: "조약돌", favoriteRelicId: "ella", pace: 0.84 },
  { id: "raider-signal", displayName: "신호탑", favoriteRelicId: "mette", pace: 1.11 },
  { id: "raider-lantern", displayName: "등불", favoriteRelicId: "deina", pace: 0.75 },
  { id: "raider-marrow", displayName: "골수연구", favoriteRelicId: "maddy", pace: 0.97 },
  { id: "raider-willow", displayName: "버드나무", favoriteRelicId: "terisa", pace: 1.21 },
  { id: "raider-gale", displayName: "돌풍", favoriteRelicId: "parua", pace: 0.66 },
  { id: "raider-amberly", displayName: "호박빛", favoriteRelicId: "shute", pace: 1.06 },
  { id: "raider-slate", displayName: "점판암", favoriteRelicId: "dian", pace: 0.81 },
  { id: "raider-vellum", displayName: "양피지", favoriteRelicId: "rex", pace: 1.13 },
  { id: "raider-drift", displayName: "표류", favoriteRelicId: "anky", pace: 0.73 },
  { id: "raider-kiln", displayName: "가마", favoriteRelicId: "spino", pace: 1.27 },
] as const;

// 단계 이름은 화면에 서는 정적 콘텐츠라 다른 언어만 개체 ID로 덮어쓴다.
RAID_BOSS_BALANCE.phases.forEach((phase, index) => registerDataText(phase, "label", `raid.phase.${index}`));
