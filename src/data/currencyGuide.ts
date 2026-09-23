import type { WalletItemKey } from "./items";
import { registerDataText } from "../i18n";

/** 안내창이 직접 진행 상태를 바꾸지 않고 바깥 화면에 요청할 수 있는 이동 명령이다. */
export type CurrencyGuideAction =
  | { readonly kind: "scene"; readonly target: "lab"; readonly label: string }
  | { readonly kind: "popup"; readonly target: "trade"; readonly label: string };

/** 지갑 재화 한 종류의 세계관 설명과 현재 구현에 근거한 획득·소비 경로다. */
export interface CurrencyGuideEntry {
  readonly key: WalletItemKey;
  readonly name: string;
  readonly lore: string;
  readonly sources: readonly string[];
  readonly uses: readonly string[];
  readonly action?: CurrencyGuideAction;
}

/**
 * 운영 데이터와 실제 플레이 흐름을 대조한 지갑 안내 카탈로그.
 *
 * 아직 이동할 화면이 없는 광고·원정 보상에는 action을 붙이지 않는다. 버튼이 준비 상태를
 * 과장하지 않게 하며, 문구 변경도 화면마다 복제하지 않고 이 표 한 곳에서 끝낸다.
 */
export const CURRENCY_GUIDE = {
  fossil: { key: "fossil", name: "화석", lore: "복원 가능한 생명의 흔적이 잠든 표본입니다.", sources: ["원정 노드·주간 기록", "고고학의 지층 탐사", "교류 파견·후원 패키지"], uses: ["연구소의 화석 연구", "상점의 보급품 구매", "무역의 결정 정제 의뢰"], action: { kind: "scene", target: "lab", label: "연구소로 이동" } },
  amber: { key: "amber", name: "호박석", lore: "희귀한 복원 신호를 온전히 품은 결정입니다.", sources: ["원정의 희귀 보상", "상점 신입 연구원 패키지", "무역의 결정 정제 의뢰"], uses: ["연구소의 한정 호박석 연구", "무역의 보급 전환 계약"], action: { kind: "scene", target: "lab", label: "연구소로 이동" } },
  gems: { key: "gems", name: "젬", lore: "도시의 연구 시설과 보급망이 인정하는 결정 화폐입니다.", sources: ["배치형 자원 발굴", "원정 노드·주간 기록", "연구 후원 일일 보너스"], uses: ["스테미나 충전", "운영 상품 계약"] },
  gold: { key: "gold", name: "골드", lore: "정비와 세공 현장에서 쓰이는 표준 작업 화폐입니다.", sources: ["배치형 자원 발굴", "화석·호박석 연구 부산물", "스테이지·원정 보상"], uses: ["룬 세공", "렐릭 성장과 연구 정비"] },
  stamina: { key: "stamina", name: "스테미나", lore: "조사대가 현장에 진입할 수 있는 작전 여력입니다.", sources: ["일일 광고 보급", "에너지 드링크 사용", "시간 회복"], uses: ["스테이지 전투 진입 계약"] },
  dnaFragments: { key: "dnaFragments", name: "DNA 조각", lore: "복원체의 잠재 구조를 다시 잇는 공용 유전 표본입니다.", sources: ["무역의 복원 재료 교환", "중복 복원 연구"], uses: ["렐릭 돌파 성장", "무역의 표본 반출 계약"], action: { kind: "popup", target: "trade", label: "무역 열기" } },
  cheesecake: { key: "cheesecake", name: "치즈케이크", lore: "복원체와 신뢰를 쌓는 연구소의 특별 급여입니다.", sources: ["배치형 자원 발굴", "화석·호박석 연구 부산물", "원정·일일 광고 보상", "교류 파견 보상"], uses: ["렐릭 급여 성장", "무역의 복원 재료 교환"], action: { kind: "popup", target: "trade", label: "무역 열기" } },
  raidSigil: { key: "raidSigil", name: "토벌 증표", lore: "보스를 밀어낸 몫만큼 발급되는 토벌 증서입니다.", sources: ["끝난 레이드의 정산", "레이드 토벌 몫"], uses: ["전리품 상점의 토벌 교환"] },
  salvageRecord: { key: "salvageRecord", name: "인양 기록", lore: "수장된 지부에서 무엇을 건졌는지 적어 둔 기록입니다.", sources: ["원정 노드 보상", "원정 주간 기록 보상"], uses: ["전리품 상점의 인양 교환"] },
  rawStone: { key: "rawStone", name: "원석", lore: "지층 깊이 잠들어 있던, 아직 아무도 손대지 않은 광물입니다.", sources: ["배치형 자원 발굴", "고고학의 지층 탐사", "고고학 상점 교환"], uses: ["룬 특성 재해석"] },
} as const satisfies Record<WalletItemKey, CurrencyGuideEntry>;

/** 외부 입력도 항상 완전성 검사를 통과한 카탈로그에서만 조회한다. */
export function currencyGuide(key: WalletItemKey): CurrencyGuideEntry { return CURRENCY_GUIDE[key]; }

/** 재화 안내의 이름·설명·획득처·사용처를 언어별로 덮어쓸 수 있게 등록한다. */
for (const entry of Object.values(CURRENCY_GUIDE)) {
  const key = (field: string): string => `currency.${entry.key}.${field}`;
  registerDataText(entry, "name", key("name"));
  registerDataText(entry, "lore", key("lore"));
  // 목록은 자리마다 키를 갖는다 — 언어마다 항목 수가 달라지면 안 되는 표라 번호로 묶는다.
  entry.sources.forEach((_, index) => registerDataText(entry.sources as unknown as Record<string, unknown>, String(index), key(`source.${index}`)));
  entry.uses.forEach((_, index) => registerDataText(entry.uses as unknown as Record<string, unknown>, String(index), key(`use.${index}`)));
  if ("action" in entry && entry.action) registerDataText(entry.action, "label", key("action"));
}
