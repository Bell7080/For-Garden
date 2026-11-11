/**
 * 연구 기록 창(`GachaHistoryPopup`)의 자리 — Phaser 없이 읽히도록 따로 둔다(단위 테스트가 같은 값을 읽는다).
 *
 * 목록은 **묶음 머리줄 + 칸 줄**이 섞여 흐른다. 머리줄은 한 번의 연구(언제·어느 배너·몇 회·치른 값·천장)를,
 * 칸 줄은 그 연구에서 나온 것 하나를 말한다. 줄마다 높이가 달라 y는 이 표의 셈으로만 얻는다.
 */
export const GACHA_HISTORY = {
  width: 920,
  height: 1500,
  /** 화면 위에서부터 창 윗변까지. 확률 창과 같은 높이에서 연다. */
  screenTop: 210,
  padding: 40,
  /** 창 윗변에서 머리글(최근 N건) 줄까지. 제목표가 윗변에 걸터앉으므로 그만큼 비운다. */
  captionY: 74,
  /** 창 윗변에서 흐르는 목록 창 윗변까지. */
  viewportTop: 116,
  /** 창 밑변에서 흐르는 목록 창 밑변까지. */
  viewportBottom: 40,
  header: { height: 100, gap: 14, titleSize: 30, subSize: 23, dateSize: 23 },
  slot: { height: 82, icon: 66, indent: 26, nameSize: 28, tagSize: 22, tierSize: 26 },
  /** 묶음과 묶음 사이. */
  groupGap: 26,
} as const;

export interface GachaHistoryRow {
  kind: "header" | "slot";
  /** 몇 번째 묶음인지(최신 0). */
  group: number;
  /** 칸 줄이면 그 묶음 안의 번호. */
  slot?: number;
  /** 목록 위에서부터 줄 가운데까지. */
  y: number;
  height: number;
}

/** 묶음마다 칸 수를 받아 줄 자리를 늘어놓는다. */
export function gachaHistoryRows(slotCounts: readonly number[]): { rows: GachaHistoryRow[]; height: number } {
  const L = GACHA_HISTORY;
  const rows: GachaHistoryRow[] = [];
  let y = 0;
  slotCounts.forEach((count, group) => {
    if (group > 0) y += L.groupGap;
    rows.push({ kind: "header", group, y: y + L.header.height / 2, height: L.header.height });
    y += L.header.height + L.header.gap;
    for (let slot = 0; slot < count; slot += 1) {
      rows.push({ kind: "slot", group, slot, y: y + L.slot.height / 2, height: L.slot.height });
      y += L.slot.height;
    }
  });
  return { rows, height: y };
}

export function gachaHistoryViewportHeight(): number {
  return GACHA_HISTORY.height - GACHA_HISTORY.viewportTop - GACHA_HISTORY.viewportBottom;
}

/** 연구 시각 — 기기의 현지 시각으로 `2026.11.11 17:59`. 숫자만이라 언어를 가리지 않는다. */
export function formatGachaHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
