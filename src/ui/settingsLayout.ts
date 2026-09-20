/**
 * 환경설정 화면의 **순수 배치표**.
 *
 * 이 화면은 오랫동안 "글자만 써 있는" 목록이었다 — 탭 다섯이 맨 글자로 서서 지금 어느 탭인지
 * 색으로만 겨우 읽혔고, 섹션 제목은 판 안에 들여놓은 맨 글자라 다른 화면의 제목표와 다른
 * 위계로 보였으며, 판 높이는 `850`·`1140`처럼 손으로 적혀 있어 줄 하나를 더하면 마지막 줄이
 * 판 밖으로 나갔다.
 *
 * Phaser를 읽지 않는 이유는 다른 배치표와 같다 — 화면과 회귀 테스트가 같은 값을 읽어야 한다.
 *
 * ## 글자 크기를 이렇게 잡은 이유
 *
 * **세로 모바일에서 한 손으로 훑는 목록이다.** 1080 폭에서 본문 28px은 가로 화면 기준으로는
 * 넉넉하지만 손에 쥔 화면에서는 작고, 무엇보다 이 화면의 글은 **읽고 나서 고르는** 글이라
 * 훑어보기만 하는 목록보다 커야 한다. 역할은 셋뿐이므로(`display`·`emphasis`·`body`) 위계는
 * 굵기가 아니라 **크기와 색**으로 가른다.
 */

/** 화면 제목과 탭 줄. 제목 아래로 탭이 서고 그 밑으로 내용이 흐른다. */
export const SETTINGS_HEAD = {
  /** 화면 제목. 이름표라 `display`다. */
  titleSize: 56,
  titleX: 54,
  titleY: 62,
  /** 탭 줄의 중심 y. */
  tabY: 176,
  /** 탭 한 칸의 높이. 88px 터치 영역을 넘긴다. */
  tabHeight: 88,
  /** 탭 줄이 화면 좌우에서 남기는 여백. */
  tabMargin: 30,
  /** 탭 사이의 틈. 붙여 두면 다섯 칸이 한 판으로 읽힌다. */
  tabGap: 6,
  /** 내용이 시작하는 높이(스크롤 컨테이너의 원점). */
  contentTop: 252,
} as const;

/** 줄 하나가 차지하는 세로와, 줄이 쓰는 가로 범위. */
export const SETTINGS_ROW = {
  /**
   * 줄 간격.
   *
   * 88px 터치 영역에 위아래 숨 쉴 자리를 더한 값이다. 예전 94는 구분선과 다음 줄의 글자가
   * 거의 붙어 목록이 빽빽하게 읽혔다.
   */
  step: 102,
  left: 90,
  right: 990,
  /** 줄이 입력을 받는 높이. 어느 줄에서나 같아야 손이 같은 자리를 믿는다. */
  hitHeight: 88,
} as const;

/** 줄 안의 글자 크기. 이름은 본문, 값과 상태는 강조다. */
export const SETTINGS_TEXT = {
  /** 줄 이름 — 「효과음 크기」. */
  label: 31,
  /** 지금 고른 값 — 「60 FPS」·「한국어」. */
  value: 30,
  /** 스위치 안의 `ON`/`OFF`. 홈 안에 들어가야 하므로 값보다 작다. */
  state: 24,
  /** 슬라이더 오른쪽 끝의 `72%`. */
  amount: 27,
  /**
   * 섹션 제목표.
   *
   * 줄 이름보다 **커야 한다.** 같은 크기면 제목이 첫 줄처럼 읽혀 그 판이 무엇을 묶은
   * 것인지 말하지 못한다.
   */
  section: 35,
  /** 계정 요약·알림 상태처럼 읽기만 하는 문단. */
  note: 25,
  /** 눌러서 무언가 하는 글자 줄(연동·정책·초기화). */
  action: 29,
} as const;

/** 섹션 판이 내용 위아래로 남기는 자리. */
export const SETTINGS_SECTION = {
  /** 제목표가 판 윗변에 걸터앉으므로, 첫 줄은 그만큼 내려와야 글자가 겹치지 않는다. */
  headRoom: 92,
  /**
   * 마지막 줄의 **아래 끝** 뒤에 남기는 숨 쉴 자리.
   *
   * 끝을 재는 일은 화면이 실제 자식들의 경계로 하므로(`SettingsScene`) 여기서는 그 아래
   * 여백만 정한다. 쌓아 올린 `y`(= 다음 줄이 설 자리)를 그대로 끝으로 쓰던 때는 판이 마지막
   * 줄보다 한 줄 하고도 반만큼 더 내려가, 판 밑에 아무것도 없는 자리가 한 뼘 남았다.
   */
  footRoom: 26,
  /** 앞 섹션의 판과 다음 판 사이. 두 판이 붙으면 어디까지가 한 묶음인지 흐려진다. */
  gap: 28,
  /** 판의 가로. 줄(90~990)보다 양쪽으로 조금 더 품는다. */
  width: 980,
  /** 모서리 깎임. */
  bevel: 14,
  /** 첫 섹션의 판 윗변(스크롤 컨테이너 안쪽 기준). */
  firstTop: 28,
} as const;

