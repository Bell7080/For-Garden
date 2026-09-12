import { registerDataText } from "../i18n";
/** PvP 선택판과 상세 화면이 함께 사용하는 식별자다. 저장 데이터나 전투 규칙은 담지 않는다. */
export type PvpModeId = "arena" | "boss-duel" | "brawl" | "training";

/** 플레이어에게 보여 줄 모드 이름과 현재 기획 범위를 한곳에서 관리하는 순수 정적 정의다. */
export interface PvpModeDefinition {
  id: PvpModeId;
  /** 선택판의 실제 줄바꿈까지 포함한 버튼 라벨이다. */
  label: string;
  /** 상세 화면에서 사용하는 세계관 내 제목이다. */
  title: string;
  /** 구현 상태가 아니라 해당 모드에서 수행할 전투의 범위만 설명한다. */
  scope: string;
}

/** 배열 순서가 곧 2×2 선택판의 읽기 순서(좌→우, 위→아래)다. */
export const PVP_MODES: readonly PvpModeDefinition[] = [
  { id: "arena", label: "결투장", title: "결투장", scope: "사전 편성된 공격팀으로 상대의 방어팀과 전투" },
  { id: "boss-duel", label: "우두머리\n결정전", title: "우두머리 결정전", scope: "양측 최강 렐릭의 1:1 전투\n초기에는 준비된 상대 풀 사용" },
  { id: "brawl", label: "대난투", title: "대난투", scope: "6:6 결투" },
  { id: "training", label: "연습 훈련", title: "연습 훈련", scope: "허수아비 또는 아군 렐릭을 이용한\n1:1~3:3 훈련" },
] as const;

/** 잘못된 외부 진입이 있더라도 첫 모드로 안전하게 수렴시키는 순수 조회 경계다. */
export function getPvpMode(id: unknown): PvpModeDefinition {
  return PVP_MODES.find((mode) => mode.id === id) ?? PVP_MODES[0];
}

/** 결투 모드의 이름과 설명을 언어별로 덮어쓸 수 있게 등록한다. */
for (const mode of PVP_MODES) {
  registerDataText(mode, "label", `pvp.${mode.id}.label`);
  registerDataText(mode, "title", `pvp.${mode.id}.title`);
  registerDataText(mode, "scope", `pvp.${mode.id}.scope`);
}
