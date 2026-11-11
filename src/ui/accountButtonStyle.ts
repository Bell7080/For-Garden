/**
 * 계정 판의 로그인 수단·결제 버튼의 결.
 *
 * 로그인 버튼은 **그 플랫폼의 얼굴**을 따른다 — Google은 흰 면에 네 색 G, Apple은 검은 면에 흰 사과다.
 * 플레이어는 이 둘을 다른 앱에서 수없이 눌러 봐서, 글자를 읽기 전에 색과 표식으로 먼저 찾는다. 글자만
 * 나열하던 때는 「Google 연동」과 「이메일 연동」이 같은 금빛 글자라 어느 것이 어느 것인지 읽어야 알았다.
 * 게임 자체의 수단(아이디·이메일)과 결제 기록·구매 복원은 게임 팔레트 안에서 색만 갈라 선다.
 *
 * Phaser를 읽지 않는다 — 화면과 테스트가 같은 표를 읽는다.
 */
export type AccountButtonKind = "password" | "google" | "apple" | "email" | "history" | "restore";

export interface AccountButtonTone {
  /** 판 면 색과 불투명도. 상표 버튼은 상표 면이라 유리처럼 비치지 않는다. */
  fill: number;
  alpha: number;
  /** 사방 외곽선. 흰 면(Google)이 밝은 배경에 녹지 않게 두르는 얇은 선이다. */
  outline: number;
  outlineAlpha: number;
  /** 글자 색. */
  ink: string;
  /** 표식 색(Google은 상표 네 색이라 쓰지 않는다). */
  mark: number;
}

export const ACCOUNT_BUTTON_TONE: Readonly<Record<AccountButtonKind, AccountButtonTone>> = {
  google: { fill: 0xffffff, alpha: 1, outline: 0xdadce0, outlineAlpha: 1, ink: "#1f1f1f", mark: 0x4285f4 },
  apple: { fill: 0x000000, alpha: 1, outline: 0x5a5d63, outlineAlpha: 0.9, ink: "#ffffff", mark: 0xffffff },
  password: { fill: 0x1c3a42, alpha: 0.96, outline: 0x6fd3e0, outlineAlpha: 0.7, ink: "#e8fbff", mark: 0x8fe6f2 },
  email: { fill: 0x1f3a73, alpha: 0.96, outline: 0x7fa6ff, outlineAlpha: 0.7, ink: "#eef3ff", mark: 0xa9c3ff },
  history: { fill: 0x2a2418, alpha: 0.94, outline: 0xd8b978, outlineAlpha: 0.6, ink: "#f2e4c4", mark: 0xd8b978 },
  restore: { fill: 0x1e2a20, alpha: 0.94, outline: 0x8fd49a, outlineAlpha: 0.6, ink: "#e6f6e8", mark: 0x9be3a6 },
};

/** 버튼 한 장의 크기와 그 안의 자리. 판은 칩 실루엣(왼쪽 위·오른쪽 아래 깎임)이다. */
export const ACCOUNT_BUTTON = {
  width: 440,
  height: 92,
  bevel: 16,
  /** 표식이 서는 왼쪽 칸 — 판 왼쪽 끝에서 가운데까지, 표식 한 변. */
  markX: 52,
  markSize: 42,
  /** 글자가 시작하는 자리(판 왼쪽 끝 기준)와 오른쪽 여백. */
  labelX: 96,
  labelRight: 64,
  labelSize: 29,
  /** 연결된 수단의 체크 표식(판 오른쪽 끝에서 가운데까지). */
  checkX: 36,
  checkSize: 28,
} as const;

/** 계정 판 안의 두 칸 격자. 왼쪽 칸 가운데 x, 오른쪽 칸 가운데 x, 줄 간격. */
export const ACCOUNT_BUTTON_GRID = {
  leftX: 90 + ACCOUNT_BUTTON.width / 2,
  rightX: 990 - ACCOUNT_BUTTON.width / 2,
  rowStep: 112,
} as const;
