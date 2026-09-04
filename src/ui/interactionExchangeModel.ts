/** 순수 회귀 검사가 Phaser 없이 외곽 chrome과 동적 목록의 생명주기 분리를 고정한다. */
export const INTERACTION_EXCHANGE_RENDER_MODEL = { destroysPopupChrome: false, refreshesContentContainerOnly: true } as const;
