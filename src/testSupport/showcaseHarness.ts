/**
 * 새로 만난 렐릭의 소개 장면을 뽑기 없이 여는 테스트 전용 창구.
 *
 * 소개 장면은 **처음 만난 개체**가 나와야만 돌아서, 확률에 기대면 SSR 구도를 눈으로 검수할 방법이
 * 없다. 그래서 `vite build --mode test`에서만 개체 ID로 곧바로 여는 창구를 연다 — 프로덕션에서는
 * 전역 객체에 아무것도 걸지 않는다.
 */

declare global {
  interface Window {
    /** 테스트 빌드에서만 걸린다. 연구소에 들어가 있어야 한다. */
    __PF_SHOWCASE_PREVIEW__?: (relicId: string) => void;
  }
}

export function exposeShowcasePreview(open: (relicId: string) => void): void {
  if (import.meta.env.MODE !== "test" || typeof window === "undefined") return;
  window.__PF_SHOWCASE_PREVIEW__ = open;
}
