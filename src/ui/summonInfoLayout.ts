import { ENEMY_INFO } from "./enemyInfoLayout";

/**
 * 소환수 정보창의 **순수 배치표**.
 *
 * 적 정보창과 같은 판·같은 오른쪽 기둥·같은 스킬 액자 줄을 쓴다 — 같은 무게의 창이 저마다 다른
 * 자리에 칸을 두면 한쪽이 덜 만든 창으로 읽힌다. 다른 것은 **소환수에게 뜻이 없는 칸을 빼고 그
 * 자리에 지휘자와의 관계를 세운 것**뿐이다.
 *
 * - 등급 글자 → 「디안의 소환수」 한 줄. 늑대는 뽑는 개체가 아니라 등급이 고를 이유를 말하지 않는다.
 * - 돌파 등급 표식 → 지휘자의 얼굴. 누구의 몸인지가 이름 다음으로 읽혀야 한다.
 * - 레벨 칸 → **성장 기준** 칸. 늑대는 레벨이 없고, 지휘자의 한 능력치가 모든 수치를 정한다.
 * - 오른쪽 아래 SD 받침 → **재소환** 칸. 쓰러지면 언제 얼마로 돌아오는지가 편성을 가르는 수다.
 * - 전신 원화 → 없다. SD 묶음이 곧 온전한 한 마리라 **그 SD를 왼쪽에 크게** 세운다.
 * - 패시브 액자 → 뺀다. 늑대의 패시브는 "지휘자의 한 능력치가 모든 수치를 정한다"뿐이라 성장
 *   기준 칸과 같은 말을 한다. 폭주 뱃지는 첫 액자(일반 공격) 위에 선다.
 *
 * 좌표는 모두 **팝업 몸판 가운데가 0인 로컬 좌표**다.
 */
export const SUMMON_INFO = {
  width: ENEMY_INFO.width,
  height: ENEMY_INFO.height,
  left: ENEMY_INFO.left,
  right: ENEMY_INFO.right,
  nameFade: ENEMY_INFO.nameFade,
  /** 「디안의 소환수」 — 적 창의 등급 글자 자리다. */
  rarityY: ENEMY_INFO.rarityY,
  nameY: ENEMY_INFO.nameY,
  numberY: ENEMY_INFO.numberY,
  badge: ENEMY_INFO.badge,
  /** 이름과 뱃지는 지휘자 얼굴 앞에서 끝난다. */
  nameRight: 220,
  /** 지휘자의 얼굴 — 적 창의 돌파 등급 표식 자리. 이름 줄과 같은 높이에 선다. */
  ownerFace: { x: 306, y: -462, size: 128 },
  column: ENEMY_INFO.column,
  /** 성장 기준 칸 — 적 창의 레벨 칸과 같은 자리·같은 높이다. */
  growthPanel: ENEMY_INFO.levelPanel,
  statPanel: ENEMY_INFO.statPanel,
  radar: ENEMY_INFO.radar,
  reach: ENEMY_INFO.reach,
  statMagnifier: ENEMY_INFO.statMagnifier,
  /**
   * 재소환 칸 — 능력치 칸 아래 같은 기둥. 윗변 제목표가 능력치 칸 밑변과 겹치지 않을 만큼 띄우고,
   * 오른쪽 아래 깎인 모서리 안에서 끝난다.
   */
  resummonPanel: { top: 344, height: 140 },
  journalButton: ENEMY_INFO.journalButton,
  skills: ENEMY_INFO.skills,
  ferocityBadgeOffsetY: ENEMY_INFO.ferocityBadgeOffsetY,
  roleBadgeOffsetY: ENEMY_INFO.roleBadgeOffsetY,
  /**
   * 왼쪽 기둥에 크게 서는 SD. 늑대는 높이보다 가로가 넓어(내용 1079×1005) 이 높이에서 폭이 약
   * 400이다 — 오른쪽 끝이 능력치 칸의 왼쪽 변 앞에서 멈추고, 머리는 관찰 일지 칩 아래, 받침 글자는
   * 폭주 뱃지 윗변보다 위에 선다.
   */
  figure: { x: -224, groundY: 182, height: 370 },
} as const;
