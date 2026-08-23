import type { RuneRarity, RuneStatKey } from "../core/runes";

/**
 * 이전 이름을 쓰는 화면의 점진적 이전을 위한 희귀도 별칭이다.
 *
 * 희귀도 자체는 룬 도메인만 소유한다.
 * 룬 하트의 색이 이 넷을 그대로 따른다 — 초록 고급, 파랑 희귀, 보라 영웅, 빨강 전설. 색표는
 * `scripts/prepare_icons.py`의 `RUNE_TINTS`와 `src/ui/runeIcons.ts`의 `RUNE_ACCENT` 두 곳에만
 * 있으며 이 넷과 이름이 반드시 같아야 한다.
 */
export type HeartGemRarity = RuneRarity;

/** 능력치별 백분율 보정이다. 10은 해당 능력치를 10% 올린다는 뜻이다. */
export type HeartGemStatEffect = Partial<Record<RuneStatKey, number>>;

// 룬은 이제 인스턴스가 이름·희귀도·옵션을 모두 소유한다. 이 파일은 이전 UI 명칭과 코어 타입
// 사이의 호환 타입만 남기며, 정적 ID 카탈로그나 고정 수치의 런타임 진입점은 제공하지 않는다.
