/**
 * 화면 바깥 층(코어 규칙·임시 서버·저장)이 화면에 보내는 문구.
 *
 * 이 표가 따로 있는 이유는 **그 문구들이 씬이 아니라 규칙 쪽에서 만들어지기 때문**이다 —
 * 룬 조각 이름, 임무 제목, 전투 머리글, 상품 버튼처럼 여러 화면이 같은 값을 그대로 받아
 * 그린다. 화면마다 다시 짓지 않게 하려고 규칙이 이름을 갖고 있었고, 그 이름이 한국어였다.
 */
export const SYSTEM_KO = {
  // ── 룬 ──────────────────────────────────────────────────────────────────
  "rune.part.0": "1번 조각",
  "rune.part.1": "2번 조각",
  "rune.part.2": "3번 조각",
  "rune.rarity.uncommon": "고급",
  "rune.rarity.rare": "희귀",
  "rune.rarity.epic": "영웅",
  "rune.rarity.legendary": "전설",
  "rune.baseName": "{part} 룬",

  // ── 발굴 자동 배치 기준 ──────────────────────────────────────────────────
  "excavation.auto.balanced": "골고루",
  "excavation.auto.cheesecake": "치즈케이크",
  "excavation.auto.fossil": "화석",
  "excavation.auto.gold": "골드",
  "excavation.auto.gems": "젬",

  // ── 전투 버프 칩의 남은 시간 ─────────────────────────────────────────────
  "battle.buff.sameTarget": "동일 표적 유지 중",
  "battle.buff.conditional": "조건 유지 중",
  "battle.buff.permanent": "전투 중 유지",
  "battle.buff.ended": "종료",
  "battle.buff.seconds": "{seconds}초",

  // ── 전투 머리글 ─────────────────────────────────────────────────────────
  "battle.header.stage": "{id} · {name} · 적 {enemies}",
  "battle.header.expeditionBoss": "원정 {floor}층 · 불사 관측 보스",
  "battle.header.expedition": "원정 {floor}층 · {node}",
  "battle.node.normal": "일반 전투",
  "battle.node.elite": "정예 전투",
  "battle.node.horde": "군집 전투",

  // ── 프로필 ──────────────────────────────────────────────────────────────
  "profile.defaultName": "연구원",
  "profile.guest": "게스트",
  "profile.noFavorite": "미지정",
  "profile.expeditionBest": "역대 최고",

  // ── 상품 획득 ───────────────────────────────────────────────────────────
  "product.action.currency": "교환",
  "product.action.platform_payment": "구매",
  "product.action.free": "무료 수령",
  "product.action.rewarded_ad": "광고 보고 받기",
  "product.pending": "처리 중…",
  "product.pending.reason": "이미 처리 중입니다.",
  "product.limit.ad": "UTC 일일 제한에 도달했습니다.",
  "product.limit.claim": "수령 제한에 도달했습니다.",
  "product.unavailable.ad": "광고를 이용할 수 없습니다.",
  "product.unavailable.payment": "플랫폼 결제를 이용할 수 없습니다.",
  "product.unavailable": "지금 수령할 수 없습니다.",
  "product.price.free": "무료",
  "product.price.ad": "광고 · 일 {count}회",
  "product.price.currency": "{amount} {currency}",

  // ── 임시 서버가 보내는 우편·알림 ─────────────────────────────────────────
  "mail.welcome.title": "중앙 연구소 보급품",
  "mail.welcome.sender": "연구지원국",
  "mail.welcome.body": "새로운 조사 활동을 위한 보급품입니다.",
  "mail.notice.title": "광장 안전 점검 안내",
  "mail.notice.sender": "도시관리국",
  "mail.notice.body": "중앙 광장 안전 점검이 완료되었습니다.",
  "mail.archive.title": "기록 보존 감사품",
  "mail.archive.sender": "기록보존실",
  "mail.archive.body": "기록 제공에 감사드립니다.",
  "mail.expired.title": "지난 주 현장 보급",
  "mail.expired.sender": "현장지원반",
  "mail.expired.body": "수령 기간이 종료된 보급품입니다.",
  "mail.daily.title": "일일 임무 갱신",
  "mail.daily.body": "새로운 일일 임무가 시작되었습니다.",
  "mail.stamina.title": "스테미나 충전 완료",
  "mail.stamina.body": "스테미나가 모두 충전되었습니다.",

  // ── 화면에 그대로 서는 오류 ──────────────────────────────────────────────
  "error.purchase.unverified": "서버 영수증 검증 연결 전에는 구매할 수 없습니다.",
  "error.purchase.limit": "구매 제한에 도달했습니다.",
  "error.profile.locked": "설정 기록이 잠금 상태입니다.",
  "error.account.noSdk": "이 빌드에는 계정 플랫폼 SDK가 연결되어 있지 않습니다.",
  "error.save.cancelled": "저장 선택을 취소했습니다.",
  "error.save.changed": "선택 중 서버 저장이 갱신되었습니다.",
  "error.save.invalid": "서버 저장을 검증할 수 없습니다.",
  "error.save.mergeInvalid": "서버 병합 저장을 검증할 수 없습니다.",
  "error.expedition.submit": "점수를 제출하지 못했습니다.",
  "error.expedition.settle": "점수는 제출했지만 정산을 마치지 못했습니다.",
} as const;
