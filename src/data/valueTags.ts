import type { KeywordDef } from "./keywords";
import { t, type TextKey } from "../i18n";

/**
 * 능력치에서 환산한 수치 태그 — `[[v-<종류>-<능력치>-<비율>-<기준값>|<환산값>]]`.
 *
 * 설명문은 「주문력의 30%」처럼 비율로 적어 두면 지금 이 개체가 실제로 얼마를 내는지 말하지 못한다.
 * 그렇다고 환산값만 적으면 그 수가 어디서 나왔는지가 사라진다 — 그래서 **수치 자체가 태그**이고,
 * 누르면 「주문력의 30% (주문력 420 기준)」가 열린다.
 *
 * 태그가 **제 근거를 ID에 싣고 다니는** 까닭은 문맥 사전에 정의를 등록하지 않아도 되게 하려는 것이다.
 * 등록식이면 한 본문에 같은 종류의 수치가 둘일 때 첫 정의만 쓰이고, 규칙어 쪽지 안에 든 수치는
 * 문맥 사전을 물려받지 못해 눌리지 않는다. ID에서 읽으면 어디에 서든 같은 쪽지가 열린다.
 */
export type ValueTagKind = "damage" | "shield" | "heal" | "amount";
export type ValueTagStat = "atk" | "ap" | "def" | "res" | "hp";

const KINDS: readonly ValueTagKind[] = ["damage", "shield", "heal", "amount"];
const STATS: readonly ValueTagStat[] = ["atk", "ap", "def", "res", "hp"];

/** 비율의 소수점은 ID 문자가 아니라 `p`로 싣는다(3.5 → 3p5). */
function encodePercent(percent: number): string {
  return String(Math.round(percent * 1000) / 1000).replace(".", "p");
}

/** 기준 능력치에서 비율만큼 환산한 값. 화면과 쪽지가 같은 반올림을 쓴다. */
export function valueTagAmount(percent: number, base: number): number {
  return Math.round(Math.round(base) * percent / 100);
}

/** 환산값을 그 근거와 함께 태그로 만든다. */
export function valueTag(kind: ValueTagKind, stat: ValueTagStat, percent: number, base: number): string {
  const rounded = Math.max(0, Math.round(base));
  return `[[v-${kind}-${stat}-${encodePercent(percent)}-${rounded}|${valueTagAmount(percent, rounded)}]]`;
}

const PATTERN = /^v-(damage|shield|heal|amount)-(atk|ap|def|res|hp)-(\d+(?:p\d+)?)-(\d+)$/;

/** 수치 태그의 ID를 읽어 쪽지를 짓는다. 수치 태그가 아니면 `undefined`. */
export function resolveValueTag(id: string): KeywordDef | undefined {
  const match = PATTERN.exec(id);
  if (!match) return undefined;
  const kind = match[1] as ValueTagKind;
  const stat = match[2] as ValueTagStat;
  if (!KINDS.includes(kind) || !STATS.includes(stat)) return undefined;
  const percent = Number(match[3].replace("p", "."));
  const base = Number(match[4]);
  const amount = valueTagAmount(percent, base);
  const statLabel = t(`skill.stat.${stat}` as TextKey);
  return {
    id,
    term: String(amount),
    kind: "rule",
    description: t(`skill.keyword.value.${kind}` as TextKey, { stat: statLabel, percent, base, amount }),
  };
}
