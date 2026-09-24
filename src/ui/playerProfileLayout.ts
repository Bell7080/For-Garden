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
    avatar: { x: -318, y: -586, size: 200 },
    /** 아바타 밑변에 반쯤 걸친 레벨 칩. */
    levelChip: { y: -474, width: 150, height: 52 },
    textLeft: -186,
    textRight: 430,
    nameY: -654,
    modifierY: -598,
    uidY: -546,
    expY: -500,
    expHeight: 18,
    expValueY: -470,
  },
  modifiers: { width: 170, height: 44, gap: 12 },
  bio: { y: -398, width: 880, height: 76 },
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
 * 프로필 사진·테두리 선택창 — **위에서부터 잰 거리**다. 두 탭이 같은 창을 갈아 쓰므로 창 높이는
 * 두 목록 중 긴 쪽에서 구해 탭을 바꿔도 창이 늘었다 줄었다 하지 않는다(`avatarPickerHeight`).
 */
export const AVATAR_PICKER = {
  width: 940,
  preview: { y: 180, size: 190 },
  tabs: { y: 356, width: 300, height: 70, gap: 18 },
  photos: { top: 470, columns: 5, cell: 150, gap: 24 },
  frames: { top: 480, columns: 3, width: 272, height: 286, gap: 18, avatarSize: 132 },
  bottomPad: 70,
} as const;

export function avatarPickerRows(count: number, columns: number): number {
  return Math.max(1, Math.ceil(count / columns));
}

export function avatarPickerHeight(photoCount: number, frameCount: number): number {
  const { photos, frames, bottomPad } = AVATAR_PICKER;
  const photoBottom = photos.top + avatarPickerRows(photoCount, photos.columns) * (photos.cell + photos.gap) - photos.gap;
  const frameBottom = frames.top + avatarPickerRows(frameCount, frames.columns) * (frames.height + frames.gap) - frames.gap;
  return Math.max(photoBottom, frameBottom) + bottomPad;
}

/** 한 줄 입력 창(닉네임·한 줄 소개). */
export const TEXT_EDITOR = { width: 900, height: 470, fieldY: -40, noteY: 26, saveY: 130, field: { width: 800, height: 84 }, save: { width: 300, height: 80 } } as const;

/** 수식어 고르기 — 세 줄 격자, 높이는 얻은 수에서 구한다. */
export const MODIFIER_PICKER = { width: 900, top: 150, columns: 3, cell: { width: 262, height: 64 }, gap: 18, saveGap: 110, save: { width: 300, height: 80 }, bottomPad: 80 } as const;

export function modifierPickerHeight(count: number): number {
  const rows = avatarPickerRows(count, MODIFIER_PICKER.columns);
  return MODIFIER_PICKER.top + rows * (MODIFIER_PICKER.cell.height + MODIFIER_PICKER.gap) + MODIFIER_PICKER.saveGap + MODIFIER_PICKER.save.height / 2 + MODIFIER_PICKER.bottomPad;
}
