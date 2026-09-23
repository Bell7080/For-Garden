import { ENCOUNTER_ROLE, type EncounterRole } from "../core/levelDesign";
import { t } from "../i18n";
import type { GlyphName } from "./glyphs";

/**
 * 적 정보창의 **역할 칸**이 말하는 것 — 이 적이 어떤 자리로 섰는가.
 *
 * 역할은 기술이 아니라 **자리의 성질**이다. 몇 몫을 버티고 때리는지(`ENCOUNTER_ROLE`의 배수),
 * 얼마나 크게 서는지, 그리고 보스·불사가 갖는 강인함·경감까지 전부 유형 표 한 곳이 갖는다.
 * 한때 그 강인함과 경감이 폰토스·수쿠스이노의 패시브에 저마다 적혀 있어, 보스가 늘 때마다
 * 같은 문장이 조금씩 다른 수로 복사되었다. 이제 패시브에는 그 개체만의 것만 남고, 자리가
 * 주는 몫은 이 칸이 표에서 읽어 한 문장으로 짓는다.
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

/**
 * 역할 칸의 상징. 계급장처럼 갈매기 수로 몫을 말한다(잡졸 하나 · 정예 둘 · 무리 여럿).
 *
 * 원정 지도의 조우 글리프를 빌리던 때는 일반 조우의 교차 도구가 작은 칸에서 **닫기 X**로 읽혔다.
 * 보스만 지도의 보스 뿔을 그대로 써 같은 적이 두 곳에서 같은 표식으로 선다.
 */
export function encounterRoleGlyph(role: EncounterRole): GlyphName {
  switch (role) {
    case "normal": return "role-normal";
    case "swarm": return "role-swarm";
    case "elite": return "role-elite";
    case "boss": return "expedition-boss";
    case "endless": return "role-endless";
  }
}

/** 배수를 `×1.18`처럼 적는다. 소수 끝의 0은 떼어 `×3.30`이 아니라 `×3.3`으로 선다. */
function multiplier(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/**
 * 요약 한 줄 — **이 자리에서 무엇이 몇 배로 서는가.**
 *
 * 1인 배수는 적지 않는다: 바뀌지 않는 값을 늘어놓으면 정작 달라진 한둘이 그 사이에 묻힌다.
 * 모두 1이면(잡졸) 붙는 배율이 없다는 것 자체를 말한다.
 */
export function encounterRoleSummary(role: EncounterRole): string {
  const spec = ENCOUNTER_ROLE[role];
  const parts = [
    spec.hpMultiplier === 1 ? undefined : t("info.enemy.role.stat.hp", { value: multiplier(spec.hpMultiplier) }),
    spec.attackMultiplier === 1 ? undefined : t("info.enemy.role.stat.attack", { value: multiplier(spec.attackMultiplier) }),
    spec.bodyScale === 1 ? undefined : t("info.enemy.role.stat.body", { value: multiplier(spec.bodyScale) }),
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? t("info.enemy.role.stat.none") : parts.join("   ·   ");
}

/**
 * 본문 — 어떤 자리인가, 그리고 그 자리가 주는 **강인함·경감.**
 *
 * 강인함·경감은 규칙어 태그로 걸어 눌러 뜻을 열게 하고, 얼마인지는 이 자리의 값으로 적는다 —
 * 태그는 여러 자리가 함께 쓰므로 수치를 갖지 않는다(출혈과 같은 규칙).
 */
export function encounterRoleDescription(role: EncounterRole): string {
  const spec = ENCOUNTER_ROLE[role];
  const lead = (() => {
    switch (role) {
      case "normal": return t("info.enemy.role.lead.normal");
      case "swarm": return t("info.enemy.role.lead.swarm");
      case "elite": return t("info.enemy.role.lead.elite");
      case "boss": return t("info.enemy.role.lead.boss");
      case "endless": return t("info.enemy.role.lead.endless");
    }
  })();
  const sentences = [lead];
  if (spec.tenacity) {
    sentences.push(t("info.enemy.role.tenacity", {
      base: spec.tenacity.basePercent, per: spec.tenacity.perControlPercent, max: spec.tenacity.maxPercent,
    }));
  }
  if (spec.damageReduction) {
    sentences.push(t("info.enemy.role.damageReduction", {
      base: spec.damageReduction.basePercent, max: spec.damageReduction.maxPercent,
      ignore: spec.damageReduction.ignoreAtOrBelow,
    }));
  }
  // 배율이 붙는 자리만 그 값이 능력치에 이미 들어 있다고 말한다. 잡졸에는 들어 있을 것이 없다.
  if (encounterRoleSummary(role) !== t("info.enemy.role.stat.none")) sentences.push(t("info.enemy.role.included"));
  return sentences.join(" ");
}
