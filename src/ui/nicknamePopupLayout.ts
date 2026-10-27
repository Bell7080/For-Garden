/** 이름 등록과 변경이 함께 쓰는 정규창. SD 둘은 같은 발선에 선다. */
export const NICKNAME_POPUP = {
  width: 900, height: 1060,
  questionY: -368,
  sd: { xs: [-175, 175], groundY: -82, height: 232, labelY: -40 },
  fieldLabelY: 25, fieldY: 108,
  field: { width: 740, height: 92 },
  help: { x: 330, y: 22, size: 72 },
  countY: 180, rulesY: 224, noticeY: 310,
  saveY: 410, save: { width: 680, height: 92 },
} as const;
