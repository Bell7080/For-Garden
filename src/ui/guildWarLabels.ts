import { parseGuildWarSlotId } from "../core/guildWarMap";
import { t } from "../i18n";

/** 칸 이름 — 「제1지부 · 우두머리」. 지도 쪽지와 편성 제목이 같은 말을 쓴다. */
export function guildWarSlotLabel(slotId: string): string {
  const slot = parseGuildWarSlotId(slotId);
  if (!slot) return "";
  return t("guild.war.slot.title", { branch: t("guild.war.branch", { n: slot.branch }), kind: t(`guild.war.kind.${slot.kind}`) });
}
