import type { MailRewardDto } from "../api/contracts";
import type { AttendanceTrackId } from "../core/attendance";

/**
 * 출석 보상표 — 줄마다 일곱 칸, **칸마다 받는 것 하나**.
 *
 * 한 칸에 서너 개를 늘어놓으면 칸이 작아지고 무엇이 그날의 몫인지 읽히지 않는다. 칸 하나에 그림 하나가 크게 서야
 * 「오늘은 이것」이 한눈에 들어온다. **신규**는 매일 들어오고 싶게 파격적으로 준다 — 젬·화석·골드로 바로 키우고
 * 일곱째 날에 호박석을 크게 얹는다. **정규**는 매일 받는 맛이 나되 정돈된 몫이고, 일곱째 칸(화석)이 그 바퀴의
 * 마무리다. 수량은 깔끔한 단위로만 끊는다(유료 상품과 같은 단위 규칙 — `paidAmountUnit.ts`).
 */
export const ATTENDANCE_REWARDS: Readonly<Record<AttendanceTrackId, readonly MailRewardDto[]>> = {
  newcomer: [
    { kind: "currency", currency: "gems", amount: 1_000 },
    { kind: "currency", currency: "fossil", amount: 3 },
    { kind: "currency", currency: "gold", amount: 100_000 },
    { kind: "currency", currency: "gems", amount: 1_500 },
    { kind: "currency", currency: "fossil", amount: 5 },
    { kind: "item", itemId: "raid-ticket", amount: 2 },
    { kind: "currency", currency: "amber", amount: 10 },
  ],
  regular: [
    { kind: "currency", currency: "gold", amount: 20_000 },
    { kind: "currency", currency: "cheesecake", amount: 100 },
    { kind: "currency", currency: "gems", amount: 100 },
    { kind: "item", itemId: "stamina-tonic", amount: 1 },
    { kind: "item", itemId: "strata-ticket", amount: 1 },
    { kind: "currency", currency: "gems", amount: 150 },
    { kind: "currency", currency: "fossil", amount: 1 },
  ],
};

/**
 * 정규 출석의 **광고 덤** — 그날 칸을 받은 뒤 광고를 한 번 보면 그 칸 아래의 몫을 더 받는다. 본 칸보다 가볍게,
 * 매일 받는 재화의 반쯤으로 둔다(덤이 본 몫보다 크면 광고를 보지 않는 사람이 손해 보는 출석이 된다).
 */
export const ATTENDANCE_AD_REWARDS: readonly MailRewardDto[] = [
  { kind: "currency", currency: "gold", amount: 10_000 },
  { kind: "currency", currency: "cheesecake", amount: 50 },
  { kind: "currency", currency: "gems", amount: 50 },
  { kind: "currency", currency: "gold", amount: 10_000 },
  { kind: "currency", currency: "cheesecake", amount: 50 },
  { kind: "currency", currency: "gems", amount: 50 },
  { kind: "currency", currency: "gems", amount: 100 },
];

/** 광고 덤을 보는 광고 자리. 검증 토큰이 이 자리의 것이어야 서버가 받는다. */
export const ATTENDANCE_AD_SLOT_ID = "attendance-ad";
