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
