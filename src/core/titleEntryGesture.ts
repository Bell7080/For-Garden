/** 인증 버튼이나 팝업에서 시작한 손 떼기를 게임 진입 입력으로 재사용하지 않는다. */
export class TitleEntryGesture {
  private pointer?: number;
  constructor(private armed: boolean) {}
  arm(): void { this.pointer = undefined; this.armed = true; }
  down(id: number, blocked: boolean): void { this.pointer = this.armed && !blocked ? id : undefined; }
  up(id: number): boolean {
    const accepted = this.armed && this.pointer === id;
    this.pointer = undefined;
    return accepted;
  }
}
