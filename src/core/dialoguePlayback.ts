import type { GameSettings } from "../state/session";

/** 기본 배속에서 글자 하나를 드러내는 간격이며 모든 대사 표면이 같은 리듬을 공유한다. */
export const DIALOGUE_CHARACTER_MS = 30;

/** 저장된 배율을 실제 타이핑 간격과 전체 진행 시간으로 변환하는 순수 계산 결과다. */
export interface DialoguePlaybackTiming {
  characterMs: number;
  typingDurationMs: number;
}

/** 유니코드 코드 포인트 수를 기준으로 대사 타이핑과 다음 입력 가능 시점을 계산한다. */
export function dialoguePlaybackTiming(body: string, textSpeed: GameSettings["game"]["textSpeed"]): DialoguePlaybackTiming {
  const characterMs = DIALOGUE_CHARACTER_MS / textSpeed;
  return { characterMs, typingDurationMs: Array.from(body).length * characterMs };
}

/** 각 노드를 열 때 설정을 다시 읽어 실행 중 변경도 다음 대사부터 적용하는 공용 실행 경계다. */
export class DialoguePlaybackClock {
  constructor(private readonly readTextSpeed: () => GameSettings["game"]["textSpeed"]) {}

  /** 생성 시점의 캐시가 아니라 현재 설정으로 해당 대사의 시간을 확정한다. */
  timingFor(body: string): DialoguePlaybackTiming {
    return dialoguePlaybackTiming(body, this.readTextSpeed());
  }
}
