import type { RelicDef } from "../core/types";

/**
 * 렐릭 정의. 최종 30종을 목표로 하되, 지금은 파티 편성과 전투 규칙을 검증할 만큼만 둔다.
 * 밸런스 수치는 데이터일 뿐이므로 코드 수정 없이 여기서 조정한다.
 */
export const RELICS: RelicDef[] = [
  {
    id: "rex",
    name: "렉스",
    origin: "티라노사우루스 렉스",
    role: "attacker",
    stats: { hp: 820, atk: 132, def: 42 },
    passive: {
      id: "rex-passive",
      name: "포식 본능",
      kind: "swapMomentum",
      value: 35,
      desc: "교대로 전방에 나선 직후의 첫 공격 피해가 35% 오른다.",
    },
    basic: { id: "rex-basic", name: "턱 물어뜯기", power: 100, desc: "적 전방을 문다." },
    support: {
      id: "rex-support",
      name: "후방 급습",
      kind: "strike",
      power: 70,
      desc: "후방에서 적 후방을 직접 노린다.",
    },
    ultimate: {
      id: "rex-ult",
      name: "절멸의 포효",
      power: 240,
      cost: 100,
      desc: "적 전방에 큰 피해를 준다.",
    },
  },
  {
    id: "anky",
    name: "안키",
    origin: "안킬로사우루스",
    role: "tank",
    stats: { hp: 1420, atk: 74, def: 128 },
    passive: {
      id: "anky-passive",
      name: "골질 갑주",
      kind: "frontGuard",
      value: 25,
      desc: "전방에 있을 때 받는 피해가 25% 줄어든다.",
    },
    basic: { id: "anky-basic", name: "곤봉 꼬리", power: 100, desc: "꼬리로 후려친다." },
    support: {
      id: "anky-support",
      name: "방벽 전개",
      kind: "heal",
      power: 160,
      desc: "후방에서 전방 아군의 HP를 회복시킨다.",
    },
    ultimate: {
      id: "anky-ult",
      name: "지각 붕괴",
      power: 180,
      cost: 100,
      desc: "땅을 흔들어 적 전방을 짓누른다.",
    },
  },
  {
    id: "mammoth",
    name: "마무",
    origin: "털매머드",
    role: "tank",
    stats: { hp: 1260, atk: 88, def: 104 },
    passive: {
      id: "mammoth-passive",
      name: "빙하기의 털",
      kind: "frontGuard",
      value: 18,
      desc: "전방에 있을 때 받는 피해가 18% 줄어든다.",
    },
    basic: { id: "mammoth-basic", name: "상아 치받기", power: 100, desc: "상아로 들이받는다." },
    support: {
      id: "mammoth-support",
      name: "돌진 지원",
      kind: "buff",
      power: 30,
      desc: "후방에서 전방 아군의 공격력을 30% 올린다.",
    },
    ultimate: {
      id: "mammoth-ult",
      name: "혹한 돌진",
      power: 200,
      cost: 100,
      desc: "얼어붙은 돌진으로 적 전방을 밀어붙인다.",
    },
  },
  {
    id: "dodo",
    name: "도도",
    origin: "도도새",
    role: "support",
    stats: { hp: 760, atk: 96, def: 48 },
    passive: {
      id: "dodo-passive",
      name: "온순한 둥지",
      kind: "rearMend",
      value: 45,
      desc: "후방에 있는 동안 매 턴 전방 아군의 HP를 45 회복시킨다.",
    },
    basic: { id: "dodo-basic", name: "부리 쪼기", power: 100, desc: "부리로 쪼아댄다." },
    support: {
      id: "dodo-support",
      name: "품어주기",
      kind: "heal",
      power: 220,
      desc: "후방에서 전방 아군을 크게 회복시킨다.",
    },
    ultimate: {
      id: "dodo-ult",
      name: "잊힌 노래",
      power: 150,
      cost: 100,
      desc: "사라진 종의 노래로 적을 뒤흔든다.",
    },
  },
  {
    id: "smilo",
    name: "스밀라",
    origin: "스밀로돈",
    role: "attacker",
    stats: { hp: 840, atk: 124, def: 56 },
    passive: {
      id: "smilo-passive",
      name: "매복 습성",
      kind: "swapMomentum",
      value: 28,
      desc: "교대로 전방에 나선 직후의 첫 공격 피해가 28% 오른다.",
    },
    basic: { id: "smilo-basic", name: "송곳니 절단", power: 100, desc: "긴 송곳니로 벤다." },
    support: {
      id: "smilo-support",
      name: "측면 우회",
      kind: "strike",
      power: 80,
      desc: "후방에서 적 후방을 노려 벤다.",
    },
    ultimate: {
      id: "smilo-ult",
      name: "빙원의 사냥",
      power: 230,
      cost: 100,
      desc: "숨 돌릴 틈 없이 적 전방을 몰아친다.",
    },
  },
  {
    id: "quetz",
    name: "케찰",
    origin: "케찰코아틀루스",
    role: "support",
    stats: { hp: 780, atk: 108, def: 44 },
    passive: {
      id: "quetz-passive",
      name: "활공 경계",
      kind: "rearMend",
      value: 30,
      desc: "후방에 있는 동안 매 턴 전방 아군의 HP를 30 회복시킨다.",
    },
    basic: { id: "quetz-basic", name: "급강하", power: 100, desc: "하늘에서 내리꽂는다." },
    support: {
      id: "quetz-support",
      name: "상승 기류",
      kind: "buff",
      power: 40,
      desc: "후방에서 전방 아군의 공격력을 40% 올린다.",
    },
    ultimate: {
      id: "quetz-ult",
      name: "창공 지배",
      power: 190,
      cost: 100,
      desc: "하늘을 덮어 적 전방을 찍어누른다.",
    },
  },

  // --- 적 개체. 폭주해 이터널 시티를 위협하는 실패작들이다. ---
  {
    id: "husk-raptor",
    name: "허스크 랩터",
    origin: "실패한 벨로키랍토르 개체",
    role: "attacker",
    stats: { hp: 620, atk: 92, def: 38 },
    passive: {
      id: "husk-raptor-passive",
      name: "무리 본능",
      kind: "swapMomentum",
      value: 20,
      desc: "교대 직후 첫 공격이 20% 강해진다.",
    },
    basic: { id: "husk-raptor-basic", name: "갈퀴 할퀴기", power: 100, desc: "갈퀴로 할퀸다." },
    support: {
      id: "husk-raptor-support",
      name: "틈새 침투",
      kind: "strike",
      power: 60,
      desc: "후방에서 상대 후방을 파고든다.",
    },
    ultimate: {
      id: "husk-raptor-ult",
      name: "무리 사냥",
      power: 170,
      cost: 100,
      desc: "떼지어 달려든다.",
    },
  },
  {
    id: "husk-shell",
    name: "허스크 셸",
    origin: "실패한 갑주 개체",
    role: "tank",
    stats: { hp: 980, atk: 66, def: 92 },
    passive: {
      id: "husk-shell-passive",
      name: "굳은 껍질",
      kind: "frontGuard",
      value: 15,
      desc: "전방에서 받는 피해가 15% 줄어든다.",
    },
    basic: { id: "husk-shell-basic", name: "몸통 박치기", power: 100, desc: "몸으로 들이받는다." },
    support: {
      id: "husk-shell-support",
      name: "잔해 보수",
      kind: "heal",
      power: 120,
      desc: "후방에서 전방 개체를 수복한다.",
    },
    ultimate: {
      id: "husk-shell-ult",
      name: "붕괴 압사",
      power: 160,
      cost: 100,
      desc: "무너지듯 짓누른다.",
    },
  },
  {
    id: "husk-wing",
    name: "허스크 윙",
    origin: "실패한 익룡 개체",
    role: "support",
    stats: { hp: 580, atk: 84, def: 34 },
    passive: {
      id: "husk-wing-passive",
      name: "잔존 신호",
      kind: "rearMend",
      value: 25,
      desc: "후방에 있는 동안 매 턴 전방 개체를 25 회복시킨다.",
    },
    basic: { id: "husk-wing-basic", name: "날개 후려치기", power: 100, desc: "날개로 후려친다." },
    support: {
      id: "husk-wing-support",
      name: "교란 신호",
      kind: "strike",
      power: 55,
      desc: "후방에서 상대 후방을 교란한다.",
    },
    ultimate: {
      id: "husk-wing-ult",
      name: "굉음 확산",
      power: 150,
      cost: 100,
      desc: "굉음을 퍼뜨린다.",
    },
  },
];

const BY_ID = new Map(RELICS.map((r) => [r.id, r]));

export function getRelic(id: string): RelicDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`알 수 없는 렐릭 id: ${id}`);
  return found;
}

/** 플레이어가 파티에 넣을 수 있는 렐릭. 적 개체(허스크)는 빠진다. */
export const PLAYABLE_RELICS = RELICS.filter((r) => !r.id.startsWith("husk-"));
