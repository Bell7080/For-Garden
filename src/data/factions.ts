import type { SquadId } from "../core/types";

/**
 * 이터널 시티 5대 자치 스쿼드.
 *
 * 세계관 원문은 `docs/factions.md`이고, 여기에는 **화면이 읽는 값만** 옮긴다. 소속은 전투
 * role이나 속성표와 달리 코드가 강제하지 않는 서사 값이라, 표가 둘로 갈리면 같은 스쿼드가
 * 화면마다 다른 이름·다른 호칭으로 보인다.
 *
 * 새 스쿼드가 생기면 그 문서와 이 표를 함께 고친다.
 */

// 엠블럼 파일 이름(`public/sprites/factions/<id>.webp`)이 곧 SquadId다.
export type { SquadId };

export interface SquadDef {
  id: SquadId;
  name: string;
  /** 세계관 원문의 라틴 표기. 엠블럼 옆에 작게 곁들일 때만 쓴다. */
  latin: string;
  /** 그 스쿼드가 맡은 일. 한 줄로 끊어 소속을 처음 보는 사람도 무엇 하는 무리인지 알게 한다. */
  duty: string;
  /**
   * 그 스쿼드가 주인공(연구원)을 부르는 말.
   *
   * 스쿼드마다 다르다 — 팽은 상관으로, 룬은 돌볼 아이로, 쁘띠 로그는 대장으로 본다. 캐릭터
   * 대사와 프로필이 같은 호칭을 쓰게 하려고 코드 쪽에도 둔다.
   */
  researcherTitles: readonly string[];
}

export const SQUADS: Readonly<Record<SquadId, SquadDef>> = {
  fang: {
    id: "fang", name: "앱솔루트 팽", latin: "Absolute Fang",
    duty: "최전선 결전 및 전술 제압",
    researcherTitles: ["연구원", "마스터", "보스"],
  },
  gear: {
    id: "gear", name: "나이트 기어", latin: "Night Gear",
    duty: "외곽 잠입 및 잔해 인양",
    researcherTitles: ["연구원님", "당신"],
  },
  eye: {
    id: "eye", name: "시그널 아이", latin: "Signal Eye",
    duty: "고공 통신 및 광역 관측",
    researcherTitles: ["선배", "담당관", "오더"],
  },
  rune: {
    id: "rune", name: "사일런트 룬", latin: "Silent Rune",
    duty: "DNA 공명 안정 및 심신 케어",
    researcherTitles: ["선생", "연구원 씨", "아가"],
  },
  rogue: {
    id: "rogue", name: "쁘띠 로그", latin: "Petit Rogue",
    duty: "자율 탐험 및 보급 회수",
    researcherTitles: ["대장님", "선생님", "연구원님"],
  },
};

/** Phaser 텍스처 키. 파일 경로가 아니라 이 함수가 만든 키로만 엠블럼을 찾는다. */
export function squadEmblemKey(squad: SquadId): string {
  return `faction-${squad}`;
}

/** 로딩 단계가 읽는 목록. 스쿼드 하나에 엠블럼 한 장이다. */
export const SQUAD_EMBLEM_ASSETS: ReadonlyArray<readonly [string, string]> = (Object.keys(SQUADS) as SquadId[])
  .map((squad) => [squadEmblemKey(squad), `/sprites/factions/${squad}.webp`] as const);
