/**
 * 로비 유휴 미리 받기를 걸어도 되는 연결인지.
 *
 * 받는 양은 6MB 안팎(정보창·도감·편성·연구소·고고학·프리미엄 배경 + 교류 첫 도시 원화 셋 + 상점 점원)이라, **셀룰러로 확실히 알려진 연결과 데이터 절약(`saveData`)만**
 * 건너뛴다. 연결 종류를 알려 주지 않는 기기(iOS·데스크톱 사파리 — `navigator.connection.type`은 안드로이드 크롬·웹뷰에만
 * 있다)는 받는다 — 모르면 막도록 두었더니 iOS에서는 영영 미리 받지 못했다(응태 결정 2026-11-21 「미리 받자」).
 */
export interface ConnectionHint { readonly type?: string; readonly saveData?: boolean }

export function idlePrefetchAllowed(connection: ConnectionHint | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.type !== "cellular";
}

export function navigatorConnection(): ConnectionHint | undefined {
  return (globalThis.navigator as { connection?: ConnectionHint } | undefined)?.connection;
}
