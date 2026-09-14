/** 전투 화면과 결과판의 문구. */
export const BATTLE_KO = {
  "battle.boss.phase": "관측 · 00:00",
  "battle.boss.scoreLine": "일반 스테이지 {normal}  ·  보스전 {boss}",
  "battle.boss.phaseLine": "{phase}{warning} · {time}",
  "battle.boss.tideWarning": " · 해일 예고",
  "battle.boss.limit": " · LIMIT",

  "battle.settle.failed": "결과 화면을 복구하지 못했습니다.",
  "battle.settle.scoreRejected": "전투 기록이 서버 검증에서 거절되었습니다.",
  "battle.settle.persistenceFailed": "결과를 저장하지 못했습니다. 다시 시도하거나 상태 복구 후 로비로 이동해 주세요.",
  "battle.settle.retry": "정산 다시 시도",
  "battle.settle.recoverLobby": "상태 복구 후 로비",
  "battle.settle.done": "원정 관측 완료",
  "battle.settle.reward": "정산 보상",
  "battle.settle.noReward": "정산 재화 없음",
  "battle.settle.score": "이번 원정 점수",
  "battle.settle.detail": "상세",
  "battle.settle.toLobby": "로비로",
  "battle.settle.weeklyRecord": "주간 기록",
  "battle.contribution": "기여도",

  "battle.chip.speed": "{speed}배속",
  "battle.chip.autoOn": "궁극 ON",
  "battle.chip.autoOff": "궁극 OFF",
  "battle.chip.skipOn": "연출 스킵",
  "battle.chip.skipOff": "연출 ON",

  "battle.gauge.frenzy": "폭주 {value} / {max}",
  "battle.gauge.ferocity": "야성 {value} / {max}",
  "battle.result.saveFailed": "결과를 저장하지 못했습니다",
  "battle.result.retry": "다시 시도",
  "battle.result.nodeScore": "원정 점수 +{score}",
} as const;
