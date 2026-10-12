import type { MailRewardDto } from "../api/contracts";
import type { AttendanceTrackId } from "../core/attendance";

/**
 * 출석 보상표 — 줄마다 일곱 칸, **칸마다 받는 것 하나**.
 *
 * 한 칸에 서너 개를 늘어놓으면 칸이 작아지고 무엇이 그날의 몫인지 읽히지 않는다. 칸 하나에 그림 하나가 크게 서야
 * 「오늘은 이것」이 한눈에 들어온다. 두 줄 모두 **젬·화석·호박석이 뼈대**다 — 골드·치즈케이크는 매일 다른 곳에서도
 * 넉넉히 들어와 출석을 기다리게 만들지 못한다. 토벌권은 출석에서 주지 않는다(던전·고고학 드랍이 공급처다).
 *
 * 값은 연구 한 번(화석·호박석 = 젬 300)으로 잰다. 에너지 드링크는 젬 50, 발굴권은 판의 운에 따라 갈리므로
 * **저점 젬 100(골드·룬 몇 칸) ~ 고점 젬 600(화석 두 칸)**으로 보고 몇 장만 섞는다 — 고점만 보고 몰아주면 한 칸이
 * 표보다 크게 튈 수 있다. 에너지 드링크는 7일 기한이라 받은 주에 쓰도록 묶음으로 준다.
 *
 * - **신규**(약 젬 12,000~13,500): 첫 주에 곧바로 연구를 여러 번 돌릴 수 있게 하고, 일곱째 날 젬 5,000으로 마무리한다.
 * - **정규**(한 바퀴 약 젬 3,500~4,500): 매일 받는 맛이 나되 일곱째 칸 화석 5개가 그 바퀴의 목표다.
 *
 * 수량은 깔끔한 단위로만 끊는다(유료 상품과 같은 단위 규칙 — `paidAmountUnit.ts`).
 */
export const ATTENDANCE_REWARDS: Readonly<Record<AttendanceTrackId, readonly MailRewardDto[]>> = {
  newcomer: [
    { kind: "currency", currency: "gems", amount: 1_500 },
    { kind: "currency", currency: "fossil", amount: 5 },
    { kind: "item", itemId: "stamina-tonic", amount: 6, expiresInDays: 7 },
    { kind: "currency", currency: "gems", amount: 2_000 },
    { kind: "currency", currency: "amber", amount: 5 },
    { kind: "item", itemId: "strata-ticket", amount: 3 },
    { kind: "currency", currency: "gems", amount: 5_000 },
  ],
  regular: [
    { kind: "currency", currency: "gems", amount: 300 },
    { kind: "currency", currency: "fossil", amount: 1 },
    { kind: "item", itemId: "stamina-tonic", amount: 3, expiresInDays: 7 },
    { kind: "currency", currency: "gems", amount: 500 },
    { kind: "currency", currency: "amber", amount: 1 },
    { kind: "item", itemId: "strata-ticket", amount: 2 },
    { kind: "currency", currency: "fossil", amount: 5 },
  ],
};

/**
 * 정규 출석의 **광고 덤** — 그날 칸을 받은 뒤 광고를 한 번 보면 그 칸 아래의 몫을 더 받는다. 본 칸보다 가볍게
 * 두되(덤이 본 몫보다 크면 광고를 보지 않는 사람이 손해 보는 출석이 된다) 일곱째 칸에는 화석 하나를 얹어
 * 바퀴의 마무리를 함께 키운다.
 */
export const ATTENDANCE_AD_REWARDS: readonly MailRewardDto[] = [
  { kind: "currency", currency: "gold", amount: 30_000 },
  { kind: "currency", currency: "gems", amount: 100 },
  { kind: "currency", currency: "cheesecake", amount: 200 },
  { kind: "currency", currency: "gems", amount: 150 },
  { kind: "item", itemId: "stamina-tonic", amount: 1, expiresInDays: 7 },
  { kind: "currency", currency: "gems", amount: 200 },
  { kind: "currency", currency: "fossil", amount: 1 },
];

/** 광고 덤을 보는 광고 자리. 검증 토큰이 이 자리의 것이어야 서버가 받는다. */
export const ATTENDANCE_AD_SLOT_ID = "attendance-ad";