/**
 * 섹션 판의 높이를 **쌓인 내용에서 거꾸로 구한다.**
 *
 * 손으로 적어 두면 줄 하나를 더하거나 언어를 바꿔 줄이 늘어날 때마다 마지막 줄이 판 밖으로
 * 나간다 — 실제로 그랬다(`section(t(...), 1140)`).
 *
 * @param top 섹션이 시작한 y(제목표가 걸터앉을 변).
 * @param bottom 이 섹션이 실제로 그린 것들의 **가장 아래 끝**(줄의 입력 영역을 포함한다).
 */
export function settingsSectionHeight(top: number, bottom: number): number {
  const content = Math.max(0, bottom - top);
  return Math.max(SETTINGS_SECTION.headRoom + SETTINGS_SECTION.footRoom, content + SETTINGS_SECTION.footRoom);
}

/**
 * 지원·데이터 탭의 **글자 줄**(연동·정책·초기화)이 쌓이는 자리.
 *
 * 이 탭은 앞선 「계정」 판의 높이만큼 아래에서 시작하는데, 그 높이는 계정 요약 문단의
 * 줄 수에 따라 언어마다 달라진다 — 그대로 두면 **줄 자리를 짚을 방법이 없어** E2E가
 * `tapGame(page, 450, 1026)`처럼 눈대중으로 찍고, 한 줄만 어긋나도 **다른 줄이 대신
 * 눌린 채 조용히 통과한다.** 실제로 그랬다: 「저장 데이터 초기화」를 누른다고 적어 둔 자리가
 * 한 줄 위의 「환경설정 초기화」였고, 그 탓에 저장이 지워지지 않아 검사가 깨져 있었다.
 *
 * 그래서 두 번째 판이 시작하는 자리를 **고정한다.** 계정 판이 그보다 길어지면 화면이
 * 밀어내므로(`Math.max`) 겹치지는 않고, 그때는 E2E가 팝업 제목으로 먼저 확인한다.
 */
export const SETTINGS_SUPPORT = {
  /** 「고객지원 · 데이터」 판의 윗변(스크롤 컨테이너 안쪽 기준). */
  sectionTop: 422,
  /** 글자 줄 사이의 간격. 줄마다 88px 입력면을 갖는다. */
  actionStep: 92,
  /** 계정 요약 문단 아래에 연동 버튼이 서는 자리(판 윗변에서부터). */
  accountSummaryRoom: 150,
  /** 연동 버튼 아래에 남기는 자리. */
  accountFootRoom: 120,
} as const;

/** 지원 탭의 `index`번째 글자 줄이 서는 **화면** y. */
export function settingsSupportActionY(index: number): number {
  return SETTINGS_HEAD.contentTop + SETTINGS_SUPPORT.sectionTop + SETTINGS_SECTION.headRoom + SETTINGS_SUPPORT.actionStep * index;
}

/** 탭 한 칸이 서는 자리. 화면 폭을 칸 수로 고르게 나누고 사이에 틈을 둔다. */
export function settingsTabSlot(index: number, count: number, screenWidth: number): { x: number; width: number } {
  const span = (screenWidth - SETTINGS_HEAD.tabMargin * 2) / count;
  return {
    x: SETTINGS_HEAD.tabMargin + span * (index + 0.5),
    width: span - SETTINGS_HEAD.tabGap,
  };
}

/**
 * 섹션의 `index`번째 줄이 서는 **화면** y.
 *
 * E2E가 좌표를 손으로 적지 않게 하려고 함께 내보낸다 — 줄 간격이나 머리글 높이를 손보면
 * 스펙의 숫자가 통째로 어긋나고, 그때 실패하는 것은 배치가 아니라 **스펙이 찍은 자리**다.
 * 실제로 그랬다: 배치를 손본 커밋마다 `tapGame(page, 800, 392)` 같은 줄을 다시 세어야 했다.
 *
 * 첫 섹션 기준이다. 두 번째 섹션부터는 앞 판의 높이가 내용에 따라 달라지므로 이 값으로
 * 짚지 않는다.
 */
export function settingsRowY(index: number): number {
  return SETTINGS_HEAD.contentTop + SETTINGS_SECTION.firstTop + SETTINGS_SECTION.headRoom + SETTINGS_ROW.step * index;
}

/** 탭 한 칸의 중심 x(화면 좌표). */
export function settingsTabX(index: number, count: number, screenWidth: number): number {
  return settingsTabSlot(index, count, screenWidth).x;
}
