/**
 * 실제 적 SD ZIP에 명시적으로 연결된 영구 ID 목록이다. 순수 정적 테스트가 Phaser 없이 읽는다.
 *
 * **ID는 파일 번호가 아니다.** 레이드 보스는 제 번호 묶음(`raidSD_00N`)을 쓰지만 적 SD를 찾는
 * 길은 같으므로 이 목록에 함께 선다 — 갈라 두면 화면이 "레이드면 다른 함수"를 알아야 한다.
 */
export const ENEMY_SD_ASSET_IDS = ["pontos", "toby", "amo", "ripa", "koma",
  "raitia-grass", "raitia-water", "raitia-fire", "raitia-earth", "raitia-wind", "sukusuino"] as const;
