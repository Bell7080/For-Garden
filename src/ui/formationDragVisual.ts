import { moveFormationSlot } from "../core/formation";

/**
 * 편성 자리를 끌어 옮기는 동안의 **표시 규칙**.
 *
 * 씬은 여기서 나온 값만 그린다. "잡았다 · 여기 놓으면 이렇게 된다 · 놓았다"를 화면이 저마다
 * 다른 값으로 표현하면 같은 조작이 화면마다 다른 물건처럼 보인다.
 *
 * 손에 든 것을 숫자나 글자로 알리지 않는다 — **든 캐릭터 자체가 커지고 떠오르고**, 뒤가 어두워져
 * 지금 무엇을 쥐고 있는지 그림으로 말한다.
 */
export const FORMATION_DRAG_VISUAL = {
  /** 손에 든 캐릭터가 커지는 배율. 확실히 "떠 있다"로 읽히되 옆 자리를 덮지 않을 만큼이다. */
  liftScale: 1.25,
  /** 잡는 동안 뒤를 덮는 검은 겹. 무엇을 쥐었는지가 먼저 읽히도록 판을 한 단계 눌러 둔다. */
  boardDimAlpha: 0.46,
  /** 자리를 바꿔 갈 캐릭터가 미리 옮겨 설 때의 진하기. 아직 확정이 아니라 비쳐 보인다. */
  previewAlpha: 0.5,
  /** 손에 든 캐릭터의 진하기. 살짝만 비쳐 아래 자리 표시가 읽힌다. */
  liftAlpha: 0.92,
  /**
   * 놓을 수 있는 자리를 알리는 네모칸.
   *
   * 노란 섬광 한 번으로 알리면 어디까지가 그 자리인지 읽히지 않는다. 네 모서리를 어긋나게 깎은
   * 칸을 **끄는 동안 계속** 띄워 두고, 지금 가리키는 칸만 진해진다.
   */
  zone: {
    /** 평소 칸. 배경이 그대로 비칠 만큼만 채운다. */
    fillAlpha: 0.14,
    lineAlpha: 0.42,
    /** 지금 가리키는 칸. */
    hoverFillAlpha: 0.3,
    hoverLineAlpha: 0.95,
    lineWidth: 3,
    hoverLineWidth: 5,
    /** 가리킨 칸만 살짝 커져 손끝이 어디 있는지 크기로도 읽힌다. */
    hoverScale: 1.06,
    bevel: 22,
  },
} as const;

export interface FormationZoneStyle {
  fillAlpha: number;
  lineAlpha: number;
  lineWidth: number;
  scale: number;
}

/** 칸 하나를 지금 어떻게 그릴지. 가리키는 칸과 나머지 칸의 차이는 여기서만 정한다. */
export function formationZoneStyle(hovered: boolean): FormationZoneStyle {
  const zone = FORMATION_DRAG_VISUAL.zone;
  return hovered
    ? { fillAlpha: zone.hoverFillAlpha, lineAlpha: zone.hoverLineAlpha, lineWidth: zone.hoverLineWidth, scale: zone.hoverScale }
    : { fillAlpha: zone.fillAlpha, lineAlpha: zone.lineAlpha, lineWidth: zone.lineWidth, scale: 1 };
}

/** 미리보기에서 한 자리가 보여 줄 내용. */
export interface FormationSlotPreview {
  /** 그 자리에 설 렐릭. 비어 있으면 undefined다. */
  relicId?: string;
  /** 손에 들려 따라다니는 자리. 화면은 이 칸의 SD를 포인터 위에 세운다. */
  lifted: boolean;
  /** 자리를 바꿔 미리 옮겨 온 칸. 확정 전이라 반투명하게 선다. */
  moved: boolean;
}

/**
 * 지금 놓으면 어떻게 되는지를 자리별로 돌려준다.
 *
 * **확정 규칙(`moveFormationSlot`)을 그대로 통과시킨다** — 미리보기가 실제 결과를 따로 계산하면
 * 보여 준 것과 놓은 결과가 갈린다. 가리키는 칸이 없으면 지금 편성 그대로이고 든 칸만 떠 있다.
 */
export function formationDragPreview(
  picked: readonly (string | undefined)[],
  from: number,
  hovered: number | undefined,
  slotCount: number,
): FormationSlotPreview[] {
  const swapped = hovered !== undefined && hovered !== from
    ? moveFormationSlot(picked, from, hovered)
    : picked;
  return Array.from({ length: slotCount }, (_unused, slot) => ({
    relicId: swapped[slot],
    lifted: slot === from,
    // 든 칸을 뺀 나머지 중 내용이 바뀐 칸만 "옮겨 왔다"로 표시한다.
    moved: slot !== from && swapped[slot] !== picked[slot],
  }));
}
