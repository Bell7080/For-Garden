/** 씬 좌표를 건드리지 않고 모든 새 Phaser Text가 공유하는 접근성 배율이다. */
let activeTextScale = 1;

/** 저장 로드와 설정 변경 경계가 공용 텍스트 계층에 배율을 전달한다. */
export function setTextScale(value: number): void {
  activeTextScale = value === 1.15 || value === 1.3 ? value : 1;
}

/** theme.textStyle만 이 값을 읽어 화면별 임의 배율 적용을 막는다. */
export function getTextScale(): number { return activeTextScale; }
