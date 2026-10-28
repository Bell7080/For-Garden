import { QA_TOOLS_ENABLED } from "../core/buildFlavor";

/**
 * QA 길드 시계 이동량 한 칸. 길드 화면과 수호전 서버 경계가 **같은 값**을 읽어야 오늘의 속성이 둘에서 갈리지 않는다 —
 * 시험 도구(`guildQa.ts`)는 세션·길드 저장소를 끌고 오므로 서버 경계는 이 작은 모듈만 읽는다. 일반 빌드에서는 늘 0이다.
 */
const DAY_MS = 86_400_000;
let dayShift = 0;

export const guildQaClockShift = (): number => (QA_TOOLS_ENABLED ? dayShift * DAY_MS : 0);
export const setGuildQaDayShift = (days: number): void => { dayShift = QA_TOOLS_ENABLED ? days : 0; };
