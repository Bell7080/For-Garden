/**
 * 머리 위 상태 칩과 그 쪽지의 문구.
 *
 * 남은 시간·겹 수는 `{남은}`·`{겹}` 자리로 넘긴다. 조각을 이어 붙이면 어순이 다른 언어에서
 * "3초 남음"이 "남음 3초"가 되어야 하는데 그 순서를 화면이 정할 수 없다.
 */
export const STATUS_KO = {
  "status.seconds": "{value}초",

  "status.pack.standing": "곁에 서 있다",
  "status.pack.returns": "{time} 뒤 다시 선다",
  "status.pack.gone": "다시 서지 않는다",

  "status.shell": "조가비",
  "status.shell.detail": "조가비 {stacks}/{max} · {time} 남음",
  "status.stun": "기절",
  "status.stun.detail": "{time} 남음",
  "status.frozen": "빙결",
  "status.frozen.detail": "{time} 남음 · 풀리는 순간 최대 체력의 {percent}% 고정 피해",
  "status.frenzy": "광란",
  "status.frenzy.detail": "자기 편을 공격 · 공격 속도 +{percent}% · {time} 남음",
  "status.taunt": "도발",
  "status.taunt.detail": "도발한 상대만 표적으로 삼는다 · {time} 남음",
  "status.bleed": "출혈",
  "status.bleed.detail": "매초 최대 체력의 {percent}% · {time} 남음",
  "status.poison": "중독",
  "status.poison.detail": "매초 {amount} · {time} 남음",
  "status.reagent": "시약",
  "status.reagent.detail": "{stacks}/3겹 · {time} 남음",
  "status.weakpoint": "약점 포착",
  "status.weakpoint.detail": "듀오가 때리면 추가 피해",
  "status.overpaint": "덧칠",
  "status.overpaint.detail": "{stacks}겹 · 받는 피해 +{percent}% · {time} 남음",
  "status.curse": "저주",
  "status.curse.detail": "{stacks}겹 · 저항력 -{percent}% · {time} 남음",
  "status.chill": "둔화",
  "status.chill.detail": "{stacks} / {max}겹 · 공격 속도·이동 속도 -{percent}%",
  "status.submerged": "잠김",
  "status.submerged.detail": "이동 속도 -{percent}% · 여울에서 벗어나면 풀린다",
  "status.vandalism": "밴덜리즘",
  "status.vandalism.detail": "{stacks} / {max}겹 · 공격력·주문력 -{percent}% · 다 차면 그 자리에서 터진다",
  "status.butcher": "손질",
  "status.butcher.detail": "{stacks} / {max}겹 · 다 차면 그 자리에서 터진다",
} as const;
