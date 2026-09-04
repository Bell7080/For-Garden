/**
 * 설정 스위치 한 줄의 **순수 배치표**.
 *
 * 예전에는 켜짐·꺼짐을 색과 크기만으로 알렸다 — 같은 자리의 점 하나가 조금 커지고 노래질
 * 뿐이라, 그 줄만 봐서는 지금 어느 쪽인지 알 수 없고 눌러 봐야 알았다. 스위치는 **자리로**
 * 말해야 한다: 꺼져 있으면 손잡이가 OFF 쪽에, 켜져 있으면 ON 쪽에 선다.
 *
 * Phaser를 들여오지 않는 이유는 그 자리를 테스트가 그대로 재야 하기 때문이다.
 */
export const SETTINGS_TOGGLE = {
  /** 홈(트랙)의 크기. 두 글자가 나란히 들어갈 만큼만 넓다. */
  trackWidth: 150,
  trackHeight: 54,
  /** 손잡이의 크기. 홈보다 살짝 작아 위아래로 홈이 비쳐 보인다. */
  knobWidth: 70,
  knobHeight: 42,
  /** 홈 안쪽 여백. 손잡이가 양 끝에서 이만큼 떨어진 자리에 선다. */
  padding: 5,
  /**
   * 오른쪽 끝 기준선. 줄마다 이 x에 홈의 오른쪽 변이 선다.
   *
   * 줄 사이의 구분선은 화면 가운데 890px이라 그 오른쪽 끝이 화면 985다. 스위치를 그 안쪽에
   * 두어야 줄이 구분선을 넘지 않는다 — 줄의 왼쪽 기준이 화면 90이므로 여기서는 880이다.
   */
  right: 880,
  /** 손잡이가 미끄러지는 시간(ms). 길면 눌렀는데 아직 그대로인 것처럼 보인다. */
  slideMs: 140,
} as const;

/** 홈 가운데의 x. 줄 안에서 늘 같은 자리를 쓴다. */
export function settingsTrackCenterX(): number {
  return SETTINGS_TOGGLE.right - SETTINGS_TOGGLE.trackWidth / 2;
}

/**
 * 손잡이의 x(홈 가운데 기준).
 *
 * 꺼짐은 왼쪽, 켜짐은 오른쪽이다. 좌우 어느 쪽이 켜짐인지는 문화가 아니라 **글자**가 말하므로,
 * 손잡이가 비운 쪽에 그 상태의 글자가 선다.
 */
export function settingsKnobOffsetX(value: boolean): number {
  const travel = (SETTINGS_TOGGLE.trackWidth - SETTINGS_TOGGLE.knobWidth) / 2 - SETTINGS_TOGGLE.padding;
  return value ? travel : -travel;
}

/** 상태 글자의 x(홈 가운데 기준). 손잡이가 선 반대쪽 — 즉 비어 있는 쪽에 선다. */
export function settingsStateLabelOffsetX(value: boolean): number {
  return -settingsKnobOffsetX(value);
}
