import { ENCOUNTER_ROLE, type EncounterRole } from "../core/levelDesign";
import { t } from "../i18n";

/**
 * 적 정보창의 **역할 칸**이 말하는 것 — 이 적이 어떤 자리로 섰는가.
 *
 * 역할은 기술이 아니라 **자리의 성질**이다. 몇 몫을 버티고 때리는지(`ENCOUNTER_ROLE`의 배수),
 * 얼마나 크게 서는지, 그리고 보스·불사가 갖는 강인함·경감까지 전부 유형 표 한 곳이 갖는다.
 *
 * **쪽지는 그 자리가 바꾸는 것만 말한다.** 역할이 무엇인지 풀이하는 문장("셋이 함께 서는 기본
 * 자리다")을 앞에 세웠을 때는 배율과 강인함이 그 설명 뒤로 밀려, 정작 읽어야 할 변경점이 한
 * 문단 아래에 있었다. 이름이 이미 자리를 말하므로 요약 줄은 배율, 본문은 강인함·경감뿐이다.
 * 바꾸는 것이 하나도 없는 자리(잡졸)나 배율만 있는 자리는 빈 본문 대신 그 적의 **한마디**를
 * 세운다 — 규칙 설명이 아니라 누가 서 있는지를 말하는 대사다.
 *
 * Phaser를 읽지 않는다 — 문장과 수치를 테스트가 그대로 고정할 수 있게 한다. 아군에게는 역할이
 * 없으므로 이 칸은 적 정보창에만 선다.
 */

/** 역할 이름. 액자 아래 이름표와 쪽지 머리가 함께 쓴다. */
export function encounterRoleName(role: EncounterRole): string {
  switch (role) {
    case "normal": return t("info.enemy.role.normal");
    case "swarm": return t("info.enemy.role.swarm");
    case "elite": return t("info.enemy.role.elite");
    case "boss": return t("info.enemy.role.boss");
    case "endless": return t("info.enemy.role.endless");
  }
}

/** 역할 아이콘의 텍스처 키. 흰 실루엣이라 색은 화면이 뱃지의 tint로 입힌다. */
export function encounterRoleIcon(role: EncounterRole): string {
  return `encounter-role-${role}`;
}

/**
 * 부트가 읽을 역할 아이콘 목록. `scripts/prepare_skill_icons.py`가 `:{번호}.png` 원본을
 * `public/sprites/encounter-roles/<역할>.webp`로 굽는다 — 경로와 키를 이 한 곳에서 잇는다.
 */
export const ENCOUNTER_ROLE_ICON_ASSETS: ReadonlyArray<readonly [string, string]> = (
  ["normal", "swarm", "elite", "boss", "endless"] as const
).map((role) => [encounterRoleIcon(role), `/sprites/encounter-roles/${role}.webp`] as const);

/** 배수를 `×1.18`처럼 적는다. 소수 끝의 0은 떼어 `×3.30`이 아니라 `×3.3`으로 선다. */
function multiplier(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * 요약 한 줄 — **이 자리에서 무엇이 몇 배로 서는가.**
 *
 * 1인 배수는 적지 않는다: 바뀌지 않는 값을 늘어놓으면 정작 달라진 한둘이 그 사이에 묻힌다.
 * 모두 1이면(잡졸) 줄을 비운다 — "배율 없음"이라 적으면 바뀌지 않는 것을 한 번 더 말할 뿐이다.
 */
export function encounterRoleSummary(role: EncounterRole): string {
  const spec = ENCOUNTER_ROLE[role];
  return [
    spec.hpMultiplier === 1 ? undefined : t("info.enemy.role.stat.hp", { value: multiplier(spec.hpMultiplier) }),
    spec.attackMultiplier === 1 ? undefined : t("info.enemy.role.stat.attack", { value: multiplier(spec.attackMultiplier) }),
    spec.bodyScale === 1 ? undefined : t("info.enemy.role.stat.body", { value: multiplier(spec.bodyScale) }),
  ].filter((part): part is string => part !== undefined).join("   ·   ");
}

/**
 * 본문 — 그 자리가 주는 **강인함·경감**을 한 줄씩. 없으면 그 적의 한마디다.
 *
 * 강인함·경감은 규칙어 태그로 걸어 눌러 뜻을 열게 하고, 얼마인지는 이 자리의 값으로 적는다 —
 * 태그는 여러 자리가 함께 쓰므로 수치를 갖지 않는다(출혈과 같은 규칙).
 */
export function encounterRoleDescription(role: EncounterRole): string {
  const spec = ENCOUNTER_ROLE[role];
  const lines: string[] = [];
  if (spec.tenacity) {
    lines.push(t("info.enemy.role.tenacity", {
      base: spec.tenacity.basePercent, per: spec.tenacity.perControlPercent, max: spec.tenacity.maxPercent,
    }));
  }
  if (spec.damageReduction) {
    lines.push(t("info.enemy.role.damageReduction", {
      base: spec.damageReduction.basePercent, max: spec.damageReduction.maxPercent,
      ignore: spec.damageReduction.ignoreAtOrBelow,
    }));
  }
  if (lines.length > 0) return lines.join("\n");
  switch (role) {
    case "normal": return t("info.enemy.role.line.normal");
    case "swarm": return t("info.enemy.role.line.swarm");
    case "elite": return t("info.enemy.role.line.elite");
    // 보스·불사는 늘 강인함을 가지므로 여기 닿지 않는다. 닿는다면 표가 바뀐 것이라 빈 본문이 맞다.
    case "boss":
    case "endless": return "";
  }
}
