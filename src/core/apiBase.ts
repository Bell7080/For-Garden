/**
 * 게임 서버(`/api/game`·`/api/account`)의 주소를 만드는 유일한 문.
 *
 * 웹 배포는 같은 출처라 상대 경로로 충분하다. 그러나 **앱으로 패키징하면 문서의 출처가 서버가 아니다**
 * (`https://localhost`·`capacitor://localhost`·`file://`) — 상대 경로는 앱 안에서 자기 자신을 가리켜 모든
 * 서버 호출이 404가 된다. 앱 빌드는 `VITE_API_BASE_URL`(예: `https://for-garden.vercel.app`)을 주면
 * 모든 호출이 그 서버로 간다. 비워 두면 예전 그대로 상대 경로다.
 */
export function apiUrl(path: string, base: string | undefined = import.meta.env?.VITE_API_BASE_URL): string {
  const root = (base ?? "").trim().replace(/\/+$/, "");
  return `${root}${path}`;
}
