# 서버 시간 DTO 규칙

발굴과 스테미나는 생산 공식은 공유하지 않지만, 모든 응답 시각은 아래 규칙을 공유한다. 서버와
FakeServer, 클라이언트 표시 코드가 새 DTO를 만들 때도 이 이름과 의미를 바꾸지 않는다.

## 공통 표기

- 모든 시각은 서버가 만든 ISO 8601 UTC 문자열(`YYYY-MM-DDTHH:mm:ss.sssZ`)이다. 클라이언트의
  로컬 시간대나 벽시계는 지급량 계산에 사용하지 않으며 화면 표시에만 변환한다.
- `serverTime`은 **해당 응답 스냅샷을 확정한 시각**이다. 한 응답 안의 상태와 다음 갱신 시각은
  모두 이 값과 같은 서버 clock에서 계산한다.
- 마지막 정산 시각은 도메인 상태에서 `lastSettledAt`, 평탄한 DTO에서는 `updatedAt`으로 쓴다.
  둘 다 **마지막으로 소비한 시간 구간의 기준점**이다. 역행한 요청에서는 정상 값을 보존한다.
- 다음 갱신은 `nextRecoveryAt`처럼 `next...At`으로 쓴다. 현재 상태에서 갱신이 없으면 빈 문자열이
  아니라 `null`이다. 완충처럼 마지막 예정 시각이 필요하면 `fullAt`처럼 결과 이름을 쓴다.
- 만료는 `...ExpiresAt`으로 쓰고 경계 시각 자체는 활성 구간의 끝(반개구간 `[start, expiry)`)이다.
  정산 끝이 만료와 같으면 만료 이전 경과분은 온전히 포함하지만 그 이후 1ms는 포함하지 않는다.

## 도메인 DTO

`StaminaDto`는 `serverTime`, `updatedAt`, `nextRecoveryAt`, `fullAt`을 한 묶음으로 반환한다. 단일
재화의 완료된 5분 틱만 회복하고, 최대치에서는 두 예정 시각이 모두 `null`이다.

`IdleExcavationResponse`는 `serverTime`과 `excavation.lastSettledAt`을 함께 반환한다. 발굴은
복수 재화와 보관 시간 상한을 유지하므로 스테미나식 `nextRecoveryAt`을 만들지 않는다. 생산/보관
광고 만료는 상태의 `productionMultiplierExpiresAt`, `storageExtensionExpiresAt`에 둔다.

## 검증 순서

1. 서버 현재 시각이 유효한지 확인한다.
2. 마지막 정상 정산 시각보다 과거면 생산하지 않고 기준점도 이동하지 않는다.
3. 도메인이 넘긴 최대 경과 시간으로 계산 구간만 clamp한다.
4. 도메인 공식으로 발굴 재화 또는 스테미나 틱을 계산한 뒤 DTO 시각을 구성한다.

공통 순수 구현은 `src/core/timeAccrual.ts`, 두 시스템이 함께 쓰는 회귀 입력은
`tests/fixtures/timeAccrual.ts`가 소유한다.
