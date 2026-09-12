/**
 * 이름 아래에 까는 라틴 장식 줄.
 *
 * 로비의 큰 버튼은 한글 이름 아래 같은 뜻의 라틴 낱말을 한 줄 깔아 둔다. 뜻을 두 번 말하려는
 * 것이 아니라, **글자꼴이 다른 한 줄이 이름을 받쳐** 판을 장비처럼 보이게 하려는 것이다.
 *
 * 그래서 **이름이 이미 라틴이면 그 줄을 세우지 않는다** — 영어에서는 `Exchange` 아래 `EXCHANGE`,
 * `SORTIE` 아래 `SORTIE`가 서서 같은 낱말이 두 번 읽힌다. 장식이 아니라 실수로 보인다.
 *
 * 판단은 언어 코드가 아니라 **그 낱말의 글자**로 한다 — 언어로 가르면 라틴을 쓰는 언어가 늘
 * 때마다 목록을 고쳐야 하고, 한 언어 안에서 개체 이름만 라틴인 자리를 놓친다.
 */
export function latinEcho(label: string, echo: string): string | undefined {
  return /[^\p{Script=Latin}\p{N}\p{P}\p{Z}]/u.test(label) ? echo : undefined;
}
