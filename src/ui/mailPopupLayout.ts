import type { MailDto } from "../api/contracts";

/**
 * 우편함의 자리. 팝업 본문 원점(화면 가운데) 기준이며 Phaser 없이 읽혀 테스트가 같은 값을 쓴다.
 *
 * **우편과 안내를 가른다.** 우편은 받을 것이 있는 봉투라 줄마다 첨부 액자가 밑동에 주르륵 서고
 * 오른쪽에 받기가 선다. 안내는 읽을 글이라 첨부 줄 대신 본문 첫 줄을 미리 보이고, 누르면 글
 * 전체가 열린다. 한 목록에 섞어 두면 보상을 찾는 손이 공지 사이를 헤집는다.
 */
export const MAIL_POPUP_LAYOUT = {
  popup: { widthInset: 70, heightInset: 210 },
  /** 목록이 흐르는 창. 하단 줄 위에서 끝난다. */
  viewport: { top: -772, bottom: 580, width: 940 },
  card: {
    width: 920,
    gap: 18,
    /** 우편 한 장 — 머리 줄(아이콘·제목·남은 기한) 아래로 첨부 줄이 선다. */
    rewardHeight: 300,
    /** 안내 한 장 — 머리 줄과 본문 미리보기 한 줄. */
    noticeHeight: 196,
    icon: 92,
  },
  /**
   * 첨부 줄. 한 줄에 일곱 칸이 서고, 넘치면 여섯 칸 뒤에 `+N`이 마지막 칸을 맡는다 — 받을 것이
   * 무엇인지는 적어도 다섯 칸은 보여야 읽힌다.
   */
  rewards: { size: 92, gap: 10, maxVisible: 7 },
  /**
   * 하단 두 줄 — 우편·안내 라벨이 위, **일괄 조작이 그 아래 가운데**다(임무와 같은 자리).
   * 오른쪽 아래 구석은 판 밖 뒤로가기의 자리라 비워 둔다.
   */
  footer: {
    tabY: 648,
    tab: { width: 210, height: 76, gap: 12, left: -470 },
    action: { x: 0, y: 772, width: 380, height: 92 },
  },
} as const;

export type MailTab = "reward" | "notice";

/** 첨부가 있으면 우편, 없으면 안내다. 보낸 쪽이 따로 표시하지 않아도 모양이 곧 종류다. */
export function mailTabOf(mail: Pick<MailDto, "rewards">): MailTab {
  return mail.rewards.length > 0 ? "reward" : "notice";
}

export function isMailExpired(mail: Pick<MailDto, "expiresAt">, nowMs: number): boolean {
  return mail.expiresAt !== null && Date.parse(mail.expiresAt) <= nowMs;
}

/**
 * 한 탭의 줄 순서 — 지금 손이 갈 것부터. 우편은 받을 것 → 받은 것 → 만료, 안내는 안 읽은 것 →
 * 읽은 것이고, 같은 무리 안에서는 최근 것이 위다.
 */
export function sortMails(mails: readonly MailDto[], tab: MailTab, nowMs: number): MailDto[] {
  const rank = (mail: MailDto): number => {
    if (tab === "notice") return mail.read ? 1 : 0;
    if (isMailExpired(mail, nowMs)) return 2;
    return mail.claimed ? 1 : 0;
  };
  return mails.filter((mail) => mailTabOf(mail) === tab)
    .sort((a, b) => rank(a) - rank(b) || Date.parse(b.sentAt) - Date.parse(a.sentAt));
}

/** 첨부 줄에 세울 칸과 넘친 수. 넘치면 마지막 칸을 `+N`에 내준다. */
export function mailRewardSlots<T>(rewards: readonly T[]): { shown: T[]; overflow: number } {
  const { maxVisible } = MAIL_POPUP_LAYOUT.rewards;
  if (rewards.length <= maxVisible) return { shown: [...rewards], overflow: 0 };
  return { shown: rewards.slice(0, maxVisible - 1), overflow: rewards.length - (maxVisible - 1) };
}

/** 줄마다의 중심 y(목록 원점 기준)와 전체 높이. */
export function mailListRows(tab: MailTab, count: number): { centers: number[]; contentHeight: number } {
  const { card } = MAIL_POPUP_LAYOUT;
  const height = tab === "reward" ? card.rewardHeight : card.noticeHeight;
  const centers = Array.from({ length: count }, (_, index) => height / 2 + index * (height + card.gap));
  return { centers, contentHeight: count === 0 ? 0 : count * height + (count - 1) * card.gap };
}

/** 첨부 칸 하나의 x(카드 원점 기준). 카드 왼쪽 안쪽에서 시작해 오른쪽으로 흐른다. */
export function mailRewardX(index: number): number {
  const { card, rewards } = MAIL_POPUP_LAYOUT;
  return -card.width / 2 + 34 + rewards.size / 2 + index * (rewards.size + rewards.gap);
}

/** 하단 탭 하나의 중심 x. */
export function mailTabX(index: number): number {
  const { tab } = MAIL_POPUP_LAYOUT.footer;
  // 라벨은 판 왼쪽에 붙어 선다 — 가방·상점·임무의 전환 라벨과 같은 자리다.
  return tab.left + tab.width / 2 + index * (tab.width + tab.gap);
}

/** 남은 기한을 `D-3`·`12:04`처럼 짧게 적는 데 쓰는 수. 하루가 안 남으면 시·분이다. */
export function mailRemaining(expiresAt: string | null, nowMs: number): { days: number; hours: number; minutes: number } | undefined {
  if (!expiresAt) return undefined;
  const left = Math.max(0, Date.parse(expiresAt) - nowMs);
  return { days: Math.floor(left / 86_400_000), hours: Math.floor((left % 86_400_000) / 3_600_000), minutes: Math.floor((left % 3_600_000) / 60_000) };
}

/**
 * 우편 한 통을 펼친 판. **위가 글, 아래가 첨부**다 — 무엇을 왜 받는지 읽고 나서 받는다.
 *
 * 높이를 글 길이에서 구하지 않고 고정하는 이유는 받기 버튼이 늘 같은 자리에 서야 하기 때문이다.
 * 글이 길면 판을 키우지 않고 글자를 줄인다(`fitTextToBox`). 첨부가 판보다 많으면 그 줄만
 * 옆으로 흐른다.
 */
export const MAIL_DETAIL_LAYOUT = {
  width: 900,
  height: 1180,
  padX: 60,
  titleY: -510,
  metaY: -452,
  ruleY: -412,
  body: { top: -382, bottom: 140 },
  attachTitleY: 196,
  rail: { y: 304, size: 116, gap: 16 },
  claim: { y: 466, width: 380, height: 96 },
} as const;

/** 첨부 칸 하나의 x(줄 원점 기준, 흐른 몫 제외)와 줄 전체 폭. */
export function mailDetailRail(count: number): { xs: number[]; contentWidth: number; viewWidth: number } {
  const { width, padX, rail } = MAIL_DETAIL_LAYOUT;
  const viewWidth = width - padX * 2;
  const contentWidth = count * rail.size + Math.max(0, count - 1) * rail.gap;
  // 넘치지 않으면 가운데로 모은다 — 왼쪽에 붙이면 오른쪽이 빈 칸처럼 보인다.
  const start = contentWidth <= viewWidth ? -contentWidth / 2 : -viewWidth / 2;
  return { xs: Array.from({ length: count }, (_, index) => start + rail.size / 2 + index * (rail.size + rail.gap)), contentWidth, viewWidth };
}
