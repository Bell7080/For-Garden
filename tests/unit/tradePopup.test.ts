import { describe, expect, it } from "vitest";
import { TRADE_POPUP_FAILURE_MODEL, TradePopupRequestGate } from "../../src/ui/tradePopupModel";

describe("무역 팝업 실패 표시", () => {
  it("API 거절 뒤에도 chrome과 닫기 경로를 남기고 재시도 연타는 한 요청만 허용한다", async () => {
    const gate = new TradePopupRequestGate();
    let requests = 0;
    // 실제 refresh와 같은 문지기를 거쳐, 사용자가 재접속을 연타한 한 프레임을 재현한다.
    const retry = async (generation: number): Promise<void> => {
      if (!gate.begin(generation)) return;
      requests += 1;
      try {
        // 서버 거절은 실패 표시 계약으로 전환되며 상세 개발 오류 문구를 만들지 않는다.
        await Promise.reject(new Error("API_REJECTED"));
      } catch {
        expect(TRADE_POPUP_FAILURE_MODEL).toMatchObject({ clearsDynamicContent: true, preservesChrome: true, actions: ["retry", "close"] });
      } finally {
        // 실제 팝업처럼 해당 세대가 끝날 때만 다음 재시도를 연다.
        gate.finish(generation);
      }
    };

    const first = retry(1); const duplicate = retry(2);
    await Promise.all([first, duplicate]);
    expect(requests).toBe(1);
  });
});
