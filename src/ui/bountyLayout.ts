import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACK_SLOT } from "./popupGeometry";

/**
 * 현상수배 화면의 **세로 좌표 소유자**.
 *
 * Phaser를 모르는 순수 표다 — 화면과 회귀 테스트가 같은 값을 읽어야 하고, 씬이 좌표를 손으로
 * 적으면 등급이 하나 늘 때마다 마지막 줄이 우하단 뒤로가기 밑으로 들어간다.
 *
 * 화면은 위에서부터 **제목 → 등급 줄 → 편성 칸 → 출격**이다. 등급 줄이 고르는 자리이고 편성
 * 칸은 그 아래에서 **누가 몇 번째로 나가는가**만 말한다 — 두 정보가 한 판에 섞이면 무엇을
 * 고르는 화면인지 읽히지 않는다.
 */
export const BOUNTY_LAYOUT = {
  title: { x: 64, y: 170 },
  /** 오늘 남은 입장 횟수. 제목 줄 오른쪽에 붙어 지금 몇 판이 남았는지만 말한다. */
  entries: { x: BASE_WIDTH - 64, y: 170 },
  tier: {
    /** 첫 줄의 **중심** y. 줄 높이의 절반만큼 이미 내려와 있다. */
    firstCenterY: 330,
    width: 952,
    height: 168,
    gap: 18,
    /** 줄 안에서 세 라운드의 얼굴이 서는 자리(줄 중심 기준). */
    faceSize: 96,
    faceFirstX: 150,
    faceGap: 116,
  },
  formation: {
    titleY: 1332,
    slotWidth: 268,
    slotHeight: 300,
    slotGap: 24,
    centerY: 1494,
  },
  /** 출격 버튼. 우하단 뒤로가기와 같은 줄에 서지 않도록 그 위에 둔다. */
  sortie: { x: BASE_WIDTH / 2, y: BACK_SLOT.y - 10, width: 560, height: 116 },
} as const;

/** `index`번째 등급 줄의 중심 y. 줄 높이와 사이 여백만으로 정해진다. */
export function bountyTierRowCenterY(index: number): number {
  const { firstCenterY, height, gap } = BOUNTY_LAYOUT.tier;
  return firstCenterY + index * (height + gap);
}

/** `slot`번째 편성 칸의 중심 x. 셋이 화면 가운데를 기준으로 고르게 선다. */
export function bountyFormationSlotCenterX(slot: number): number {
  const { slotWidth, slotGap } = BOUNTY_LAYOUT.formation;
  return BASE_WIDTH / 2 + (slot - 1) * (slotWidth + slotGap);
}

/**
 * 등급 줄이 차지하는 마지막 y. 편성 제목이 그보다 아래에 서는지 테스트가 지킨다.
 *
 * 줄 수를 인자로 받는 이유는 **등급이 늘어나는 표**이기 때문이다 — 다섯을 못 박아 두면 여섯째
 * 등급이 편성 칸 위로 겹쳐 선다.
 */
export function bountyTierListBottom(tierCount: number): number {
  return bountyTierRowCenterY(tierCount - 1) + BOUNTY_LAYOUT.tier.height / 2;
}

/** 화면 밑동을 넘어서는 배치를 테스트가 잡을 수 있게 남겨 두는 안전선이다. */
export const BOUNTY_SAFE_BOTTOM = BASE_HEIGHT;
