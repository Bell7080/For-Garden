/**
 * 플레이어 카드(프로필 팝업)의 자리 — 1080×1920 기준, 팝업 몸판 가운데가 원점이다.
 *
 * 위에서 아래로 **누구인가 → 누구를 아끼는가 → 무엇을 이뤘나**의 순서다. 수집형 RPG의
 * 프로필 카드가 대개 이 순서를 쓰는 이유는, 남의 카드를 연 사람이 먼저 알고 싶은 것이
 * 이름·레벨이고 그다음이 그 계정의 대표 캐릭터이기 때문이다.
 */
export const PLAYER_PROFILE_LAYOUT = {
  popup: { width: 960, height: 1480 },
  header: {
    /**
     * 테두리 장식은 가운데에서 `size × PROFILE_FRAME_REACH`까지 뻗는다. 그 상자가 팝업 몸판(왼쪽 위가
     * 깎였다)·제목표 띠·이름줄 안쪽에 들도록 자리를 잡는다 — `tests/unit/profileFrameGeometry.test.ts`.
     */
    avatar: { x: -314, y: -582, size: 180 },
    /** 아바타 밑변에 반쯤 걸친 레벨 칩. */
    levelChip: { y: -472, width: 150, height: 52 },
    textLeft: -176,
    textRight: 430,
    nameY: -654,
    modifierY: -598,
    uidY: -546,
    expY: -500,
    expHeight: 18,
    expValueY: -470,
  },
  modifiers: { width: 170, height: 44, gap: 12 },
  /** 한 줄 소개 판. 따옴표 둘은 판의 장식이라 판 양 끝에 위아래로 엇갈려 찍힌다. */
  bio: { y: -398, width: 880, height: 76, quote: {
    size: 64, inset: 30, alpha: 0.85,
    /** 따옴표 글리프는 글자 상자 위쪽에 붙어 있어 상자 가운데를 맞추면 판 위로 뜬다 — 상자를 내려 잡는다. */
    openY: 4, closeY: 30,
  } },
  showcase: {
    titleY: -330,
    top: -312,
    bottom: 124,
    width: 880,
    /** SD가 서는 바닥선과 키. */
    sd: { x: -214, groundY: 76, height: 330 },
    info: { left: 22, rarityY: -262, nameY: -214, badgeY: -150, firstRowY: -78, rowGap: 58 },
    grid: { horizonY: -40, rows: 6, columns: 9 },
    /**
     * 판 뒤에 깔리는 전신 — 얼굴을 판의 오른쪽 가운데쯤에 두고(`headX`), 왼쪽(SD 자리)은
     * `fade`만큼 녹인다. `crop`은 실루엣 폭 대비 상자 높이라 작을수록 얼굴이 크게 당겨진다.
     */
    backdrop: { alpha: 0.26, crop: 0.62, headX: 0.62, anchorY: 0.32, fade: 0.55 },
  },
  records: { titleY: 184, firstY: 286, rowGap: 168, columnX: 222, width: 426, height: 150 },
  nextUnlock: { y: 600 },
  /** 친구 카드 밑동의 조작 줄(즐겨찾기·삭제). 다음 해금 줄이 없는 친구 카드가 그 자리를 쓴다. */
  actions: { y: 636, height: 88, gap: 16, fontSize: 32 },
} as const;

/** 긴 사용자 문자열은 실제 Text bounds가 예약 영역을 넘기 전에 유니코드 단위로 줄인다. */
export function compactProfileText(value: string, maxCharacters: number): string {
  const characters = Array.from(value.trim());
  return characters.length <= maxCharacters ? characters.join("") : `${characters.slice(0, Math.max(1, maxCharacters - 1)).join("")}…`;
}

/** 진행도(0~1). 분모가 0이면 0이다. */
export function profileProgressRatio(done: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
}

/**
 * 프로필 사진·테두리 선택창 — **위에서부터 잰 거리**다. 세 탭이 같은 창을 갈아 쓰므로 창 높이는
 * 세 목록 중 긴 쪽에서 구해 탭을 바꿔도 창이 늘었다 줄었다 하지 않는다(`avatarPickerHeight`).
 */
export const AVATAR_PICKER = {
  width: 940,
  preview: { y: 180, size: 190 },
  /** 미리보기 바로 아래 — 고른 것의 이름과 해금 조건. 수식어 탭의 미리보기는 얼굴 대신 수식어 칩이다. */
  info: { nameY: 340, conditionY: 386, previewChip: { width: 320, height: 76 } },
  tabs: { y: 474, width: 280, height: 70, gap: 18 },
  photos: { top: 588, columns: 5, cell: 150, gap: 24 },
  frames: { top: 598, columns: 3, width: 272, height: 286, gap: 18, avatarSize: 132 },
  modifiers: { top: 598, columns: 3, width: 272, height: 76, gap: 18 },
  bottomPad: 70,
} as const;

export function avatarPickerRows(count: number, columns: number): number {
  return Math.max(1, Math.ceil(count / columns));
}

export function avatarPickerHeight(photoCount: number, frameCount: number, modifierCount = 0): number {
  const { photos, frames, modifiers, bottomPad } = AVATAR_PICKER;
  const photoBottom = photos.top + avatarPickerRows(photoCount, photos.columns) * (photos.cell + photos.gap) - photos.gap;
  const frameBottom = frames.top + avatarPickerRows(frameCount, frames.columns) * (frames.height + frames.gap) - frames.gap;
  const modifierBottom = modifiers.top + avatarPickerRows(modifierCount, modifiers.columns) * (modifiers.height + modifiers.gap) - modifiers.gap;
  return Math.max(photoBottom, frameBottom, modifierBottom) + bottomPad;
}

/** 한 줄 입력 창(닉네임·한 줄 소개). */
export const TEXT_EDITOR = { width: 900, height: 470, noticeY: -118, fieldY: -40, noteY: 26, saveY: 130, field: { width: 800, height: 84 }, save: { width: 300, height: 80 } } as const;
