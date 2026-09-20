/**
 * 재화 안내창의 **순수 배치표**.
 *
 * Phaser를 읽지 않는 이유는 다른 배치표와 같다 — 화면과 E2E가 같은 값을 읽어야 한다. 닫기 X의
 * 자리는 이 크기와 `POPUP_CLOSE_LAYOUT`에서 나오는데, 스펙이 그 좌표를 손으로 적어 두었더니
 * 창이 커진 뒤로 66px 어긋나 입력면 밖을 눌렀고 — **조작은 성공한 채 검사만 조용히 깨졌다.**
 */
export const CURRENCY_GUIDE_SIZE = { width: 780, height: 1020 } as const;
