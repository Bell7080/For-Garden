/**
 * 일반 유저용 빌드와 QA(테스트) 빌드를 가르는 단 하나의 스위치.
 *
 * `vite build --mode qa`로 만든 번들에서만 치트·개발용 조작이 서고, 일반 빌드에서는 Vite가
 * 분기째 지워 번들에 코드가 남지 않는다. E2E용 `test` 모드와는 다르다 — `test`는 3D 연출을
 * 꺼 버리므로 사람이 눈으로 확인하는 QA 빌드에는 쓰지 않는다.
 */
export const QA_TOOLS_ENABLED: boolean = import.meta.env?.MODE === "qa" || import.meta.env?.DEV === true;
