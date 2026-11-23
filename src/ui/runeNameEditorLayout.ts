/**
 * 룬 이름 변경창의 자리 — 판 가운데가 원점이다.
 *
 * 판은 화면 **위쪽**(`centerRatio`)에 선다. 모바일 자판은 화면 아래 절반 가까이를 덮으므로 가운데에 두면
 * 입력 칸이 자판에 가린다. 위에서부터 미리보기(룬 액자 + 등급·자리 + 지금 쓰는 이름) → 입력 칸 → 오류·글자 수 →
 * 저장 버튼 순이고, 닫는 길은 판 밖 우하단 뒤로가기와 판 밖 누르기뿐이다(판 안에 닫기·취소를 두지 않는다).
 */
export const RUNE_NAME_EDITOR = {
  width: 880,
  height: 560,
  centerRatio: 0.3,
  preview: { y: 128, width: 800, height: 164, bevel: 30, frame: 120, frameX: -318, textX: -232, rarityY: -34, nameY: 18, nameSize: 38 },
  field: { y: 300, width: 800, height: 92, fontSize: 32 },
  noteY: 376,
  save: { y: 470, width: 340, height: 88, fontSize: 30 },
} as const;
