import type { MailRewardDto } from "../api/contracts";
import type { AttendanceTrackId } from "../core/attendance";

/**
 * 출석 보상표 — 줄마다 일곱 칸, 칸마다 받는 것.
 *
 * **신규**는 매일 들어오고 싶게 파격적으로 준다 — 첫날 젬·드링크·골드로 바로 키우고, 둘째·셋째 날에 연구 재화와
 * 토벌권, 일곱째 날에 호박석과 젬을 크게 얹는다. **정규**는 매일 받는 맛이 나되 정돈된 몫이고, 일곱째 칸(화석)이
 * 그 바퀴의 마무리다. 수량은 깔끔한 단위로만 끊는다(유료 상품과 같은 단위 규칙).
 */
export const ATTENDANCE_REWARDS: Readonly<Record<AttendanceTrackId, readonly (readonly MailRewardDto[])[]>> = {
  newcomer: [
    [{ kind: "currency", currency: "gems", amount: 600 }, { kind: "item", itemId: "stamina-tonic", amount: 3 }, { kind: "currency", currency: "gold", amount: 50_000 }],
    [{ kind: "currency", currency: "amber", amount: 2 }, { kind: "currency", currency: "cheesecake", amount: 300 }],
    [{ kind: "currency", currency: "fossil", amount: 3 }, { kind: "item", itemId: "raid-ticket", amount: 2 }],
    [{ kind: "currency", currency: "gems", amount: 800 }, { kind: "item", itemId: "strata-ticket", amount: 3 }],
    [{ kind: "currency", currency: "amber", amount: 3 }, { kind: "currency", currency: "gold", amount: 100_000 }],
    [{ kind: "currency", currency: "fossil", amount: 4 }, { kind: "item", itemId: "raid-select-ticket", amount: 1 }],
    [{ kind: "currency", currency: "amber", amount: 5 }, { kind: "currency", currency: "gems", amount: 1_000 }],
  ],
  regular: [
    [{ kind: "currency", currency: "gold", amount: 20_000 }],
    [{ kind: "currency", currency: "cheesecake", amount: 100 }],
    [{ kind: "currency", currency: "gems", amount: 100 }],
    [{ kind: "item", itemId: "stamina-tonic", amount: 1 }, { kind: "currency", currency: "gold", amount: 20_000 }],
    [{ kind: "item", itemId: "strata-ticket", amount: 1 }],
    [{ kind: "currency", currency: "gems", amount: 150 }],
    [{ kind: "currency", currency: "fossil", amount: 1 }],
  ],
};
