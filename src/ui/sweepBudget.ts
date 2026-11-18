import { powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";

/**
 * 매 프레임 다시 그리는 홀로그램 결(훑는 빛·일렁임)의 갱신 문.
 *
 * 절전(`hologramSweepFactor` 0.5)이면 두 프레임에 한 번, 움직임 줄이기(0.25)면 네 프레임에 한 번만
 * 그린다. 그림은 시각에서 값을 구하므로 건너뛴 프레임이 있어도 속도는 그대로다 — 줄어드는 것은
 * 다시 그리는 횟수(배터리)뿐이다. 문 하나가 제 몫의 누적을 따로 들어 결끼리 박자를 나누지 않는다.
 */
export function createSweepBudget(): () => boolean {
  let credit = 0;
  return () => {
    credit += powerSavingPolicy(session.settings).hologramSweepFactor;
    if (credit < 1) return false;
    credit -= 1;
    return true;
  };
}
