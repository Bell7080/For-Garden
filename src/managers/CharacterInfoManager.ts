/**
 * 캐릭터 상세 팝업의 공개 진입점이다.
 *
 * 실제 프리팹 구현은 Phaser UI 계층에 두되, 전투·편성·도감 같은 기능 화면은 이 경로만
 * 바라보게 한다. 추후 탭이 늘거나 팝업 레이아웃이 바뀌어도 호출부의 계약은 유지된다.
 */
// 씬은 실제 정보창 구현 대신 이 공개 진입점을 통해 라벨과 프리팹을 함께 사용한다.
export { InfoManager as CharacterInfoManager, ELEMENT_LABEL, ROLE_LABEL, addHelpBadge } from "../ui/info";
