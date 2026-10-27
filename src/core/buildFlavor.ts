/**
 * 일반 유저용 빌드와 QA(테스트) 빌드를 가르는 단 하나의 스위치.
 *
 * `vite build --mode qa`와 개발 서버에서 치트·개발용 조작이 서고, 일반 빌드에서는 Vite가
 * 분기째 지워 번들에 코드가 남지 않는다. E2E용 `test` 모드도 같은 도구를 쓰지만 3D 연출을
 * 꺼 버리므로 사람이 눈으로 확인하는 QA 빌드에는 `test`가 아니라 `qa`를 쓴다.
 */
export const QA_TOOLS_ENABLED: boolean = import.meta.env?.MODE === "qa" || import.meta.env?.MODE === "test" || import.meta.env?.DEV === true;

/**
 * 첫 플레이 튜토리얼을 세우는가. **QA 빌드(`--mode qa`)에서만 끈다** — 치트로 진행을 건너뛰며 화면을 확인하는
 * 자리라 안내 화살표·전투 조작 잠금이 매번 가로막는다. 오프닝 이야기와 1-1은 본편이라 그대로 선다.
 * E2E(`test`)는 튜토리얼 흐름 자체를 검사하므로 켜 둔다.
 */
export const TUTORIAL_ENABLED: boolean = import.meta.env?.MODE !== "qa";

/**
 * QA 빌드가 접속하자마자 이 기기의 임시 길드(표본 길드 「포가든 수호대」)에 길드장으로 들어가 있는가. 길드전·수호전을
 * 곧바로 시험하려는 자리라 길드 만들기·가입을 건너뛴다. **E2E(`test`)는 끈다** — 길드 만들기 흐름 자체를 검사한다.
 * 운영 서버의 길드는 건드리지 않고 길드만 이 기기의 샌드박스로 돈다(`guildApi.setGuildSandbox`).
 */
export const QA_GUILD_AUTO_JOIN: boolean = QA_TOOLS_ENABLED && import.meta.env?.MODE !== "test";
