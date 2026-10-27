import { audioManager } from "../managers/AudioManager";

/**
 * 편성 목록의 카드를 누른 손에 답한다. 편성 화면 넷(스토리·원정·발굴·교류)이 같은 손짓으로 같은
 * 일을 하므로 소리도 한 곳에서 고른다 — 자리에 새로 서면 「착」, 빠지면 가볍게 들리고, 이미 선
 * 개체를 눌러 그 자리만 고른 것이면 작은 탭이다.
 */
export function playFormationTapSound(before: readonly (string | null | undefined)[], after: readonly (string | null | undefined)[], relicId: string): void {
  const was = before.includes(relicId);
  const now = after.includes(relicId);
  audioManager?.playUi(!was && now ? "formation.place" : was && !now ? "formation.lift" : "ui.tap");
}
